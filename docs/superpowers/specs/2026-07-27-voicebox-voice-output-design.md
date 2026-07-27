# Voicebox Voice Output (Phase 0) — Design

**Date:** 2026-07-27
**Status:** Approved for implementation planning
**Scope:** One PR. First slice of the long-horizon "Jarvis" voice roadmap.

## Purpose

Give Nehemiah a voice. Today the Founder shell renders narrative copy at each
state transition (focus, decision, action, proof) but says nothing aloud, and
the `voice-button` in `nehemiah-shell.tsx` is a stub that fakes listening by
setting hardcoded text. This slice makes Nehemiah **speak** its narrative aloud
through [Voicebox](https://voicebox.sh) — a free, open-source, local-first TTS
studio the Founder already runs on their own Mac — instead of a paid cloud TTS
API. Text-to-speech only; the Founder still types input this slice.

This is **Phase 0** of a phased roadmap (see "Jarvis roadmap" below). It is the
foundation every later phase depends on: an assistant cannot feel like Jarvis
until it can talk, and every later phase reuses the browser→local-machine
boundary this slice establishes.

## Why Voicebox, and why client-side

Voicebox runs a local FastAPI server on the Founder's own machine (default
`http://127.0.0.1:17493`) exposing `POST /generate` (TTS), `GET /profiles`, a
per-generation status stream (`GET /generate/{id}/status`, Server-Sent Events),
and `POST /generate/{id}/cancel`. It is powered by Qwen3-TTS, runs entirely
offline, and costs nothing per call — the cost-reduction motive versus a metered
cloud TTS API.

**`/generate` is asynchronous.** It does not block and play audio itself — it
enqueues the request and returns a generation **id**. Audio becomes available via
the status stream, which yields the completed audio (an `audioUrl` / audio id the
client fetches). In Voicebox's own desktop app the React frontend owns playback
(its `playerStore` tracks `audioUrl`/`isPlaying`). Nehemiah's browser must do the
same: POST, resolve the finished audio, and **play it through a browser `Audio`
element**. (Exact response field names are read from the running instance's
`/docs` during implementation — see the plan's first task.)

Because Voicebox is bound to `127.0.0.1` on the Founder's laptop and Nehemiah's
server is deployed on Vercel, **the server can never reach Voicebox**. The only
component co-located with Voicebox is the Founder's browser. Therefore this
integration is **client-side**: the browser calls the Founder's own local
Voicebox instance directly.

This is a deliberate, documented exception to two existing repo patterns:

- Every existing `*-client.ts` calls Nehemiah's own same-origin `/api/...`
  routes. This client calls a **different origin** (`127.0.0.1:17493`).
- The Gmail/Calendar/Drive integrations use the "trusted integration bridge"
  pattern (external cloud sender → Nehemiah ingest route + rotating keys). That
  pattern does **not** apply here: Voicebox is local-only and never sends to
  Nehemiah. Nothing about this integration touches a Nehemiah API route, a
  secret, or server code.

## Architecture

New client-side module: **`src/nehemiah/voice/`**

```
src/nehemiah/voice/
  voicebox-client.ts   # pure fetch wrapper around the local Voicebox HTTP API
  voice-output.ts      # controller the UI uses: dedupe + fail-closed no-op
  config.ts            # reads NEXT_PUBLIC_VOICEBOX_* env, one place
  index.ts             # public surface
  voicebox-client.test.ts
  voice-output.test.ts
```

### `config.ts`

Reads client-visible configuration (the repo's first `NEXT_PUBLIC_*` vars — all
existing config is server-only):

- `NEXT_PUBLIC_VOICEBOX_ENABLED` — `"true"` to enable; **defaults off**.
- `NEXT_PUBLIC_VOICEBOX_URL` — base URL; defaults `http://127.0.0.1:17493`.
- `NEXT_PUBLIC_VOICEBOX_PROFILE_ID` — optional voice profile; omitted → server
  default voice.

Exposes a single `readVoiceConfig()` returning a typed, validated object, so no
other file reads `process.env` directly.

### `voicebox-client.ts`

Pure, injectable HTTP wrapper. No React, no app state. `fetch` is injectable for
tests.

- `checkConnection(): Promise<boolean>` — short-timeout (`AbortController`,
  ~1.5s) `GET {url}/profiles`. Returns `true`/`false`; never throws.
- `synthesize(text, opts): Promise<SynthResult>` — the async TTS handshake:
  `POST {url}/generate` → read the returned id → resolve the finished audio via
  the status stream (with an overall timeout) → return
  `{ ok: true, audioUrl }` or `{ ok: false, reason }`. Never throws. Fetch/
  EventSource are injectable for tests. Does **not** play audio — it only
  produces a playable URL, keeping the network layer free of DOM/audio concerns.

Every failure mode (server down, CORS blocked, timeout, non-2xx, generation
error) resolves to a "not spoken" result — voice is an enhancement, never a gate.

Playback itself lives in `voice-output.ts` (below), which owns the single
`Audio` element — the only DOM/browser-API dependency in the module.

### `voice-output.ts`

The controller the UI actually calls. Holds the small amount of state that keeps
voice from being annoying:

- `speakNarrative(text): Promise<void>` — the single entry point.
  - No-op immediately (no fetch at all) when config is disabled.
  - **Dedupe:** ignores text identical to the last spoken text, so React
    re-renders don't re-speak the same sentence.
  - Calls `synthesize(text)`; on `{ ok: true, audioUrl }` plays it through a
    single reused `Audio` element. A new narrative **interrupts** the previous
    one (pause + replace src), so state changes don't stack overlapping speech.
  - Fail-closed: swallows all errors to a single debug-level log; never throws,
    never blocks the UI thread.
- Owns the one `Audio` element and lazy connection cache; a failed check
  disables further attempts for that session-tick without spamming the network.
- Guarded for SSR: no `Audio`/`window` access at module load, only inside
  `speakNarrative` (browser-only), so the server build and tests stay clean.

### Wiring in `nehemiah-shell.tsx`

1. A small pure selector, `narrativeForState(model, journey)`, maps the current
   `journey.lifecycle` to the narrative string the UI already displays:
   focus `body`, decision `sections` joined, `actionMessage`, `proofMessage`.
   Lives next to the component and is unit-tested.
2. A `useEffect` keyed on that derived string calls `speakNarrative(text)`
   whenever it changes.

The existing `voice-button` stub is **left as-is** this slice — it concerns
input (Phase 1), not output. No behavior it drives is removed.

## Data flow

```
journey.lifecycle changes
  → narrativeForState() derives the display string (already rendered on screen)
  → useEffect fires speakNarrative(text)
      → disabled?           → return (nothing happens)
      → same as last text?  → return (dedupe)
      → checkConnection()   → false → return (Voicebox not running; silent)
      → synthesize(text)    → POST /generate → resolve id via status stream → audioUrl
      → play audioUrl in a browser Audio element (interrupting any prior speech)
```

Text is what Nehemiah **already shows**. When the live-AI executor slice lands
later, the only change is the *source* of that text; the speak path is unchanged.

## Error handling

- **Voicebox not running** (the default state before the Founder opens the app):
  `checkConnection()` returns false; the UI is completely unaffected.
- **CORS:** the browser calling `127.0.0.1` from a Vercel-hosted origin may be
  blocked depending on Voicebox's CORS headers. Behavior is identical to "not
  running" — silent no-op. The docs cover enabling local access; if it cannot be
  enabled, Phase 0 degrades to silent and nothing breaks. (Confirming Voicebox's
  CORS posture is an explicit task in the implementation plan.)
- **Malformed / very long text:** client caps length defensively before POST.
- No error surfaces to the Founder and no `console.error` spam — at most one
  debug log per failed attempt.

## Testing

Everything runs offline with `fetch` injected — no network, no real Voicebox.

- `voicebox-client.test.ts`: `synthesize` posts the right body and resolves the
  audioUrl from an injected status stream; unreachable server → `{ ok: false }`
  not a throw; timeout via aborted fetch → handled; a generation error from the
  stream → `{ ok: false }`; `checkConnection` true/false paths.
- `voice-output.test.ts`: disabled config → zero fetch calls; dedupe suppresses
  identical consecutive text; a failed connection check disables the attempt;
  synth failure never propagates. The `Audio` element is injected/mocked so
  playback is asserted without a real browser.
- `narrativeForState` selector test: each lifecycle maps to the expected string;
  states with no narrative yield empty (and therefore speak nothing).

Matches the repo convention (every module has a colocated `.test.ts`) and lands
clean under `npm run gate` (test + typecheck + governance:organism + build).

## Configuration & setup (Founder's Mac)

Voicebox is already running on the Founder's Mac; **no Nehemiah-side setup has
been done yet.** This slice adds:

1. `.env.example` entries for the three `NEXT_PUBLIC_VOICEBOX_*` vars, documented
   and defaulted off.
2. `docs/integrations/voicebox.md` — setup guide, explicitly framed as a
   **Founder-machine-local** integration distinct from the trusted-bridge
   integrations: how to confirm Voicebox is listening on `17493`, how to set the
   env vars, how to pick a profile id, and the CORS note.

## Governance / authority note

Nehemiah's charter: it "prepares consequential decisions ... without
autonomously approving or executing enterprise decisions." Phase 0 only makes
the assistant **speak text it already displays**. It touches no decision gate,
no authorization domain, no Founder data, and no server code. It is purely
additive and fail-closed. The autonomy tension in the Jarvis vision lives in a
later phase (proactive action) and is explicitly out of scope here.

## Out of scope (this PR)

- Speech-to-text / dictation / "always listening" (Phase 1).
- Wiring the live AI model executor (Phase 2) — voice speaks existing static
  narrative until that lands.
- Voice profile picker UI, multi-voice personalities, Voicebox MCP server usage.
- Any change to the Founder decision gate or governance behavior.

## Jarvis roadmap (tracked, not built here)

| Phase | Delivers | Depends on |
|---|---|---|
| **0. Voice out** *(this spec)* | Nehemiah speaks its narrative via local Voicebox TTS | none — buildable now |
| **1. Always listening** | Continuous mic capture + live STT replaces the fake command stub | Phase 0 boundary shape |
| **2. Real reasoning** | Wire the AI executor to a live model (currently synthetic/injected) | independent; downstream of it |
| **3. Ambient/proactive surfacing** | Watch context (calendar, decisions, memory) and volunteer support unprompted — inside the decision gate, never bypassing it | Phase 2 |
| **4. Full loop** | Listen → reason → proactively surface → speak, continuously | Phases 0–3 |

Each later phase is its own spec → plan → implementation cycle.

## Success criteria

- With Voicebox running and the flag on, advancing through the Founder journey
  causes each state's narrative to be spoken aloud once (no repeats on
  re-render).
- With the flag off, or Voicebox not running, the app behaves exactly as it does
  today — no errors, no UI change, no blocked interactions.
- `npm run gate` passes.
