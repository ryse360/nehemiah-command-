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
