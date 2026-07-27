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
        if (kind === 'cancelled') {
          return finish({ ok: false, reason: 'generation-error', generationId });
        }

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
