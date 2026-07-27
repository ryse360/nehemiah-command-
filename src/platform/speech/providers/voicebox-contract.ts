// THE SINGLE PINNING POINT for Voicebox's wire format.
//
// Voicebox's exact field names vary across versions, so every lookup lives
// here behind permissive multi-key extraction. When the live contract is
// captured (scripts/voicebox-contract-probe.py), narrow these lists — this is
// the ONLY file that should need to change.
//
// PURE. No network, no DOM.

import type { SpeechLocale } from '../types.ts';

// OBSERVED LIVE (Voicebox v0.5.0, 2026-07-27): both the profile and the
// generation return their identifier as `id` (a UUID), and the SSE status
// payload is `{"id", "status", "duration", "error"}` with terminal statuses
// including "failed". `id` is therefore listed first; the remaining spellings
// are retained as defensive fallbacks across versions.
const ID_KEYS = ['id', 'generation_id', 'generationId', 'job_id', 'jobId'] as const;
// NOT YET OBSERVED: no successful generation has produced audio on the probe
// machine (the PyTorch backend needs the `qwen-tts` package). Narrow this list
// once a completed status event is captured.
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

const CANCELLED_STATUS = /^(cancell?ed|aborted)$/;
const ERROR_STATUS = /^(error|failed|failure)$/;
const COMPLETE_STATUS = /^(complete|completed|done|ready|finished|success)$/;

/**
 * Classify an SSE status payload.
 *
 * MUST read the `status` FIELD, never scan the raw text: the live payload is
 * `{"id","status","duration","error",...}` and carries an `error` KEY on EVERY
 * event (null when healthy). Substring-matching the raw JSON therefore reports
 * a failure for a perfectly healthy `"status":"loading_model"` event. Observed
 * live on Voicebox v0.5.0, 2026-07-27.
 *
 * Only an unparseable (non-JSON) payload falls back to scanning the text.
 */
export function classifyStatusEvent(raw: string): StatusEventKind {
  let status: string | null = null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const record = asRecord(parsed);
    const value = record?.status;
    if (typeof value === 'string') status = value.trim().toLowerCase();
  } catch {
    // Not JSON — fall through to the raw-text heuristic below.
  }

  if (status !== null) {
    if (CANCELLED_STATUS.test(status)) return 'cancelled';
    if (ERROR_STATUS.test(status)) return 'error';
    if (COMPLETE_STATUS.test(status)) return 'complete';
    return 'progress';
  }

  const haystack = raw.toLowerCase();
  if (/\b(cancell?ed|aborted)\b/.test(haystack)) return 'cancelled';
  if (/\b(error|failed|failure)\b/.test(haystack)) return 'error';
  if (/\b(complete|completed|done|ready|finished|success)\b/.test(haystack)) return 'complete';
  return 'progress';
}

/**
 * The POST /generate body.
 *
 * CONFIRMED against the live OpenAPI schema (Voicebox v0.5.0, 2026-07-27):
 *   profile_id  REQUIRED string
 *   text        REQUIRED string
 *   language    optional string
 *   (also optional: seed, model_size, instruct, engine, personality,
 *    max_chunk_chars, crossfade_ms, normalize, effects_chain)
 *
 * This exact shape was accepted with HTTP 200 by the live server, so the three
 * fields below are sufficient; the optional knobs stay unset deliberately.
 */
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
