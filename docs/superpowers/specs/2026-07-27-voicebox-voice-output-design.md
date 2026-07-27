# Voicebox Voice Output Phase 0 — Founder-Controlled Nehemiah Speech

**Date:** 2026-07-27
**Status:** Approved with material revisions — pre-implementation
**Scope:** The first governed speech layer for the MiP intelligence system.
Text-to-speech output only. May be delivered as a compatibility-probe gate
followed by one or more build PRs (see "Delivery shape").

## Purpose

Give **Nehemiah** a voice — a calm, present, executive speaking presence — using
[Voicebox](https://voicebox.sh), the free, local-first TTS studio the Founder
already runs on their Mac, instead of a paid cloud TTS API. This is
**Phase 0** of the MiP Voice Interaction Roadmap: the foundation every later
voice capability depends on, and the first place MiP establishes a governed
boundary between what an executive AI *says*, how it *sounds*, and how the
speech system *works in production*.

Voice should make Nehemiah feel **present, aware, and responsive without becoming
intrusive, theatrical, or dependent on imitation.** It is an optional
enhancement: the interface never depends on it and never blocks on it.

## Authority model (roster-informed)

The roster (`docs/roster/`) sets the governing split for this layer:

> **Nehemiah is the speaker. Anakin governs what the voice communicates and how
> it feels. Mercado governs how the voice system works and survives production.**

- **Nehemiah** — the sole audible voice; synthesizes agent intelligence into one
  executive statement.
- **Anakin** (with **Miller** language, **Jony** emotional character, **Norman**
  cognitive load, **Esther** non-intrusiveness) — governs spoken *meaning* and
  *experience*.
- **Mercado** (with **Hopper** implementation, **Hamilton** reliability,
  **Leonidas** security/privacy, **Fei-Fei** human-centered behavior) — governs
  the provider, playback, and platform *engineering*.

Operating agents contribute intelligence. Nehemiah synthesizes. Nehemiah speaks.
No separate voices for Alexander, Galileo, Socrates, Jobs, etc., in Phase 0;
differentiated voices require separate Founder approval.

## Why Voicebox, and why client-side (unchanged, sound)

Voicebox runs a local FastAPI server on the Founder's machine (default
`http://127.0.0.1:17493`): `POST /generate` (async TTS), `GET /profiles`, a
per-generation SSE status stream (`GET /generate/{id}/status`), and
`POST /generate/{id}/cancel`. Powered by Qwen3-TTS, fully offline, zero per-call
cost — the cost-reduction motive versus metered cloud TTS.

Because Voicebox binds to loopback on the Founder's laptop and Nehemiah is
deployed on Vercel, **only the Founder's browser can reach Voicebox**. This is a
deliberate, documented client-side integration and a deliberate exception to the
repo's same-origin `*-client.ts` pattern and the trusted-bridge integration
pattern (Gmail/Calendar/Drive). Nothing here touches a Nehemiah API route, a
server secret, or server code.

**`/generate` is asynchronous.** It returns a generation **id**; the finished
audio is resolved via the status stream, and the **client** fetches and plays it
through a browser `Audio` element. Nehemiah's browser owns playback, exactly as
Voicebox's own desktop frontend does.

## What remains unchanged from the prior design

TTS-only in Phase 0 · Voicebox local-first · client-side integration · no server
secret or Nehemiah API route · voice optional and non-blocking · one reusable
playback controller · no multi-voice personalities · injected browser APIs for
deterministic testing · no change to Founder decision authority.

## Delivery shape

1. **Gate — deployed-origin compatibility probe** (Task 1, below). A minimal
   probe run *from the actual deployed Nehemiah origin* on the Founder's Mac,
   proving the browser→loopback boundary and capturing the exact Voicebox API
   contract as fixtures/types. **Go/no-go before the transport build.**
2. **Build** — the platform speech layer + Nehemiah speech authoring + Founder
   controls. Given its size, the build may be split into sub-PRs (platform
   provider/playback; Nehemiah utterance authoring + policy; Founder controls
   UI), each landing green under `npm run gate`. **Boundary-independent work
   (contract types, Voice Constitution, `voiceUtteranceForState`, pronunciation,
   policy, their tests) does not wait on the probe** — it is pure and testable
   without Voicebox, so it proceeds in parallel with the gate. Only the provider
   *transport* is gated by the probe result.

### Browser compatibility (not Mac-single-browser)

The design must not assume Safari or Chromium. The Founder uses **whichever
browser passes the probe**, and the provider is written browser-agnostically.
The probe records a per-browser matrix, because the browser→loopback boundary
differs sharply by engine:

| Browser | Known risk on public-origin → `127.0.0.1` |
|---|---|
| **Firefox** | Historically the most permissive to loopback; no full PNA enforcement — a likely reliable path |
| **Chrome / Edge / Brave (Chromium)** | Private Network Access (PNA) can block HTTPS-public → private subrequests; may require a preflight Voicebox must answer |
| **Safari** | macOS Local Network permission prompt + its own local-network restrictions |

The probe is authored once and run in each available browser; the matrix result
selects the supported set and the transport strategy. If no browser passes
directly, the fallback options (documented, not built yet) are: run Nehemiah from
`localhost` in the Founder's session, or a tiny local shim/proxy — decided from
the matrix, never guessed.

## Architecture

### Directory layout (voice is a Mercado-governed platform capability)

```
src/platform/speech/
  types.ts                 # VoiceUtterance, SpeechOutcome, failure reasons
  config.ts                # capability flag + validated loopback config
  speech-policy.ts         # length cap, content safety, locale validation
  speech-orchestrator.ts   # enabled? auto-speak? deduped? superseded? unlocked?
  playback-controller.ts   # single Audio element, latest-wins, Blob lifecycle
  providers/
    voicebox-provider.ts   # typed async handshake against loopback Voicebox
  index.ts                 # public surface
  *.test.ts

src/nehemiah/speech/
  voice-utterance-for-state.ts   # authored spoken copy per journey state
  nehemiah-voice-policy.ts       # Nehemiah Voice Constitution (versioned)
  pronunciation-dictionary.ts    # speech-only pronunciation transforms
  *.test.ts
```

### Structured speech contract

Raw strings are too weak for a governed executive voice. The unit of speech is a
structured utterance:

```ts
type VoiceUtterance = {
  id: string;                 // stable transition identity (see dedupe)
  speaker: "NEHEMIAH";        // the only audible speaker in Phase 0
  sourceAgents?: string[];    // provenance, e.g. ["ALEXANDER","GALILEO"] — not spoken
  journeyId?: string;
  lifecycle: JourneyLifecycle;
  text: string;               // authored spoken copy, NOT display copy
  locale: "en-US" | "es-US";
  priority: "ambient" | "normal" | "important";
  interruption: "replace" | "queue" | "ignore";
  expiresAt?: number;
};

type SpeechFailureReason =
  | "network" | "timeout" | "generation-error"
  | "invalid-audio-origin" | "audio-decode" | "provider-unavailable";

type SpeechOutcome =
  | { status: "spoken" }
  | { status: "disabled" }
  | { status: "deduped" }
  | { status: "cancelled" }
  | { status: "unavailable" }
  | { status: "autoplay-blocked" }
  | { status: "failed"; reason: SpeechFailureReason };
```

The UI may ignore the outcome; tests, diagnostics, and future orchestration must
not lose it.

### Spoken narrative is authored, not scraped from the screen

Screen copy and spoken copy are different media. Nehemiah must not become a
screen reader reciting everything displayed. Replace the prior
`narrativeForState()` (which joined display copy) with:

```ts
voiceUtteranceForState(model, journey): VoiceUtterance | null
```

Each state gets intentionally authored spoken output (~20–45 words, one or two
sentences, no lists, no interface labels, no raw JSON/URLs/code/errors):

| State | Spoken behavior |
|---|---|
| **Focus** | One calm orientation sentence |
| **Decision** | The decision summary + the question requiring Founder judgment |
| **Action** | One concise next action |
| **Proof** | A restrained acknowledgment of verified progress |
| **Blocked** | What is blocked and the one thing needed |
| **No meaningful change** | Silence (returns `null`) |

### Nehemiah Voice Constitution

A versioned artifact `src/nehemiah/speech/nehemiah-voice-policy.ts` defines the
voice character (governed by Anakin/Jony/Miller/Norman/Esther):

Nehemiah sounds: calm, grounded, intelligent, deliberate, warm without
sentimentality, authoritative without domination, concise, unhurried, certain
only when evidence permits. Never: theatrical, militarized, over-excited,
robotic, sales-y, constantly congratulatory, omniscient, an impersonation, or
emotionally dependent on the Founder's attention.

State delivery: Focus — calm/orienting · Decision — clear/measured · Action —
direct/concise · Warning — serious without alarmism · Proof — warm but
restrained · Uncertainty — explicit and honest.

The policy module validates locale, applies pronunciation, caps length without
cutting words, and blocks unsafe/unsuitable content before synthesis.

### Pronunciation layer

`pronunciation-dictionary.ts` transforms **speech output only** — never display
text, records, or citations:

```ts
type PronunciationEntry = { written: string; spoken: string };
// e.g. { written: "MiP", spoken: "M I P" }, { written: "Fei-Fei", spoken: "Fay Fay" },
//      { written: "Sun Tzu", spoken: "Sun Zoo" }
```

Covers at minimum: MiP, Nehemiah, Anakin, Mercado, Fei-Fei, Voss, Jony, Sun Tzu.

### Provider: validated loopback + audio-origin safety

`voicebox-provider.ts` performs the typed async handshake and never blindly
plays a returned URL. Playback path:

```
POST /generate (validated loopback origin)
 → generation id
 → SSE status stream (timeout + cancellation)
 → audio endpoint → fetch bytes → verify content-type + max size
 → create local blob: URL → play → revoke on completion/replacement
```

Accepted audio sources: a client-created `blob:` URL, or the configured,
validated Voicebox loopback origin. Configuration is restricted to approved
loopback hosts — `127.0.0.1`, `localhost`, `[::1]`. An arbitrary
`NEXT_PUBLIC_VOICEBOX_URL` is **rejected in a production build** without an
explicit development override. (This is a genuine **fail-closed** boundary — see
terminology below.)

### Playback: latest-request-wins + cancellation

The orchestrator/playback layer must defeat the stale-audio race:

- Track the active generation id and a monotonic request sequence.
- On supersession: `POST /generate/{id}/cancel`, close the old SSE, abort its
  fetches, increment the sequence, and ignore any result not matching the
  current sequence.
- Stop and replace currently-playing audio when policy says `replace`.

This is a **mandatory tested behavior**, not an implementation detail.

### Deduplication by transition identity

Dedupe on utterance identity, not text equality:

```ts
utterance.id = `${journeyId}:${lifecycle}:${stateRevision}:${locale}`;
```

A text hash may be retained as a secondary guard. This prevents re-speaking on
trivial wording changes and allows the same wording to legitimately speak again
in a new journey.

### Connection recovery (no permanent disable)

Voice must recover if Voicebox starts *after* Nehemiah, without a page reload:

- Negative connection cache: **30–60s** (not permanent).
- Exponential backoff on repeated failures; success resets backoff.
- Immediate retry when the Founder enables voice or clicks **Reconnect Voicebox**.

## Founder control (capability flag ≠ user control)

Two distinct layers:

```
Capability flag (deployment):   NEXT_PUBLIC_VOICEBOX_ENABLED
Founder preference (runtime):   voiceOutput.autoSpeak = true | false
```

The Founder gets: voice available · auto-speak on/off · **stop speaking** ·
**replay last statement** · volume · optional speech speed · optional quiet mode.
Auto-speak may default on for the Founder after initial activation, but stays
visible and controllable. This also satisfies the browser requirement that
autoplay often needs an initial user gesture to unlock the audio session.

**The fake-listening button is removed.** Once real voice output exists, no
control may pretend to listen. Phase 0: a speaker control manages output; the
microphone control is visibly disabled or labeled "coming later." (Input is
Phase 1.)

## Voice profile pinning

Once the Founder approves a voice, do not silently ride Voicebox's server
default:

```
NEXT_PUBLIC_VOICEBOX_ENABLED
NEXT_PUBLIC_VOICEBOX_URL
NEXT_PUBLIC_VOICEBOX_PROFILE_ID
NEXT_PUBLIC_VOICEBOX_PROFILE_VERSION
```

Pin the exact profile id, record version/hash + language/pronunciation settings,
and degrade **silently to text-only** when the approved profile is absent. In
production-style Founder builds, `PROFILE_ID` is **required** when voice is
enabled.

## Terminology: fail-safe vs fail-closed

For this optional feature, use **fail-safe / non-blocking degradation / silent
optional-feature failure**: the interface keeps working, so relative to the app
the feature fails *open*. Reserve **fail-closed** (deny the operation) for its
correct uses here: invalid audio origin, unapproved configuration, security-
policy violation, scope/authority violation.

## Data flow (revised)

```
journey state changes
  → voiceUtteranceForState()   authored copy, stable id, sourceAgents, interruption policy
  → nehemiahVoicePolicy()      locale, pronunciation, length cap, content safety
  → speechOrchestrator.speak(utterance)
        enabled? auto-speak? already spoken (id)? newer request active? audio unlocked?
  → voiceboxProvider.generate()  validated loopback, typed contract, id, SSE, timeout, cancel
  → playbackController.play()    latest-wins, validate+fetch audio, blob URL, interrupt, cleanup
  → SpeechOutcome                spoken | disabled | deduped | cancelled | unavailable
                                 | autoplay-blocked | failed
```

## Error handling

Voicebox not running, CORS/private-network blocked, timeout, generation error,
autoplay blocked → the corresponding non-`spoken` `SpeechOutcome`, no thrown
error, no UI change, at most one debug log (never narrative text — see tests).
SSR-guarded: no `Audio`/`window` access at module load.

## Governance acceptance checklist (roster standards as review criteria)

These are **review/acceptance criteria**, not automated CI checks. `npm run gate`
(test + typecheck + governance:organism + build) remains the automated bar; the
below are human acceptance gates whose standards must be met:

| Responsibility | Roster authority |
|---|---|
| Voice should exist | Founder + Nehemiah |
| Meaning of spoken statements | Anakin |
| Spoken clarity and brevity | Miller |
| Voice personality / emotional character | Jony + Anakin |
| Usability and controls | Norman |
| Human-centered interaction | Fei-Fei |
| Provider / platform architecture | Mercado |
| Implementation | Hopper |
| Race conditions, recovery, certification | Hamilton |
| Local endpoint, audio-origin, privacy | Leonidas |
| Founder control and non-intrusiveness | Esther |
| Evidence voice improves the experience | Galileo |
| Cost and operational effect | Joseph |

## Testing

Existing coverage (disabled mode, dedupe, failed connectivity, synthesis
failure, state mapping, injected audio) **plus** these mandatory tests:

1. Old generation cannot play after a newer state wins.
2. New utterance cancels an in-flight Voicebox generation.
3. Disabling voice mid-generation cancels and prevents playback.
4. Autoplay rejection handled with no unhandled promise.
5. Dedupe uses utterance identity, not only text.
6. Negative connection cache expires; Voicebox reconnects.
7. Audio from an unapproved origin is rejected.
8. Blob URLs revoked after playback and replacement.
9. EventSource closed on completion, cancellation, timeout, and unmount.
10. No narrative text appears in production logs.
11. Length cap does not cut words or create malformed speech.
12. Spanish utterances use approved language/profile behavior.
13. Pronunciation replacement does not alter visible text.
14. Empty / whitespace-only utterances do nothing.
15. Missing Voicebox profile → text-only degradation.
16. Fake-listening behavior is not presented as real listening.
17. Browser-to-local compatibility probe passes from the deployed origin.

## Configuration & setup (Founder's Mac)

Voicebox is already running; no Nehemiah-side setup exists yet. This layer adds
the four `NEXT_PUBLIC_VOICEBOX_*` vars (documented, `ENABLED` default off) to
`.env.example`, and `docs/integrations/voicebox.md` framed as a Founder-machine-
local integration: confirming Voicebox on `17493`, the env vars, the pinned
profile, loopback restriction, and the CORS/private-network note.

## Governance / authority note

Phase 0 makes Nehemiah speak concise authored copy under explicit Founder
control. It touches no decision gate, no authorization domain, no Founder data,
and no server code; it is additive and non-blocking, with genuine fail-closed
boundaries only on audio origin and configuration. The autonomy tension in the
long-horizon vision lives in later phases (proactive surfacing) and stays out of
scope and behind Founder consent.

## MiP Voice Interaction Roadmap (tracked, not built here)

| Phase | Capability |
|---|---|
| **0** | Nehemiah voice output with explicit Founder controls *(this spec)* |
| **1** | Push-to-talk and local speech-to-text |
| **1B** | Optional session-scoped listening after explicit consent |
| **2** | Live reasoning connected to governed model execution |
| **3** | Context-aware suggestions with quiet hours + interruption policy |
| **4** | Founder-enabled conversational loop during an active session |
| **5** | Optional ambient mode — only after privacy, security, attention, and value evidence pass |

"Always listening" is never a default label or default behavior. The end state is
a **Founder-enabled, session-scoped listen → reason → surface → speak loop**, not
a continuously-on system. Each later phase is its own spec → plan → build cycle.

## Success criteria

- Nehemiah speaks **concise authored utterances**, not display copy.
- The Founder can enable, mute, stop, and replay voice.
- No stale generation plays after the state changes; no overlapping speech.
- The approved Nehemiah profile is used (pinned).
- Voicebox can start after Nehemiah and reconnect successfully.
- No unapproved remote audio URL is ever played.
- No raw narrative content enters logs or telemetry.
- English pronunciation tests pass.
- Voice remains entirely optional; with the flag off or Voicebox absent, the app
  behaves exactly as today.
- The fake-listening control is removed / disabled / accurately labeled.
- The deployed-origin compatibility probe passes in **at least one** supported
  browser, with the per-browser matrix recorded; the provider is
  browser-agnostic (no single-browser assumption in code).
- `npm run gate` passes.
- The Hamilton, Leonidas, Anakin, and Nehemiah acceptance criteria are met.
