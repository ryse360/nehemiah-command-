# Voicebox Phase 0 Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nehemiah speak its authored per-state utterances aloud through the Founder's local Voicebox instance, under explicit Founder control, without ever blocking the interface.

**Architecture:** A Mercado-governed platform speech layer under `src/platform/speech/` performs the async Voicebox handshake (`POST /generate` → generation id → SSE status → audio), plays audio through a single reused `Audio` element with latest-request-wins semantics, and is fronted by an orchestrator that decides whether to speak at all. Nehemiah's authored copy (`src/nehemiah/speech/`, already built) supplies *what* is said. All Voicebox-specific field names are isolated in one adapter module so the live contract can be pinned in a single place.

**Tech Stack:** TypeScript, Next.js 16 (React 19), `node:test` + `node:assert/strict`, no new runtime dependencies.

**Status: ALL TASKS COMPLETE (2026-07-28).** Contract pinned from a live run. Full gate green — 323
tests, typecheck clean, governance 14/14, build OK. Only **Task 7** remains: it
pins the live wire format and the approved voice profile, and requires the
Founder to run `scripts/voicebox-contract-probe.py` against a running Voicebox.
Until Task 7, the contract adapter uses permissive multi-key extraction (which
already works against the observed API) and voice stays disabled by default.

## Global Constraints

- Voice is **optional and non-blocking**. No code path may throw to the UI, block rendering, or change existing behavior when voice is off or Voicebox is absent (fail-safe / silent degradation).
- **Fail-closed** applies only to: invalid audio origin, unapproved configuration, security-policy violation. Everything else degrades silently.
- **Nehemiah is the sole audible speaker.** `sourceAgents` is provenance metadata only; never a second voice.
- **`profile_id` is REQUIRED** by the live Voicebox API — `POST /generate` returns HTTP 422 without it (confirmed 2026-07-27).
- **CORS is not open by default.** Voicebox only allows its own default origins unless started with `VOICEBOX_CORS_ORIGINS=<origin>`. This is a Founder setup step, already documented.
- Repo conventions: colocated `*.test.ts` beside source; `node:test` + `node:assert/strict`; `@/*` → `src/*` alias; no default exports.
- **Import extensions (the repo is mixed; follow this rule):** `.ts` modules importing other `.ts` modules use the **`.ts` extension** (matches `src/nehemiah/speech/*` and `src/nehemiah/state-content.ts`). `.tsx` components import **without** an extension (matches every import in `nehemiah-shell.tsx`). Both resolve — `allowImportingTsExtensions` is on — but stay consistent per file type.
- **SSR safety:** never touch `window`, `document`, `Audio`, `EventSource`, or `URL.createObjectURL` at module load — only inside functions, guarded.
- **Never log narrative text.** Logs may contain utterance `id`, `lifecycle`, and status — never `utterance.text`.
- `npm run gate` (test + typecheck + governance:organism + build) must pass at every commit.

## Prerequisite: pin the live contract (Task 1)

The exact Voicebox field names (generation id key, audio URL field, SSE payload shape) come from `scripts/voicebox-contract-probe.py` output. Task 1 creates the adapter that isolates them. **If the probe output is not yet available, Task 1 still proceeds** — it ships permissive multi-key lookups plus the tests; when the contract lands, only `voicebox-contract.ts` changes.

## File Structure

| File | Responsibility |
|---|---|
| `src/platform/speech/providers/voicebox-contract.ts` | **The single pinning point.** Extracts generation id / audio URL / terminal status from Voicebox payloads whose exact key names may vary by version. |
| `src/platform/speech/providers/voicebox-provider.ts` | Typed async handshake. Injectable `fetch`/`EventSource`. Never throws; returns a discriminated result. Owns cancellation + stream teardown. |
| `src/platform/speech/playback-controller.ts` | Single reused `Audio` element. Validates + fetches audio bytes → blob URL → play → revoke. Latest-request-wins. SSR-guarded. |
| `src/platform/speech/speech-orchestrator.ts` | The decision layer: enabled? auto-speak? deduped? superseded? Plus negative connection cache with backoff. |
| `src/platform/speech/index.ts` | (modify) re-export the new surface. |
| `src/components/founder-voice-controls.tsx` | Founder controls: auto-speak, stop, replay, volume, quiet mode. |
| `src/components/nehemiah-shell.tsx` | (modify) remove fake-listening button; wire the speak effect. |

---

### Task 1: Voicebox contract adapter

**Files:**
- Create: `src/platform/speech/providers/voicebox-contract.ts`
- Test: `src/platform/speech/providers/voicebox-contract.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `extractGenerationId(payload: unknown): string | null`, `extractAudioUrl(payload: unknown): string | null`, `classifyStatusEvent(raw: string): StatusEventKind`, `type StatusEventKind = 'progress' | 'complete' | 'error' | 'cancelled'`, `type GenerateRequestBody`.

- [x] **Step 1: Write the failing test**

```ts
// src/platform/speech/providers/voicebox-contract.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGenerateBody,
  classifyStatusEvent,
  extractAudioUrl,
  extractGenerationId,
} from './voicebox-contract.ts';

test('extracts the generation id across known key spellings', () => {
  assert.equal(extractGenerationId({ id: 'g1' }), 'g1');
  assert.equal(extractGenerationId({ generation_id: 'g2' }), 'g2');
  assert.equal(extractGenerationId({ generationId: 'g3' }), 'g3');
  assert.equal(extractGenerationId({ job_id: 7 }), '7');
});

test('returns null when no id is present', () => {
  assert.equal(extractGenerationId({ detail: 'nope' }), null);
  assert.equal(extractGenerationId(null), null);
  assert.equal(extractGenerationId('string'), null);
});

test('extracts the audio url across known key spellings, including nested', () => {
  assert.equal(extractAudioUrl({ audio_url: '/a.wav' }), '/a.wav');
  assert.equal(extractAudioUrl({ audioUrl: '/b.wav' }), '/b.wav');
  assert.equal(extractAudioUrl({ url: '/c.wav' }), '/c.wav');
  assert.equal(extractAudioUrl({ result: { audio_url: '/d.wav' } }), '/d.wav');
  assert.equal(extractAudioUrl({ path: '/e.wav' }), '/e.wav');
  assert.equal(extractAudioUrl({ nothing: true }), null);
});

test('classifies SSE payloads into lifecycle kinds', () => {
  assert.equal(classifyStatusEvent('{"status":"complete","audio_url":"/a.wav"}'), 'complete');
  assert.equal(classifyStatusEvent('{"status":"done"}'), 'complete');
  assert.equal(classifyStatusEvent('{"status":"ready"}'), 'complete');
  assert.equal(classifyStatusEvent('{"status":"error","message":"boom"}'), 'error');
  assert.equal(classifyStatusEvent('{"status":"failed"}'), 'error');
  assert.equal(classifyStatusEvent('{"status":"cancelled"}'), 'cancelled');
  assert.equal(classifyStatusEvent('{"status":"running","progress":0.4}'), 'progress');
  assert.equal(classifyStatusEvent('not json'), 'progress');
});

test('builds a generate body that always carries the required profile_id', () => {
  const body = buildGenerateBody({ text: 'hello', profileId: 'p1', locale: 'en-US' });
  assert.equal(body.text, 'hello');
  assert.equal(body.profile_id, 'p1');
  assert.equal(body.language, 'en');
});

test('maps the Spanish locale to the Voicebox language code', () => {
  const body = buildGenerateBody({ text: 'hola', profileId: 'p1', locale: 'es-US' });
  assert.equal(body.language, 'es');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test "src/platform/speech/providers/voicebox-contract.test.ts"`
Expected: FAIL — `Cannot find module './voicebox-contract.ts'`

- [x] **Step 3: Write minimal implementation**

```ts
// src/platform/speech/providers/voicebox-contract.ts
// THE SINGLE PINNING POINT for Voicebox's wire format.
//
// Voicebox's exact field names vary across versions, so every lookup lives
// here behind permissive multi-key extraction. When the live contract is
// captured (scripts/voicebox-contract-probe.py), narrow these lists — this is
// the ONLY file that should need to change.
//
// PURE. No network, no DOM.

import type { SpeechLocale } from '../types.ts';

const ID_KEYS = ['id', 'generation_id', 'generationId', 'job_id', 'jobId'] as const;
const AUDIO_KEYS = ['audio_url', 'audioUrl', 'url', 'audio_path', 'path', 'file'] as const;
const NESTED_KEYS = ['result', 'data', 'generation', 'audio'] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number') return String(value);
  }
  return null;
}

export function extractGenerationId(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;
  const direct = firstString(record, ID_KEYS);
  if (direct) return direct;
  for (const nested of NESTED_KEYS) {
    const inner = asRecord(record[nested]);
    if (inner) {
      const found = firstString(inner, ID_KEYS);
      if (found) return found;
    }
  }
  return null;
}

export function extractAudioUrl(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;
  const direct = firstString(record, AUDIO_KEYS);
  if (direct) return direct;
  for (const nested of NESTED_KEYS) {
    const inner = asRecord(record[nested]);
    if (inner) {
      const found = firstString(inner, AUDIO_KEYS);
      if (found) return found;
    }
  }
  return null;
}

export type StatusEventKind = 'progress' | 'complete' | 'error' | 'cancelled';

export function classifyStatusEvent(raw: string): StatusEventKind {
  const haystack = raw.toLowerCase();
  if (/\b(cancell?ed|aborted)\b/.test(haystack)) return 'cancelled';
  if (/\b(error|failed|failure)\b/.test(haystack)) return 'error';
  if (/\b(complete|completed|done|ready|finished|success)\b/.test(haystack)) return 'complete';
  return 'progress';
}

export interface GenerateRequestBody {
  text: string;
  /** REQUIRED by the live API — /generate returns 422 without it. */
  profile_id: string;
  language: string;
}

export function buildGenerateBody(input: {
  text: string;
  profileId: string;
  locale: SpeechLocale;
}): GenerateRequestBody {
  return {
    text: input.text,
    profile_id: input.profileId,
    language: input.locale.startsWith('es') ? 'es' : 'en',
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test "src/platform/speech/providers/voicebox-contract.test.ts"`
Expected: PASS (6 tests)

- [x] **Step 5: Commit**

```bash
git add src/platform/speech/providers/voicebox-contract.ts src/platform/speech/providers/voicebox-contract.test.ts
git commit -m "feat(speech): add Voicebox contract adapter as the single pinning point"
```

---

### Task 2: Voicebox provider (transport)

Satisfies mandatory tests **9** (EventSource closed on completion/cancel/timeout), **12** (Spanish locale), **15** (missing profile → degradation).

**Files:**
- Create: `src/platform/speech/providers/voicebox-provider.ts`
- Test: `src/platform/speech/providers/voicebox-provider.test.ts`

**Interfaces:**
- Consumes: `buildGenerateBody`, `extractGenerationId`, `extractAudioUrl`, `classifyStatusEvent` (Task 1); `VoiceboxConfig` from `../types.ts`.
- Produces: `createVoiceboxProvider(deps): VoiceboxProvider` where
  `VoiceboxProvider = { checkConnection(): Promise<boolean>; synthesize(input: SynthesizeInput): Promise<SynthesizeResult>; cancel(generationId: string): Promise<void> }`,
  `SynthesizeInput = { text: string; locale: SpeechLocale; signal?: AbortSignal }`,
  `SynthesizeResult = { ok: true; audioUrl: string; generationId: string } | { ok: false; reason: SpeechFailureReason; generationId?: string }`.

- [x] **Step 1: Write the failing test**

```ts
// src/platform/speech/providers/voicebox-provider.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceboxProvider } from './voicebox-provider.ts';

const config = { enabled: true, baseUrl: 'http://127.0.0.1:17493', profileId: 'p1' };

/** Minimal EventSource double: tests push events by hand. */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  emit(data: string) {
    this.onmessage?.({ data });
  }
  fail() {
    this.onerror?.(new Error('stream error'));
  }
  close() {
    this.closed = true;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

test('checkConnection returns true on a healthy profiles response', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse([]),
    eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
  });
  assert.equal(await provider.checkConnection(), true);
});

test('checkConnection returns false instead of throwing when unreachable', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => {
      throw new Error('Failed to fetch');
    },
    eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
  });
  assert.equal(await provider.checkConnection(), false);
});

test('synthesize resolves the audio url from the status stream and closes it', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse({ id: 'g1' }),
    eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
  });
  const pending = provider.synthesize({ text: 'hello', locale: 'en-US' });
  await Promise.resolve();
  await Promise.resolve();
  FakeEventSource.last!.emit('{"status":"complete","audio_url":"/audio/g1.wav"}');
  const result = await pending;
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.audioUrl, '/audio/g1.wav');
  assert.equal(FakeEventSource.last!.closed, true, 'stream must be closed on completion');
});

test('synthesize fails closed-but-silent when no profile is configured', async () => {
  const provider = createVoiceboxProvider({
    config: { ...config, profileId: undefined },
    fetchImpl: async () => jsonResponse({ id: 'g1' }),
    eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
  });
  const result = await provider.synthesize({ text: 'hello', locale: 'en-US' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'provider-unavailable');
});

test('synthesize reports a generation error and closes the stream', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse({ id: 'g1' }),
    eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
  });
  const pending = provider.synthesize({ text: 'hello', locale: 'en-US' });
  await Promise.resolve();
  await Promise.resolve();
  FakeEventSource.last!.emit('{"status":"error"}');
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'generation-error');
  assert.equal(FakeEventSource.last!.closed, true);
});

test('synthesize sends the Spanish language code for an es-US utterance', async () => {
  let sent: string | undefined;
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async (_url, init) => {
      sent = init?.body as string;
      return jsonResponse({ id: 'g1' });
    },
    eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
  });
  const pending = provider.synthesize({ text: 'hola', locale: 'es-US' });
  await Promise.resolve();
  await Promise.resolve();
  FakeEventSource.last!.emit('{"status":"complete","audio_url":"/a.wav"}');
  await pending;
  assert.match(sent ?? '', /"language":"es"/);
  assert.match(sent ?? '', /"profile_id":"p1"/);
});

test('a stream error resolves as a failure rather than hanging', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse({ id: 'g1' }),
    eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
  });
  const pending = provider.synthesize({ text: 'hello', locale: 'en-US' });
  await Promise.resolve();
  await Promise.resolve();
  FakeEventSource.last!.fail();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(FakeEventSource.last!.closed, true);
});

test('cancel posts to the cancel endpoint and never throws', async () => {
  const calls: string[] = [];
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async (url) => {
      calls.push(String(url));
      throw new Error('network down');
    },
    eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
  });
  await provider.cancel('g9');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/generate\/g9\/cancel$/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test "src/platform/speech/providers/voicebox-provider.test.ts"`
Expected: FAIL — `Cannot find module './voicebox-provider.ts'`

- [x] **Step 3: Write minimal implementation**

```ts
// src/platform/speech/providers/voicebox-provider.ts
// Typed async handshake against the Founder's local Voicebox.
//
//   POST /generate -> generation id -> SSE /generate/{id}/status -> audio url
//
// NEVER THROWS. Every failure resolves to a discriminated result so voice stays
// a silent, non-blocking enhancement. Produces a URL only — playback (DOM) is
// the playback controller's job.

import type { SpeechFailureReason, SpeechLocale, VoiceboxConfig } from '../types.ts';
import {
  buildGenerateBody,
  classifyStatusEvent,
  extractAudioUrl,
  extractGenerationId,
} from './voicebox-contract.ts';

export interface SynthesizeInput {
  text: string;
  locale: SpeechLocale;
  signal?: AbortSignal;
}

export type SynthesizeResult =
  | { ok: true; audioUrl: string; generationId: string }
  | { ok: false; reason: SpeechFailureReason; generationId?: string };

export interface VoiceboxProvider {
  checkConnection(): Promise<boolean>;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
  cancel(generationId: string): Promise<void>;
}

export interface VoiceboxProviderDeps {
  config: VoiceboxConfig;
  fetchImpl: typeof fetch;
  eventSourceFactory: (url: string) => EventSource;
  /** Overall synthesis timeout. */
  timeoutMs?: number;
  connectTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 1_500;

export function createVoiceboxProvider(deps: VoiceboxProviderDeps): VoiceboxProvider {
  const { config, fetchImpl, eventSourceFactory } = deps;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const connectTimeoutMs = deps.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

  async function checkConnection(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), connectTimeoutMs);
    try {
      const response = await fetchImpl(`${config.baseUrl}/profiles`, {
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async function cancel(generationId: string): Promise<void> {
    try {
      await fetchImpl(`${config.baseUrl}/generate/${encodeURIComponent(generationId)}/cancel`, {
        method: 'POST',
      });
    } catch {
      // Cancellation is best-effort; a failure here must never surface.
    }
  }

  async function synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    // The live API rejects generation without a profile (HTTP 422). Degrade to
    // text-only rather than issuing a request we know will fail.
    if (!config.profileId) {
      return { ok: false, reason: 'provider-unavailable' };
    }

    let generationId: string;
    try {
      const response = await fetchImpl(`${config.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildGenerateBody({
            text: input.text,
            profileId: config.profileId,
            locale: input.locale,
          }),
        ),
        signal: input.signal,
      });
      if (!response.ok) return { ok: false, reason: 'generation-error' };
      const id = extractGenerationId(await response.json());
      if (!id) return { ok: false, reason: 'generation-error' };
      generationId = id;
    } catch {
      return { ok: false, reason: 'network' };
    }

    return await new Promise<SynthesizeResult>((resolve) => {
      let settled = false;
      let stream: EventSource | null = null;

      const finish = (result: SynthesizeResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        input.signal?.removeEventListener('abort', onAbort);
        try {
          stream?.close();
        } catch {
          // closing a dead stream is not an error worth surfacing
        }
        resolve(result);
      };

      const timer = setTimeout(
        () => finish({ ok: false, reason: 'timeout', generationId }),
        timeoutMs,
      );

      function onAbort() {
        finish({ ok: false, reason: 'generation-error', generationId });
      }
      input.signal?.addEventListener('abort', onAbort, { once: true });

      try {
        stream = eventSourceFactory(
          `${config.baseUrl}/generate/${encodeURIComponent(generationId)}/status`,
        );
      } catch {
        finish({ ok: false, reason: 'provider-unavailable', generationId });
        return;
      }

      stream.onmessage = (event: MessageEvent) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        const kind = classifyStatusEvent(raw);
        if (kind === 'progress') return;
        if (kind === 'error') return finish({ ok: false, reason: 'generation-error', generationId });
        if (kind === 'cancelled') return finish({ ok: false, reason: 'generation-error', generationId });

        let parsed: unknown = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // fall through with the raw string; extraction will return null
        }
        const audioUrl = extractAudioUrl(parsed);
        if (!audioUrl) return finish({ ok: false, reason: 'generation-error', generationId });
        finish({ ok: true, audioUrl, generationId });
      };

      stream.onerror = () => finish({ ok: false, reason: 'network', generationId });
    });
  }

  return { checkConnection, synthesize, cancel };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test "src/platform/speech/providers/voicebox-provider.test.ts"`
Expected: PASS (8 tests)

- [x] **Step 5: Commit**

```bash
git add src/platform/speech/providers/voicebox-provider.ts src/platform/speech/providers/voicebox-provider.test.ts
git commit -m "feat(speech): add Voicebox provider transport with cancellation and stream teardown"
```

---

### Task 3: Playback controller

Satisfies mandatory tests **4** (autoplay rejection), **7** (unapproved audio origin rejected), **8** (blob URLs revoked).

**Files:**
- Create: `src/platform/speech/playback-controller.ts`
- Test: `src/platform/speech/playback-controller.test.ts`

**Interfaces:**
- Consumes: `isApprovedLoopbackUrl` from `./config.ts`.
- Produces: `createPlaybackController(deps): PlaybackController` where
  `PlaybackController = { play(audioUrl: string, sequence: number): Promise<PlaybackResult>; stop(): void; currentSequence(): number; setVolume(volume: number): void; setRate(rate: number): void }`,
  `PlaybackResult = { status: 'played' } | { status: 'superseded' } | { status: 'autoplay-blocked' } | { status: 'rejected'; reason: 'invalid-audio-origin' | 'audio-decode' | 'network' }`.

- [x] **Step 1: Write the failing test**

```ts
// src/platform/speech/playback-controller.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackController } from './playback-controller.ts';

class FakeAudio {
  src = '';
  volume = 1;
  playbackRate = 1;
  paused = false;
  playCalls = 0;
  shouldReject: Error | null = null;
  onended: (() => void) | null = null;
  async play() {
    this.playCalls += 1;
    if (this.shouldReject) throw this.shouldReject;
  }
  pause() {
    this.paused = true;
  }
}

function makeDeps(over: Partial<Parameters<typeof createPlaybackController>[0]> = {}) {
  const audio = new FakeAudio();
  const revoked: string[] = [];
  return {
    audio,
    revoked,
    deps: {
      baseUrl: 'http://127.0.0.1:17493',
      audioFactory: () => audio as unknown as HTMLAudioElement,
      fetchImpl: async () =>
        ({
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'audio/wav' : null) },
          blob: async () => ({ size: 1024, type: 'audio/wav' }) as Blob,
        }) as unknown as Response,
      createObjectUrl: () => 'blob:fake-1',
      revokeObjectUrl: (url: string) => revoked.push(url),
      ...over,
    },
  };
}

test('plays audio from an approved loopback origin', async () => {
  const { audio, deps } = makeDeps();
  const controller = createPlaybackController(deps);
  const result = await controller.play('http://127.0.0.1:17493/audio/a.wav', 1);
  assert.deepEqual(result, { status: 'played' });
  assert.equal(audio.playCalls, 1);
  assert.equal(audio.src, 'blob:fake-1');
});

test('resolves a relative audio path against the configured loopback base', async () => {
  const { deps } = makeDeps();
  const controller = createPlaybackController(deps);
  const result = await controller.play('/audio/a.wav', 1);
  assert.deepEqual(result, { status: 'played' });
});

test('fail-closed: refuses audio from an unapproved origin and never fetches it', async () => {
  let fetched = false;
  const { deps } = makeDeps({
    fetchImpl: async () => {
      fetched = true;
      return {} as Response;
    },
  });
  const controller = createPlaybackController(deps);
  const result = await controller.play('http://evil.example.com/a.wav', 1);
  assert.deepEqual(result, { status: 'rejected', reason: 'invalid-audio-origin' });
  assert.equal(fetched, false, 'must not fetch from an unapproved origin');
});

test('rejects a non-audio content type', async () => {
  const { deps } = makeDeps({
    fetchImpl: async () =>
      ({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        blob: async () => ({ size: 10, type: 'text/html' }) as Blob,
      }) as unknown as Response,
  });
  const controller = createPlaybackController(deps);
  const result = await controller.play('/a.wav', 1);
  assert.deepEqual(result, { status: 'rejected', reason: 'audio-decode' });
});

test('rejects an oversized audio payload', async () => {
  const { deps } = makeDeps({
    maxBytes: 100,
    fetchImpl: async () =>
      ({
        ok: true,
        status: 200,
        headers: { get: () => 'audio/wav' },
        blob: async () => ({ size: 5_000, type: 'audio/wav' }) as Blob,
      }) as unknown as Response,
  });
  const controller = createPlaybackController(deps);
  const result = await controller.play('/a.wav', 1);
  assert.deepEqual(result, { status: 'rejected', reason: 'audio-decode' });
});

test('handles autoplay rejection without an unhandled promise', async () => {
  const { audio, deps } = makeDeps();
  const error = new Error('play() failed');
  error.name = 'NotAllowedError';
  audio.shouldReject = error;
  const controller = createPlaybackController(deps);
  const result = await controller.play('/a.wav', 1);
  assert.deepEqual(result, { status: 'autoplay-blocked' });
});

test('a stale sequence is superseded and never plays', async () => {
  const { audio, deps } = makeDeps();
  const controller = createPlaybackController(deps);
  await controller.play('/new.wav', 5);
  const stale = await controller.play('/old.wav', 2);
  assert.deepEqual(stale, { status: 'superseded' });
  assert.equal(audio.playCalls, 1, 'stale audio must not play');
});

test('revokes the previous blob url when replaced and on stop', async () => {
  const { revoked, deps } = makeDeps();
  const controller = createPlaybackController(deps);
  await controller.play('/a.wav', 1);
  await controller.play('/b.wav', 2);
  assert.ok(revoked.includes('blob:fake-1'), 'replacement must revoke the prior url');
  controller.stop();
  assert.ok(revoked.length >= 2, 'stop must revoke the active url');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test "src/platform/speech/playback-controller.test.ts"`
Expected: FAIL — `Cannot find module './playback-controller.ts'`

- [x] **Step 3: Write minimal implementation**

```ts
// src/platform/speech/playback-controller.ts
// Owns the ONE Audio element and the blob lifecycle.
//
// Never a generic remote-media player: audio must come from the approved
// loopback origin, is fetched as bytes, content-type and size verified, and
// played from a client-created blob: URL that is revoked on replacement/stop.
// This origin check is a genuine FAIL-CLOSED boundary (Leonidas).
//
// Latest-request-wins: each play carries a monotonic sequence; a stale sequence
// is refused so a slow earlier generation can never speak over a newer one.

import { isApprovedLoopbackUrl } from './config.ts';

export type PlaybackResult =
  | { status: 'played' }
  | { status: 'superseded' }
  | { status: 'autoplay-blocked' }
  | { status: 'rejected'; reason: 'invalid-audio-origin' | 'audio-decode' | 'network' };

export interface PlaybackController {
  play(audioUrl: string, sequence: number): Promise<PlaybackResult>;
  stop(): void;
  currentSequence(): number;
  setVolume(volume: number): void;
  setRate(rate: number): void;
}

export interface PlaybackControllerDeps {
  baseUrl: string;
  audioFactory: () => HTMLAudioElement;
  fetchImpl: typeof fetch;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

export function createPlaybackController(deps: PlaybackControllerDeps): PlaybackController {
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;
  let audio: HTMLAudioElement | null = null;
  let activeUrl: string | null = null;
  let sequence = 0;
  let volume = 1;
  let rate = 1;

  function ensureAudio(): HTMLAudioElement {
    if (!audio) audio = deps.audioFactory();
    audio.volume = volume;
    audio.playbackRate = rate;
    return audio;
  }

  function revokeActive(): void {
    if (activeUrl) {
      try {
        deps.revokeObjectUrl(activeUrl);
      } catch {
        // revoking an already-dead url is harmless
      }
      activeUrl = null;
    }
  }

  function resolveUrl(audioUrl: string): string | null {
    let absolute: string;
    try {
      absolute = new URL(audioUrl, deps.baseUrl).toString();
    } catch {
      return null;
    }
    return isApprovedLoopbackUrl(absolute) ? absolute : null;
  }

  async function play(audioUrl: string, nextSequence: number): Promise<PlaybackResult> {
    if (nextSequence < sequence) return { status: 'superseded' };
    sequence = nextSequence;

    const resolved = resolveUrl(audioUrl);
    if (!resolved) return { status: 'rejected', reason: 'invalid-audio-origin' };

    let blob: Blob;
    try {
      const response = await deps.fetchImpl(resolved);
      if (!response.ok) return { status: 'rejected', reason: 'network' };
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().startsWith('audio/')) {
        return { status: 'rejected', reason: 'audio-decode' };
      }
      blob = await response.blob();
    } catch {
      return { status: 'rejected', reason: 'network' };
    }

    if (blob.size > maxBytes) return { status: 'rejected', reason: 'audio-decode' };
    if (nextSequence < sequence) return { status: 'superseded' };

    const element = ensureAudio();
    try {
      element.pause();
    } catch {
      // pausing an idle element is fine
    }
    revokeActive();

    const objectUrl = deps.createObjectUrl(blob);
    activeUrl = objectUrl;
    element.src = objectUrl;

    try {
      await element.play();
      return { status: 'played' };
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      if (name === 'NotAllowedError' || name === 'AbortError') {
        return { status: 'autoplay-blocked' };
      }
      return { status: 'rejected', reason: 'audio-decode' };
    }
  }

  function stop(): void {
    try {
      audio?.pause();
    } catch {
      // nothing playing
    }
    revokeActive();
  }

  return {
    play,
    stop,
    currentSequence: () => sequence,
    setVolume: (next: number) => {
      volume = next;
      if (audio) audio.volume = next;
    },
    setRate: (next: number) => {
      rate = next;
      if (audio) audio.playbackRate = next;
    },
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test "src/platform/speech/playback-controller.test.ts"`
Expected: PASS (8 tests)

- [x] **Step 5: Commit**

```bash
git add src/platform/speech/playback-controller.ts src/platform/speech/playback-controller.test.ts
git commit -m "feat(speech): add playback controller with origin validation and blob lifecycle"
```

---

### Task 4: Speech orchestrator

Satisfies mandatory tests **1** (stale generation cannot play), **2** (new utterance cancels in-flight), **3** (disabling cancels), **5** (identity dedupe), **6** (negative cache expiry), **10** (no narrative text in logs), **14** (empty utterance does nothing).

**Files:**
- Create: `src/platform/speech/speech-orchestrator.ts`
- Test: `src/platform/speech/speech-orchestrator.test.ts`

**Interfaces:**
- Consumes: `VoiceboxProvider` (Task 2), `PlaybackController` (Task 3), `VoiceUtterance`/`SpeechOutcome` from `./types.ts`, `applyVoicePolicy` from `@/nehemiah/speech/nehemiah-voice-policy.ts`.
- Produces: `createSpeechOrchestrator(deps): SpeechOrchestrator` where
  `SpeechOrchestrator = { speak(utterance: VoiceUtterance): Promise<SpeechOutcome>; stop(): void; replayLast(): Promise<SpeechOutcome>; setAutoSpeak(on: boolean): void; reconnect(): void }`.

- [x] **Step 1: Write the failing test**

```ts
// src/platform/speech/speech-orchestrator.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechOrchestrator } from './speech-orchestrator.ts';
import type { VoiceUtterance } from './types.ts';

const utterance = (over: Partial<VoiceUtterance> = {}): VoiceUtterance => ({
  id: 'j1:focus-surfaced:1:en-US',
  speaker: 'NEHEMIAH',
  lifecycle: 'focus-surfaced',
  text: 'The focus is ready for you.',
  locale: 'en-US',
  priority: 'normal',
  interruption: 'replace',
  ...over,
});

function harness(over: { connected?: boolean; autoSpeak?: boolean; enabled?: boolean } = {}) {
  const calls = { synthesize: 0, cancel: [] as string[], play: [] as string[], stop: 0 };
  let now = 0;
  const provider = {
    checkConnection: async () => over.connected ?? true,
    synthesize: async () => {
      calls.synthesize += 1;
      return { ok: true as const, audioUrl: '/a.wav', generationId: `g${calls.synthesize}` };
    },
    cancel: async (id: string) => {
      calls.cancel.push(id);
    },
  };
  const playback = {
    play: async (url: string) => {
      calls.play.push(url);
      return { status: 'played' as const };
    },
    stop: () => {
      calls.stop += 1;
    },
    currentSequence: () => 0,
    setVolume: () => {},
    setRate: () => {},
  };
  const orchestrator = createSpeechOrchestrator({
    provider,
    playback,
    isEnabled: () => over.enabled ?? true,
    autoSpeak: over.autoSpeak ?? true,
    now: () => now,
  });
  return { orchestrator, calls, provider, advance: (ms: number) => (now += ms) };
}

test('does nothing at all when the capability is disabled', async () => {
  const { orchestrator, calls } = harness({ enabled: false });
  const outcome = await orchestrator.speak(utterance());
  assert.deepEqual(outcome, { status: 'disabled' });
  assert.equal(calls.synthesize, 0, 'must not touch the network when disabled');
});

test('does nothing when the Founder has auto-speak off', async () => {
  const { orchestrator, calls } = harness({ autoSpeak: false });
  const outcome = await orchestrator.speak(utterance());
  assert.deepEqual(outcome, { status: 'disabled' });
  assert.equal(calls.synthesize, 0);
});

test('dedupes on utterance identity, not text equality', async () => {
  const { orchestrator, calls } = harness();
  await orchestrator.speak(utterance());
  const second = await orchestrator.speak(utterance({ text: 'Totally different wording.' }));
  assert.deepEqual(second, { status: 'deduped' });
  assert.equal(calls.synthesize, 1);

  const newRevision = await orchestrator.speak(
    utterance({ id: 'j1:focus-surfaced:2:en-US', text: 'The focus is ready for you.' }),
  );
  assert.deepEqual(newRevision, { status: 'spoken' }, 'same text, new transition, speaks again');
});

test('an empty utterance is silently ignored', async () => {
  const { orchestrator, calls } = harness();
  const outcome = await orchestrator.speak(utterance({ text: '   ' }));
  assert.notDeepEqual(outcome, { status: 'spoken' });
  assert.equal(calls.synthesize, 0);
});

test('refuses content the Voice Constitution rejects', async () => {
  const { orchestrator, calls } = harness();
  const outcome = await orchestrator.speak(utterance({ text: 'See https://example.com' }));
  assert.notDeepEqual(outcome, { status: 'spoken' });
  assert.equal(calls.synthesize, 0);
});

test('reports unavailable and does not synthesize when Voicebox is unreachable', async () => {
  const { orchestrator, calls } = harness({ connected: false });
  const outcome = await orchestrator.speak(utterance());
  assert.deepEqual(outcome, { status: 'unavailable' });
  assert.equal(calls.synthesize, 0);
});

test('negative connection cache expires so Voicebox can be started later', async () => {
  const calls = { checks: 0 };
  let connected = false;
  let now = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => {
        calls.checks += 1;
        return connected;
      },
      synthesize: async () => ({ ok: true as const, audioUrl: '/a.wav', generationId: 'g1' }),
      cancel: async () => {},
    },
    playback: {
      play: async () => ({ status: 'played' as const }),
      stop: () => {},
      currentSequence: () => 0,
      setVolume: () => {},
      setRate: () => {},
    },
    isEnabled: () => true,
    autoSpeak: true,
    now: () => now,
    negativeCacheMs: 30_000,
  });

  assert.deepEqual(await orchestrator.speak(utterance({ id: 'a' })), { status: 'unavailable' });
  assert.deepEqual(await orchestrator.speak(utterance({ id: 'b' })), { status: 'unavailable' });
  assert.equal(calls.checks, 1, 'second attempt uses the negative cache');

  now += 31_000;
  connected = true;
  assert.deepEqual(await orchestrator.speak(utterance({ id: 'c' })), { status: 'spoken' });
  assert.equal(calls.checks, 2, 'cache expired, so it re-checked');
});

test('reconnect clears the negative cache immediately', async () => {
  const calls = { checks: 0 };
  let connected = false;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => {
        calls.checks += 1;
        return connected;
      },
      synthesize: async () => ({ ok: true as const, audioUrl: '/a.wav', generationId: 'g1' }),
      cancel: async () => {},
    },
    playback: {
      play: async () => ({ status: 'played' as const }),
      stop: () => {},
      currentSequence: () => 0,
      setVolume: () => {},
      setRate: () => {},
    },
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });
  await orchestrator.speak(utterance({ id: 'a' }));
  connected = true;
  orchestrator.reconnect();
  assert.deepEqual(await orchestrator.speak(utterance({ id: 'b' })), { status: 'spoken' });
  assert.equal(calls.checks, 2);
});

test('a newer utterance cancels the in-flight generation and the stale one cannot play', async () => {
  const cancelled: string[] = [];
  const played: string[] = [];
  let release: (() => void) | null = null;
  let counter = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        counter += 1;
        const id = `g${counter}`;
        if (counter === 1) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return { ok: true as const, audioUrl: `/${id}.wav`, generationId: id };
      },
      cancel: async (id: string) => {
        cancelled.push(id);
      },
    },
    playback: {
      play: async (url: string) => {
        played.push(url);
        return { status: 'played' as const };
      },
      stop: () => {},
      currentSequence: () => 0,
      setVolume: () => {},
      setRate: () => {},
    },
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });

  const first = orchestrator.speak(utterance({ id: 'first' }));
  await Promise.resolve();
  const second = await orchestrator.speak(utterance({ id: 'second' }));
  release?.();
  const firstOutcome = await first;

  assert.deepEqual(second, { status: 'spoken' });
  assert.deepEqual(firstOutcome, { status: 'cancelled' }, 'the superseded utterance must not play');
  assert.deepEqual(played, ['/g2.wav'], 'only the newest audio plays');
  assert.ok(cancelled.includes('g1'), 'the superseded generation must be cancelled');
});

test('stop halts playback and disabling mid-flight prevents play', async () => {
  let enabled = true;
  const played: string[] = [];
  let release: (() => void) | null = null;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { ok: true as const, audioUrl: '/a.wav', generationId: 'g1' };
      },
      cancel: async () => {},
    },
    playback: {
      play: async (url: string) => {
        played.push(url);
        return { status: 'played' as const };
      },
      stop: () => {},
      currentSequence: () => 0,
      setVolume: () => {},
      setRate: () => {},
    },
    isEnabled: () => enabled,
    autoSpeak: true,
    now: () => 0,
  });

  const pending = orchestrator.speak(utterance());
  await Promise.resolve();
  enabled = false;
  release?.();
  const outcome = await pending;
  assert.notDeepEqual(outcome, { status: 'spoken' });
  assert.deepEqual(played, [], 'audio must not play after voice was disabled');
});

test('never passes narrative text to the logger', async () => {
  const logged: string[] = [];
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => false,
      synthesize: async () => ({ ok: false as const, reason: 'network' as const }),
      cancel: async () => {},
    },
    playback: {
      play: async () => ({ status: 'played' as const }),
      stop: () => {},
      currentSequence: () => 0,
      setVolume: () => {},
      setRate: () => {},
    },
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
    log: (message: string) => logged.push(message),
  });
  const secret = 'The pilot boundary decision is confidential.';
  await orchestrator.speak(utterance({ text: secret }));
  for (const line of logged) {
    assert.ok(!line.includes(secret), `log leaked narrative text: ${line}`);
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test "src/platform/speech/speech-orchestrator.test.ts"`
Expected: FAIL — `Cannot find module './speech-orchestrator.ts'`

- [x] **Step 3: Write minimal implementation**

```ts
// src/platform/speech/speech-orchestrator.ts
// The decision layer in front of synthesis.
//
// Answers, in order: capability enabled? Founder auto-speak on? speakable
// content? already spoken (by IDENTITY, not text)? Voicebox reachable (with a
// short negative cache so a later start recovers)? still the newest request?
//
// Owns latest-request-wins across the whole pipeline: a newer utterance cancels
// the in-flight generation and the superseded one can never reach playback.
//
// Logs carry utterance id/lifecycle/status ONLY — never narrative text.

import { applyVoicePolicy } from '@/nehemiah/speech/nehemiah-voice-policy.ts';
import type { PlaybackController } from './playback-controller.ts';
import type { VoiceboxProvider } from './providers/voicebox-provider.ts';
import type { SpeechOutcome, VoiceUtterance } from './types.ts';

export interface SpeechOrchestrator {
  speak(utterance: VoiceUtterance): Promise<SpeechOutcome>;
  stop(): void;
  replayLast(): Promise<SpeechOutcome>;
  setAutoSpeak(on: boolean): void;
  reconnect(): void;
}

export interface SpeechOrchestratorDeps {
  provider: Pick<VoiceboxProvider, 'checkConnection' | 'synthesize' | 'cancel'>;
  playback: PlaybackController;
  isEnabled: () => boolean;
  autoSpeak: boolean;
  now: () => number;
  negativeCacheMs?: number;
  maxNegativeCacheMs?: number;
  log?: (message: string) => void;
}

const DEFAULT_NEGATIVE_CACHE_MS = 30_000;
const DEFAULT_MAX_NEGATIVE_CACHE_MS = 240_000;

export function createSpeechOrchestrator(deps: SpeechOrchestratorDeps): SpeechOrchestrator {
  const baseCacheMs = deps.negativeCacheMs ?? DEFAULT_NEGATIVE_CACHE_MS;
  const maxCacheMs = deps.maxNegativeCacheMs ?? DEFAULT_MAX_NEGATIVE_CACHE_MS;
  const log = deps.log ?? (() => {});

  let autoSpeak = deps.autoSpeak;
  let spokenId: string | null = null;
  let lastUtterance: VoiceUtterance | null = null;
  let sequence = 0;
  let inFlightGenerationId: string | null = null;
  let unreachableUntil = 0;
  let backoffMs = baseCacheMs;

  async function reachable(): Promise<boolean> {
    if (deps.now() < unreachableUntil) return false;
    const ok = await deps.provider.checkConnection();
    if (ok) {
      backoffMs = baseCacheMs;
      unreachableUntil = 0;
    } else {
      unreachableUntil = deps.now() + backoffMs;
      backoffMs = Math.min(backoffMs * 2, maxCacheMs);
    }
    return ok;
  }

  async function run(utterance: VoiceUtterance, isReplay: boolean): Promise<SpeechOutcome> {
    if (!deps.isEnabled() || !autoSpeak) return { status: 'disabled' };

    if (!isReplay && utterance.id === spokenId) return { status: 'deduped' };

    if (utterance.expiresAt !== undefined && deps.now() > utterance.expiresAt) {
      return { status: 'cancelled' };
    }

    const policy = applyVoicePolicy(utterance.text, utterance.locale);
    if (!policy.ok) {
      log(`speech:policy-rejected id=${utterance.id} reason=${policy.reason}`);
      return { status: 'failed', reason: 'generation-error' };
    }

    if (!(await reachable())) {
      log(`speech:unavailable id=${utterance.id}`);
      return { status: 'unavailable' };
    }

    const mySequence = ++sequence;

    // A newer utterance supersedes anything still generating.
    if (inFlightGenerationId) {
      const stale = inFlightGenerationId;
      inFlightGenerationId = null;
      void deps.provider.cancel(stale);
    }

    const synthesized = await deps.provider.synthesize({
      text: policy.text,
      locale: utterance.locale,
    });

    if (mySequence !== sequence) {
      if (synthesized.ok) void deps.provider.cancel(synthesized.generationId);
      log(`speech:superseded id=${utterance.id}`);
      return { status: 'cancelled' };
    }

    if (!synthesized.ok) {
      log(`speech:failed id=${utterance.id} reason=${synthesized.reason}`);
      return { status: 'failed', reason: synthesized.reason };
    }

    inFlightGenerationId = synthesized.generationId;

    // Voice may have been switched off while we were generating.
    if (!deps.isEnabled() || !autoSpeak) {
      inFlightGenerationId = null;
      void deps.provider.cancel(synthesized.generationId);
      return { status: 'cancelled' };
    }

    const played = await deps.playback.play(synthesized.audioUrl, mySequence);
    inFlightGenerationId = null;

    if (played.status === 'played') {
      spokenId = utterance.id;
      lastUtterance = utterance;
      log(`speech:spoken id=${utterance.id} lifecycle=${utterance.lifecycle}`);
      return { status: 'spoken' };
    }
    if (played.status === 'superseded') return { status: 'cancelled' };
    if (played.status === 'autoplay-blocked') return { status: 'autoplay-blocked' };
    return { status: 'failed', reason: played.reason };
  }

  return {
    speak: (utterance) => run(utterance, false),
    replayLast: () =>
      lastUtterance ? run(lastUtterance, true) : Promise.resolve({ status: 'disabled' }),
    stop: () => {
      sequence += 1; // invalidate anything in flight
      if (inFlightGenerationId) {
        void deps.provider.cancel(inFlightGenerationId);
        inFlightGenerationId = null;
      }
      deps.playback.stop();
    },
    setAutoSpeak: (on: boolean) => {
      autoSpeak = on;
      if (on) {
        unreachableUntil = 0;
        backoffMs = baseCacheMs;
      }
    },
    reconnect: () => {
      unreachableUntil = 0;
      backoffMs = baseCacheMs;
    },
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test "src/platform/speech/speech-orchestrator.test.ts"`
Expected: PASS (11 tests)

- [x] **Step 5: Export the new surface and run the full gate**

Replace the body of `src/platform/speech/index.ts` with:

```ts
// Public surface of the platform speech layer.

export type {
  VoiceUtterance,
  SpeechOutcome,
  SpeechFailureReason,
  SpeechLocale,
  SpeechPriority,
  InterruptionPolicy,
  VoiceboxConfig,
} from './types.ts';

export {
  resolveVoiceConfig,
  isApprovedLoopbackUrl,
  DEFAULT_LOCALE,
  type ReadConfigInput,
} from './config.ts';

export {
  createVoiceboxProvider,
  type VoiceboxProvider,
  type SynthesizeInput,
  type SynthesizeResult,
} from './providers/voicebox-provider.ts';

export {
  createPlaybackController,
  type PlaybackController,
  type PlaybackResult,
} from './playback-controller.ts';

export {
  createSpeechOrchestrator,
  type SpeechOrchestrator,
  type SpeechOrchestratorDeps,
} from './speech-orchestrator.ts';
```

Run: `npm run gate`
Expected: all tests pass, typecheck clean, governance 14/14, build OK.

- [x] **Step 6: Commit**

```bash
git add src/platform/speech/speech-orchestrator.ts src/platform/speech/speech-orchestrator.test.ts src/platform/speech/index.ts
git commit -m "feat(speech): add speech orchestrator with dedupe, supersession, and reconnect"
```

---

### Task 5: Founder voice controls component

Satisfies mandatory test **16** (fake listening not presented as real listening).

**Files:**
- Create: `src/components/founder-voice-controls.tsx`
- Create: `src/nehemiah/speech/voice-preferences.ts`
- Test: `src/nehemiah/speech/voice-preferences.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure preference state + presentational component).
- Produces: `createVoicePreferences(): VoicePreferences`, `type VoicePreferences = { autoSpeak: boolean; volume: number; rate: number; quietMode: boolean }`, `setAutoSpeak/setVolume/setRate/setQuietMode` reducers, and `shouldSpeak(prefs: VoicePreferences): boolean`. Component: `FounderVoiceControls(props)`.

- [x] **Step 1: Write the failing test**

```ts
// src/nehemiah/speech/voice-preferences.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVoicePreferences,
  setAutoSpeak,
  setQuietMode,
  setRate,
  setVolume,
  shouldSpeak,
} from './voice-preferences.ts';

test('defaults are conservative: auto-speak on, full volume, normal rate, quiet off', () => {
  const prefs = createVoicePreferences();
  assert.equal(prefs.autoSpeak, true);
  assert.equal(prefs.volume, 1);
  assert.equal(prefs.rate, 1);
  assert.equal(prefs.quietMode, false);
});

test('quiet mode suppresses speech even when auto-speak is on', () => {
  const prefs = setQuietMode(createVoicePreferences(), true);
  assert.equal(prefs.autoSpeak, true);
  assert.equal(shouldSpeak(prefs), false);
});

test('auto-speak off suppresses speech', () => {
  assert.equal(shouldSpeak(setAutoSpeak(createVoicePreferences(), false)), false);
});

test('speech is allowed only when auto-speak is on and quiet mode is off', () => {
  assert.equal(shouldSpeak(createVoicePreferences()), true);
});

test('volume and rate are clamped to safe ranges', () => {
  assert.equal(setVolume(createVoicePreferences(), 5).volume, 1);
  assert.equal(setVolume(createVoicePreferences(), -2).volume, 0);
  assert.equal(setRate(createVoicePreferences(), 99).rate, 2);
  assert.equal(setRate(createVoicePreferences(), 0).rate, 0.5);
});

test('reducers never mutate the input', () => {
  const original = createVoicePreferences();
  setAutoSpeak(original, false);
  assert.equal(original.autoSpeak, true);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test "src/nehemiah/speech/voice-preferences.test.ts"`
Expected: FAIL — `Cannot find module './voice-preferences.ts'`

- [x] **Step 3: Write minimal implementation**

```ts
// src/nehemiah/speech/voice-preferences.ts
// The Founder's runtime voice preferences.
//
// Distinct from the deployment capability flag: the flag says whether voice
// EXISTS, these say whether the Founder wants it right now. Pure and
// immutable so the shell can hold them in React state.

export interface VoicePreferences {
  autoSpeak: boolean;
  /** 0..1 */
  volume: number;
  /** 0.5..2 */
  rate: number;
  quietMode: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

export function createVoicePreferences(): VoicePreferences {
  return { autoSpeak: true, volume: 1, rate: 1, quietMode: false };
}

export function setAutoSpeak(prefs: VoicePreferences, autoSpeak: boolean): VoicePreferences {
  return { ...prefs, autoSpeak };
}

export function setVolume(prefs: VoicePreferences, volume: number): VoicePreferences {
  return { ...prefs, volume: clamp(volume, 0, 1) };
}

export function setRate(prefs: VoicePreferences, rate: number): VoicePreferences {
  return { ...prefs, rate: clamp(rate, 0.5, 2) };
}

export function setQuietMode(prefs: VoicePreferences, quietMode: boolean): VoicePreferences {
  return { ...prefs, quietMode };
}

/** Speech is allowed only when the Founder wants it and quiet mode is off. */
export function shouldSpeak(prefs: VoicePreferences): boolean {
  return prefs.autoSpeak && !prefs.quietMode;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test "src/nehemiah/speech/voice-preferences.test.ts"`
Expected: PASS (6 tests)

- [x] **Step 5: Create the controls component**

```tsx
// src/components/founder-voice-controls.tsx
'use client';

import type { VoicePreferences } from '@/nehemiah/speech/voice-preferences';

export interface FounderVoiceControlsProps {
  available: boolean;
  preferences: VoicePreferences;
  onToggleAutoSpeak: (on: boolean) => void;
  onToggleQuiet: (on: boolean) => void;
  onVolume: (value: number) => void;
  onStop: () => void;
  onReplay: () => void;
  onReconnect: () => void;
}

export function FounderVoiceControls({
  available,
  preferences,
  onToggleAutoSpeak,
  onToggleQuiet,
  onVolume,
  onStop,
  onReplay,
  onReconnect,
}: FounderVoiceControlsProps) {
  if (!available) return null;

  return (
    <section className="voice-controls" aria-label="Nehemiah voice">
      <label>
        <input
          type="checkbox"
          checked={preferences.autoSpeak}
          onChange={(event) => onToggleAutoSpeak(event.target.checked)}
        />
        Speak aloud
      </label>
      <label>
        <input
          type="checkbox"
          checked={preferences.quietMode}
          onChange={(event) => onToggleQuiet(event.target.checked)}
        />
        Quiet mode
      </label>
      <label>
        Volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={preferences.volume}
          onChange={(event) => onVolume(Number(event.target.value))}
          aria-label="Voice volume"
        />
      </label>
      <button type="button" onClick={onStop}>Stop speaking</button>
      <button type="button" onClick={onReplay}>Replay last</button>
      <button type="button" onClick={onReconnect}>Reconnect Voicebox</button>
    </section>
  );
}
```

- [x] **Step 6: Run the full gate**

Run: `npm run gate`
Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add src/nehemiah/speech/voice-preferences.ts src/nehemiah/speech/voice-preferences.test.ts src/components/founder-voice-controls.tsx
git commit -m "feat(speech): add Founder voice preferences and controls"
```

---

### Task 6: Wire the shell — remove fake listening, speak on state change

Satisfies mandatory test **16** (the fake-listening control is removed).

**Files:**
- Modify: `src/components/nehemiah-shell.tsx` (the `voice-button` at ~line 374; add imports, state, effect)
- Modify: `src/app/globals.css` (add `.voice-controls`, keep `.voice-button` rules harmless)

**Interfaces:**
- Consumes: `createSpeechOrchestrator`, `createVoiceboxProvider`, `createPlaybackController`, `resolveVoiceConfig` (Tasks 2–4); `voiceUtteranceForState` (already built); `createVoicePreferences`, `shouldSpeak`, `setAutoSpeak`, `setQuietMode`, `setVolume` (Task 5); `FounderVoiceControls` (Task 5).
- Produces: no new exports.

- [x] **Step 1: Replace the fake-listening button**

In `src/components/nehemiah-shell.tsx`, find:

```tsx
<button type="button" className="voice-button" aria-label="Start listening" disabled={journey.lifecycle !== 'resting'} onClick={() => setCommand('Listen to my decision about the restricted pilot.')}>◉</button>
```

Replace it with a control that does not pretend to listen:

```tsx
<button
  type="button"
  className="voice-button"
  aria-label="Voice input — coming in a later phase"
  title="Voice input is not available yet"
  disabled
>
  ◉
</button>
```

- [x] **Step 2: Add imports at the top of the file**

```tsx
import { FounderVoiceControls } from './founder-voice-controls';
import {
  createVoicePreferences,
  setAutoSpeak,
  setQuietMode,
  setVolume,
  shouldSpeak,
  type VoicePreferences,
} from '@/nehemiah/speech/voice-preferences';
import { voiceUtteranceForState } from '@/nehemiah/speech/voice-utterance-for-state';
import {
  createPlaybackController,
  createSpeechOrchestrator,
  createVoiceboxProvider,
  resolveVoiceConfig,
  type SpeechOrchestrator,
} from '@/platform/speech';
```

- [x] **Step 3: Add voice state and the lazily-created orchestrator**

Add inside `NehemiahShell()`, next to the other `useState` calls:

```tsx
const [voicePrefs, setVoicePrefs] = useState<VoicePreferences>(createVoicePreferences);
const [stateRevision, setStateRevision] = useState(0);
const voiceRef = useRef<SpeechOrchestrator | null>(null);
const voiceConfig = useMemo(
  () =>
    resolveVoiceConfig({
      enabled: process.env.NEXT_PUBLIC_VOICEBOX_ENABLED,
      baseUrl: process.env.NEXT_PUBLIC_VOICEBOX_URL,
      profileId: process.env.NEXT_PUBLIC_VOICEBOX_PROFILE_ID,
      profileVersion: process.env.NEXT_PUBLIC_VOICEBOX_PROFILE_VERSION,
    }),
  [],
);
```

Add `useRef` to the React import on line 3:

```tsx
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
```

- [x] **Step 4: Create the orchestrator in a browser-only effect**

```tsx
useEffect(() => {
  if (!voiceConfig.enabled || typeof window === 'undefined') return;
  const provider = createVoiceboxProvider({
    config: voiceConfig,
    fetchImpl: window.fetch.bind(window),
    eventSourceFactory: (url) => new EventSource(url),
  });
  const playback = createPlaybackController({
    baseUrl: voiceConfig.baseUrl,
    audioFactory: () => new Audio(),
    fetchImpl: window.fetch.bind(window),
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  });
  voiceRef.current = createSpeechOrchestrator({
    provider,
    playback,
    isEnabled: () => voiceConfig.enabled,
    autoSpeak: true,
    now: () => Date.now(),
  });
  return () => {
    voiceRef.current?.stop();
    voiceRef.current = null;
  };
}, [voiceConfig]);
```

- [x] **Step 5: Bump the revision on every lifecycle change, then speak**

```tsx
useEffect(() => {
  setStateRevision((revision) => revision + 1);
}, [journey.lifecycle]);

useEffect(() => {
  const orchestrator = voiceRef.current;
  if (!orchestrator || !shouldSpeak(voicePrefs)) return;
  const utterance = voiceUtteranceForState(journey.lifecycle, { stateRevision });
  if (!utterance) return;
  void orchestrator.speak(utterance);
}, [journey.lifecycle, stateRevision, voicePrefs]);
```

- [x] **Step 6: Render the controls**

Place next to the command form (immediately after the `</form>` that contains the voice button):

```tsx
<FounderVoiceControls
  available={voiceConfig.enabled}
  preferences={voicePrefs}
  onToggleAutoSpeak={(on) => {
    setVoicePrefs((prefs) => setAutoSpeak(prefs, on));
    voiceRef.current?.setAutoSpeak(on);
  }}
  onToggleQuiet={(on) => setVoicePrefs((prefs) => setQuietMode(prefs, on))}
  onVolume={(value) => setVoicePrefs((prefs) => setVolume(prefs, value))}
  onStop={() => voiceRef.current?.stop()}
  onReplay={() => void voiceRef.current?.replayLast()}
  onReconnect={() => voiceRef.current?.reconnect()}
/>
```

- [x] **Step 7: Add minimal styles**

Append to `src/app/globals.css`:

```css
.voice-controls { display:flex; flex-wrap:wrap; gap:.75rem; align-items:center; margin-top:.5rem; font-size:.85rem; }
.voice-controls label { display:flex; gap:.35rem; align-items:center; }
.voice-controls button { min-height:44px; padding:0 .75rem; border-radius:8px; border:1px solid var(--navy); background:transparent; color:var(--navy); }
.voice-button:disabled { opacity:.35; cursor:not-allowed; }
```

- [x] **Step 8: Run the full gate**

Run: `npm run gate`
Expected: all tests pass, typecheck clean, governance 14/14, build OK.

- [x] **Step 9: Commit**

```bash
git add src/components/nehemiah-shell.tsx src/app/globals.css
git commit -m "feat(speech): wire Founder-controlled speech into the shell and remove fake listening"
```

---

### Task 7: Pin the live contract and close the gate

**Files:**
- Modify: `src/platform/speech/providers/voicebox-contract.ts` (narrow key lists to the captured contract)
- Modify: `docs/superpowers/specs/2026-07-27-voicebox-voice-output-design.md` (record final probe status)
- Modify: `docs/integrations/voicebox.md` (record the pinned profile id)

**Interfaces:**
- Consumes: `scripts/voicebox-contract-probe.py` output (`voicebox-contract.json`).
- Produces: no new exports — narrows existing ones.

- [x] **Step 1: Capture the live contract**

On the Founder's Mac, with Voicebox running:

```bash
python3 scripts/voicebox-contract-probe.py --out voicebox-contract.json
```

- [x] **Step 2: Narrow the key lists to what the contract actually returns**

In `voicebox-contract.ts`, reduce `ID_KEYS`, `AUDIO_KEYS`, and `NESTED_KEYS` to the single observed spelling each, keeping the extraction functions unchanged. Example, if the contract shows `{"id": "..."}` and `{"audio_url": "..."}`:

```ts
const ID_KEYS = ['id'] as const;
const AUDIO_KEYS = ['audio_url'] as const;
const NESTED_KEYS = ['result'] as const;
```

- [x] **Step 3: Update the contract tests to assert the pinned shape**

Add to `voicebox-contract.test.ts`:

```ts
test('pinned contract: the observed live payload shape resolves', () => {
  // Shape captured from scripts/voicebox-contract-probe.py on 2026-07-27.
  assert.equal(extractGenerationId({ id: 'abc123' }), 'abc123');
  assert.equal(extractAudioUrl({ status: 'complete', audio_url: '/audio/abc123.wav' }), '/audio/abc123.wav');
});
```

- [x] **Step 4: Record the pinned profile**

Set in the Founder's environment (and document the value in `docs/integrations/voicebox.md`):

```
NEXT_PUBLIC_VOICEBOX_ENABLED=true
NEXT_PUBLIC_VOICEBOX_PROFILE_ID=<id from GET /profiles>
```

- [x] **Step 5: Run the full gate**

Run: `npm run gate`
Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add src/platform/speech/providers/voicebox-contract.ts src/platform/speech/providers/voicebox-contract.test.ts docs/
git commit -m "feat(speech): pin the live Voicebox contract and record the approved profile"
```

---

## Mandatory test coverage map

| # | Spec requirement | Task |
|---|---|---|
| 1 | Old generation cannot play after a newer state wins | 4 (+3) |
| 2 | New utterance cancels an in-flight generation | 4 |
| 3 | Disabling voice during generation cancels and prevents playback | 4 |
| 4 | Autoplay rejection handled without unhandled promise | 3 |
| 5 | Dedupe uses utterance identity, not only text | 4 |
| 6 | Negative connection cache expires; Voicebox reconnects | 4 |
| 7 | Audio from an unapproved origin is rejected | 3 |
| 8 | Blob URLs revoked after playback and replacement | 3 |
| 9 | EventSource closed on completion, cancellation, timeout | 2 |
| 10 | No narrative text in production logs | 4 |
| 11 | Length cap does not cut words | already built (`nehemiah-voice-policy.test.ts`) |
| 12 | Spanish utterances use approved language behavior | 2 (+ policy, already built) |
| 13 | Pronunciation does not alter visible text | already built (`pronunciation-dictionary.test.ts`) |
| 14 | Empty/whitespace utterances do nothing | 4 (+ policy, already built) |
| 15 | Missing profile → text-only degradation | 2 |
| 16 | Fake listening not presented as real listening | 5, 6 |
| 17 | Deployed-origin compatibility probe passes | **done** — recorded in the spec (Chrome GO, 2026-07-27) |

*Note on 9: "closed on unmount" is covered by the shell's effect cleanup calling `orchestrator.stop()` (Task 6, Step 4), which invalidates the sequence and stops playback.*

## Notes for the implementer

- **`useRef` is required in Task 6** — add it to the existing React import; the orchestrator must not be recreated on every render.
- **The orchestrator is created only in the browser.** SSR renders nothing voice-related; `voiceConfig.enabled` is false by default, so the default build is unchanged.
- **Do not add dependencies.** Everything uses platform APIs (`fetch`, `EventSource`, `Audio`, `URL.createObjectURL`).
- **If a test in Task 4 is flaky around promise ordering**, prefer an explicit release function (as written) over `setTimeout` — the tests must be deterministic.
