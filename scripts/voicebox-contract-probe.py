#!/usr/bin/env python3
"""
Voicebox contract probe — Phase 0 gate, part B.

Completes the compatibility gate by exercising the FULL generation lifecycle
against a live local Voicebox instance and capturing its exact API contract:

    openapi -> presets -> create profile -> POST /generate -> SSE status -> cancel

The HTML probe (public/voicebox-probe.html) answers the BROWSER boundary
question (CORS / Private Network Access). This script answers the CONTRACT
question — the precise request/response shapes the transport must be built
against — without a browser in the way.

Run on the Founder's Mac with Voicebox running:

    python3 scripts/voicebox-contract-probe.py

Optional:
    --base-url http://127.0.0.1:17493
    --engine kokoro
    --out docs/integrations/voicebox-contract.json

Stdlib only. Read-mostly: it creates one voice profile (required — /generate
rejects requests without a profile_id) and cancels the generation it starts.
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
# can take minutes. The status stream therefore gets a much longer budget than
# ordinary requests.
STREAM_TIMEOUT = 600


def request(
    method: str, url: str, body: dict[str, Any] | None = None
) -> tuple[int, Any]:
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


def find_id(payload: Any) -> str | None:
    """Voicebox may name the generation id differently across versions."""
    if not isinstance(payload, dict):
        return None
    for key in ("id", "generation_id", "generationId", "job_id", "jobId"):
        value = payload.get(key)
        if isinstance(value, (str, int)):
            return str(value)
    return None


def read_sse(url: str, max_events: int = 40) -> list[str]:
    """Read the status stream until a terminal event or the timeout."""
    events: list[str] = []
    terminal = ("complete", "done", "ready", "error", "failed", "cancel")
    try:
        with urllib.request.urlopen(url, timeout=STREAM_TIMEOUT) as stream:
            for raw_line in stream:
                line = raw_line.decode(errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                events.append(payload[:400])
                if any(word in payload.lower() for word in terminal):
                    break
                if len(events) >= max_events:
                    break
    except Exception as error:  # noqa: BLE001
        events.append(f"<stream ended: {type(error).__name__}: {error}>")
    return events


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:17493")
    parser.add_argument("--engine", default="kokoro")
    parser.add_argument("--text", default="Nehemiah contract probe.")
    parser.add_argument("--out", default="voicebox-contract.json")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    captured: dict[str, Any] = {"baseUrl": base, "engine": args.engine}

    def step(label: str, ok: bool, detail: str = "") -> None:
        print(f"[{'PASS' if ok else 'FAIL'}] {label}{' — ' + detail if detail else ''}")

    print(f"\nVoicebox contract probe → {base}\n" + "-" * 52)

    # 1. Authoritative contract for THIS running version.
    status, openapi = request("GET", f"{base}/openapi.json")
    captured["openapi"] = openapi if status == 200 else {"status": status}
    if status == 200 and isinstance(openapi, dict):
        paths = sorted(openapi.get("paths", {}).keys())
        captured["paths"] = paths
        version = openapi.get("info", {}).get("version")
        step("openapi.json", True, f"v{version} · {len(paths)} paths")
    else:
        step("openapi.json", False, f"HTTP {status}")

    # 2. Preset voices for the engine.
    status, presets = request("GET", f"{base}/profiles/presets/{args.engine}")
    captured["presets"] = {"status": status, "body": presets}
    step(f"presets/{args.engine}", status == 200, f"HTTP {status}")

    # 3. Reuse an existing profile if present; otherwise create one.
    status, profiles = request("GET", f"{base}/profiles")
    captured["profilesBefore"] = {"status": status, "body": profiles}
    profile_id = None
    if isinstance(profiles, list) and profiles:
        profile_id = find_id(profiles[0])
        step("existing profile", bool(profile_id), f"id={profile_id}")

    if not profile_id:
        payload: dict[str, Any] = {"name": "Nehemiah", "engine": args.engine}
        preset_body = captured["presets"]["body"]
        candidates = (
            preset_body
            if isinstance(preset_body, list)
            else preset_body.get("presets", preset_body.get("voices", []))
            if isinstance(preset_body, dict)
            else []
        )
        if candidates and isinstance(candidates[0], dict):
            voice = candidates[0].get("voice_id") or candidates[0].get("id")
            if voice:
                payload["voice_id"] = voice
        status, created = request("POST", f"{base}/profiles", payload)
        captured["profileCreate"] = {"status": status, "request": payload, "response": created}
        profile_id = find_id(created)
        step("create profile", status in (200, 201) and bool(profile_id),
             f"HTTP {status} id={profile_id}")

    if not profile_id:
        print("\nNo usable profile_id — cannot exercise /generate.")
        print("Inspect 'presets' and 'profileCreate' in the output file.")
        write(args.out, captured)
        return 1

    captured["profileId"] = profile_id

    # 4. Generation — the shape the transport must send.
    body = {"text": args.text, "profile_id": profile_id, "language": "en"}
    status, generated = request("POST", f"{base}/generate", body)
    captured["generate"] = {"status": status, "request": body, "response": generated}
    generation_id = find_id(generated)
    step("POST /generate", status == 200 and bool(generation_id),
         f"HTTP {status} id={generation_id}")

    # 5. Status stream — how completion and the audio reference are delivered.
    if generation_id:
        events = read_sse(f"{base}/generate/{generation_id}/status")
        captured["statusEvents"] = events
        step("SSE status", bool(events), f"{len(events)} event(s)")
        if events:
            print("       last: " + events[-1][:120])

        # 6. Cancellation — required for latest-request-wins.
        # HTTP 400/404/409 are CORRECT when the generation already reached a
        # terminal state (completed/failed) — there is nothing left to cancel.
        # Only a 5xx or a transport error is a real problem here.
        status, cancelled = request("POST", f"{base}/generate/{generation_id}/cancel")
        captured["cancel"] = {"status": status, "response": cancelled}
        step(
            "POST cancel",
            status in (200, 204, 400, 404, 409),
            f"HTTP {status}" + (" (already terminal — expected)" if status == 400 else ""),
        )

    write(args.out, captured)
    print("-" * 52)
    print(f"Contract written to: {args.out}")
    print("Paste that file (or its key sections) back to continue the build.\n")
    return 0


def write(path: str, payload: dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    sys.exit(main())
