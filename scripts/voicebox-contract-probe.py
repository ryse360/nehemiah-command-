#!/usr/bin/env python3
"""
Voicebox contract probe — Phase 0 gate, part B.

Exercises the FULL generation lifecycle against a live local Voicebox and
captures its exact API contract:

    openapi -> presets -> profile -> POST /generate -> SSE status -> audio -> cancel

The HTML probe (public/voicebox-probe.html) answers the BROWSER boundary
question (CORS / Private Network Access). This script answers the CONTRACT
question — the precise request/response shapes the transport must be built
against — without a browser in the way.

DESIGN PRINCIPLES (learned the hard way):
  * ALWAYS print the response body on failure. A bare status code sends you
    round-trip guessing; FastAPI's validation errors name the exact field.
  * DERIVE the request payload from the server's own OpenAPI schema rather
    than hardcoding field names, then retry with variants if the server still
    objects. The API is the authority, not our assumptions.

Run on the Founder's Mac with Voicebox running:

    python3 scripts/voicebox-contract-probe.py --voice bm_george

Stdlib only. It creates one preset voice profile (generation requires a
profile_id) and cancels the generation it starts.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Any

TIMEOUT = 15
# The FIRST successful generation downloads a TTS model from HuggingFace, which
# can take minutes. The status stream therefore gets a much longer budget.
STREAM_TIMEOUT = 600

ID_KEYS = ("id", "generation_id", "generationId", "job_id", "jobId")
AUDIO_KEYS = ("audio_url", "audioUrl", "url", "audio_path", "path", "file", "output_path")
NESTED_KEYS = ("result", "data", "generation", "audio", "output")
TERMINAL_STATUSES = {
    "complete", "completed", "done", "ready", "finished", "success",
    "error", "failed", "failure", "cancelled", "canceled", "aborted",
}


# --------------------------------------------------------------------------- io


def request(method: str, url: str, body: dict[str, Any] | None = None) -> tuple[int, Any]:
    """Return (status, parsed-or-raw-body). Never raises on HTTP error status."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read().decode(errors="replace")
            status = response.status
    except urllib.error.HTTPError as error:
        raw = error.read().decode(errors="replace")
        status = error.code
    except Exception as error:  # noqa: BLE001 — probe reports, never crashes
        return 0, {"error": f"{type(error).__name__}: {error}"}
    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw[:2000]


def step(label: str, ok: bool, detail: str = "") -> None:
    print(f"[{'PASS' if ok else 'FAIL'}] {label}{' — ' + detail if detail else ''}")


def show_body(label: str, body: Any, limit: int = 1200) -> None:
    """Print a response body. Called on EVERY failure — never hide the detail."""
    rendered = json.dumps(body, indent=2, ensure_ascii=False) if isinstance(body, (dict, list)) else str(body)
    print(f"       {label}: {rendered[:limit]}")


# ---------------------------------------------------------------- extraction


def find_key(payload: Any, keys: tuple[str, ...]) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
    for nested in NESTED_KEYS:
        found = find_key(payload.get(nested), keys)
        if found:
            return found
    return None


def find_id(payload: Any) -> str | None:
    return find_key(payload, ID_KEYS)


def extract_audio(payload: Any) -> str | None:
    return find_key(payload, AUDIO_KEYS)


def is_terminal(payload: str) -> bool:
    """
    Decide termination from the `status` FIELD, never by scanning raw text.

    Every live event carries an `error` key (null when healthy), so a substring
    search for "error" wrongly terminates on healthy events such as
    {"status": "loading_model", "error": null}.
    """
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError:
        return False
    if not isinstance(parsed, dict):
        return False
    status = parsed.get("status")
    return isinstance(status, str) and status.strip().lower() in TERMINAL_STATUSES


def read_sse(url: str, max_events: int = 200) -> list[str]:
    events: list[str] = []
    try:
        with urllib.request.urlopen(url, timeout=STREAM_TIMEOUT) as stream:
            for raw_line in stream:
                line = raw_line.decode(errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                events.append(payload[:600])
                if is_terminal(payload):
                    break
                if len(events) >= max_events:
                    break
    except Exception as error:  # noqa: BLE001
        events.append(f"<stream ended: {type(error).__name__}: {error}>")
    return events


# -------------------------------------------------------------- openapi schema


def resolve_ref(openapi: dict[str, Any], ref: str) -> dict[str, Any]:
    node: Any = openapi
    for part in ref.lstrip("#/").split("/"):
        if not isinstance(node, dict):
            return {}
        node = node.get(part, {})
    return node if isinstance(node, dict) else {}


def request_schema(openapi: Any, path: str) -> dict[str, Any]:
    """Resolve the JSON request-body schema for POST {path}, following $ref."""
    if not isinstance(openapi, dict):
        return {}
    operation = openapi.get("paths", {}).get(path, {}).get("post", {})
    content = operation.get("requestBody", {}).get("content", {})
    schema = content.get("application/json", {}).get("schema", {})
    if "$ref" in schema:
        schema = resolve_ref(openapi, schema["$ref"])
    return schema if isinstance(schema, dict) else {}


def describe_schema(schema: dict[str, Any]) -> str:
    required = schema.get("required", [])
    props = schema.get("properties", {})
    if not props:
        return "(no schema found)"
    lines = []
    for name, spec in props.items():
        flag = "REQUIRED" if name in required else "optional"
        kind = spec.get("type") or ("anyOf" if "anyOf" in spec else "?")
        extra = ""
        if isinstance(spec.get("enum"), list):
            extra = f" enum={spec['enum'][:8]}"
        lines.append(f"         - {name:22} {flag:9} {kind}{extra}")
    return "\n" + "\n".join(lines)


def payload_variants(
    schema: dict[str, Any], text: str, profile_id: str, engine: str, voice: str | None
) -> list[dict[str, Any]]:
    """
    Build candidate /generate bodies, best-guess first.

    Starts from what the schema says is required, then falls back to broader
    variants so a single run discovers the accepted shape instead of costing
    another round trip.
    """
    props = set(schema.get("properties", {}).keys())
    base: dict[str, Any] = {"text": text, "profile_id": profile_id}

    first = dict(base)
    if "language" in props:
        first["language"] = "en"
    if "engine" in props:
        first["engine"] = engine
    if "voice_id" in props and voice:
        first["voice_id"] = voice

    variants = [first]

    # Fill every REQUIRED field the schema declares, using its default/enum.
    filled = dict(first)
    for name in schema.get("required", []):
        if name in filled:
            continue
        spec = schema.get("properties", {}).get(name, {})
        if "default" in spec:
            filled[name] = spec["default"]
        elif isinstance(spec.get("enum"), list) and spec["enum"]:
            filled[name] = spec["enum"][0]
        elif spec.get("type") == "string":
            filled[name] = engine if "engine" in name else ""
        elif spec.get("type") in ("integer", "number"):
            filled[name] = 0
        elif spec.get("type") == "boolean":
            filled[name] = False
    if filled != first:
        variants.append(filled)

    variants.append({"text": text, "profile_id": profile_id})
    variants.append({"text": text, "profile_id": profile_id, "engine": engine, "language": "en"})

    seen: list[dict[str, Any]] = []
    for variant in variants:
        if variant not in seen:
            seen.append(variant)
    return seen


# ---------------------------------------------------------------------- main


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:17493")
    parser.add_argument("--engine", default="kokoro")
    parser.add_argument("--voice", default="", help="Preset voice_id, e.g. bm_george")
    parser.add_argument("--profile-name", default="Nehemiah")
    parser.add_argument("--text", default="Nehemiah contract probe.")
    parser.add_argument("--out", default="voicebox-contract.json")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    captured: dict[str, Any] = {"baseUrl": base, "engine": args.engine, "voice": args.voice}

    print(f"\nVoicebox contract probe → {base}\n" + "-" * 52)

    # 1. Authoritative contract for THIS running version.
    status, openapi = request("GET", f"{base}/openapi.json")
    captured["openapi"] = openapi if status == 200 else {"status": status}
    if status == 200 and isinstance(openapi, dict):
        paths = sorted(openapi.get("paths", {}).keys())
        captured["paths"] = paths
        step("openapi.json", True, f"v{openapi.get('info', {}).get('version')} · {len(paths)} paths")
    else:
        step("openapi.json", False, f"HTTP {status}")
        show_body("body", openapi)

    gen_schema = request_schema(openapi, "/generate")
    captured["generateSchema"] = gen_schema
    print("       POST /generate accepts:" + describe_schema(gen_schema))

    # 2. Preset voices.
    status, presets = request("GET", f"{base}/profiles/presets/{args.engine}")
    captured["presets"] = {"status": status, "body": presets}
    step(f"presets/{args.engine}", status == 200, f"HTTP {status}")
    if status != 200:
        show_body("body", presets)

    # 3. A usable PRESET profile (cloned profiles need the multi-GB Qwen model).
    status, profiles = request("GET", f"{base}/profiles")
    captured["profilesBefore"] = {"status": status, "body": profiles}

    profile_id = None
    if isinstance(profiles, list):
        for candidate in profiles:
            if isinstance(candidate, dict) and candidate.get("voice_type") == "preset" \
                    and candidate.get("preset_voice_id"):
                if args.voice and candidate.get("preset_voice_id") != args.voice:
                    continue
                profile_id = find_id(candidate)
                if profile_id:
                    step("existing preset profile", True,
                         f"id={profile_id} voice={candidate.get('preset_voice_id')}")
                    break

    if not profile_id:
        voices = presets.get("voices", []) if isinstance(presets, dict) else []
        voice_id = args.voice or (voices[0].get("voice_id") if voices else None)
        if not voice_id:
            step("create preset profile", False, "no preset voice available")
            write(args.out, captured)
            return 1
        payload = {
            "name": args.profile_name,
            "voice_type": "preset",
            "preset_engine": args.engine,
            "preset_voice_id": voice_id,
            "language": "en",
        }
        status, created = request("POST", f"{base}/profiles", payload)
        captured["profileCreate"] = {"status": status, "request": payload, "response": created}
        profile_id = find_id(created)
        ok = status in (200, 201) and bool(profile_id)
        step("create preset profile", ok, f"HTTP {status} voice={voice_id} id={profile_id}")
        if not ok:
            show_body("400/error body", created)
            write(args.out, captured)
            return 1
        captured["profileObject"] = created

    captured["profileId"] = profile_id

    # 4. Generation — try schema-derived variants until one is accepted.
    generation_id = None
    attempts: list[dict[str, Any]] = []
    for index, body in enumerate(
        payload_variants(gen_schema, args.text, profile_id, args.engine, args.voice or None), 1
    ):
        status, generated = request("POST", f"{base}/generate", body)
        attempts.append({"request": body, "status": status, "response": generated})
        generation_id = find_id(generated)
        if status == 200 and generation_id:
            step("POST /generate", True, f"HTTP 200 id={generation_id} (variant {index})")
            captured["acceptedGenerateBody"] = body
            break
        step(f"POST /generate variant {index}", False, f"HTTP {status}")
        show_body("rejected because", generated, 600)
    captured["generateAttempts"] = attempts

    if not generation_id:
        print("\nNo variant accepted. The schema above and the rejection bodies show why.")
        write(args.out, captured)
        return 1

    # 5. Status stream — how completion and the audio reference are delivered.
    print("       (following the generation — the first run downloads a model)")
    events = read_sse(f"{base}/generate/{generation_id}/status")
    captured["statusEvents"] = events
    step("SSE status", bool(events), f"{len(events)} event(s)")
    for event in events[-3:]:
        print(f"       · {event[:200]}")

    final: dict[str, Any] | None = None
    statuses: list[Any] = []
    for payload in events:
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            final = parsed
            statuses.append(parsed.get("status"))
    captured["finalEvent"] = final
    captured["observedStatuses"] = statuses

    audio_url = extract_audio(final) if final else None
    captured["audioUrlFound"] = audio_url
    audio_source = "sse"
    if audio_url:
        step("audio in SSE event", True, audio_url)
        for key in AUDIO_KEYS:
            if isinstance(final, dict) and isinstance(final.get(key), str):
                captured["audioFieldName"] = key
                break
    else:
        step("audio in SSE event", False,
             "not carried by the stream — resolving via a separate endpoint")

        # The completed event carries no audio reference, so the finished audio
        # must be fetched separately. Discover the endpoint from the server's
        # own path list rather than guessing.
        paths = captured.get("paths") or []
        templated = [
            p for p in paths
            if "{" in p and any(w in p.lower() for w in ("generation", "generate", "audio"))
        ]
        captured["candidateAudioPaths"] = templated

        candidates: list[str] = []
        for path in templated:
            filled = path
            for token in ("{generation_id}", "{id}", "{gen_id}", "{generationId}"):
                filled = filled.replace(token, generation_id)
            if "{" not in filled:
                candidates.append(filled)
        # Conventional fallbacks in case the path list is templated oddly.
        for extra in (
            f"/generations/{generation_id}",
            f"/generate/{generation_id}",
            f"/generate/{generation_id}/audio",
            f"/generations/{generation_id}/audio",
            f"/audio/{generation_id}",
        ):
            if extra not in candidates:
                candidates.append(extra)

        probes: list[dict[str, Any]] = []
        for path in candidates:
            status, body = request("GET", f"{base}{path}")
            found = extract_audio(body) if isinstance(body, dict) else None
            is_audio_bytes = status == 200 and not isinstance(body, (dict, list))
            probes.append({
                "path": path,
                "status": status,
                "audioField": found,
                "returnedNonJson": is_audio_bytes,
            })
            if status == 200 and (found or is_audio_bytes):
                audio_url = found or path
                audio_source = path
                captured["audioEndpoint"] = path
                if found:
                    for key in AUDIO_KEYS:
                        if isinstance(body, dict) and isinstance(body.get(key), str):
                            captured["audioFieldName"] = key
                            break
                    step("audio located via endpoint", True, f"GET {path} -> {found}")
                else:
                    step("audio located via endpoint", True,
                         f"GET {path} returns the audio bytes directly")
                captured["audioEndpointBody"] = body if isinstance(body, dict) else "<binary>"
                break
        captured["audioEndpointProbes"] = probes

        if not audio_url:
            step("audio located", False, f"statuses seen: {statuses}")
            show_body("final SSE event", final)
            print("       tried these endpoints:")
            for entry in probes:
                print(f"         GET {entry['path']:48} HTTP {entry['status']}")

    captured["audioUrlFound"] = audio_url
    captured["audioSource"] = audio_source

    # 6. Cancellation — 400/404/409 is CORRECT once the generation is terminal.
    status, cancelled = request("POST", f"{base}/generate/{generation_id}/cancel")
    captured["cancel"] = {"status": status, "response": cancelled}
    step("POST cancel", status in (200, 204, 400, 404, 409),
         f"HTTP {status}" + (" (already terminal — expected)" if status in (400, 409) else ""))

    write(args.out, captured)
    print("-" * 52)
    print(f"Contract written to: {args.out}")
    if audio_url:
        print("\n  === THE ANSWER ===")
        print(f"  audio source   : {captured.get('audioSource')}")
        if captured.get("audioEndpoint"):
            print(f"  audio endpoint : GET {captured['audioEndpoint']}")
        if captured.get("audioFieldName"):
            print(f"  audio field    : {captured['audioFieldName']}")
        print(f"  audio value    : {audio_url}")
        print(f"  profile id     : {profile_id}")
    print()
    return 0


def write(path: str, payload: dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    sys.exit(main())
