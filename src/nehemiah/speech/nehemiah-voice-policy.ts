// The Nehemiah Voice Constitution — enforced.
//
// Defines, as executable policy, what Nehemiah is allowed to SAY OUT LOUD and
// how much. Governed by Anakin (experience) with Miller (clarity), Norman
// (cognitive load), and Esther (non-intrusiveness). This is the gate every
// utterance passes before synthesis.
//
// Character (documented for reviewers; enforced by tone in authored copy, not
// by code): calm, grounded, intelligent, deliberate, warm without
// sentimentality, authoritative without domination, concise, unhurried, certain
// only when evidence permits. Never theatrical, militarized, over-excited,
// robotic, sales-y, constantly congratulatory, omniscient, an impersonation, or
// emotionally dependent on the Founder's attention.
//
// PURE. No DOM, no network.

import type { SpeechLocale } from '@/platform/speech/types.ts';
import { applyPronunciation } from './pronunciation-dictionary.ts';

/** Upper bound on spoken length. One or two calm sentences, not a paragraph. */
export const MAX_SPOKEN_WORDS = 45;

const SUPPORTED_LOCALES: readonly SpeechLocale[] = ['en-US', 'es-US'];

export type VoicePolicyRejection =
  | 'empty'
  | 'unsupported-locale'
  | 'unspeakable-content';

export type VoicePolicyResult =
  | { ok: true; text: string }
  | { ok: false; reason: VoicePolicyRejection };

// Content that must never be read aloud: raw JSON/object dumps, URLs, code, and
// technical error strings. Nehemiah speaks meaning, not machine detail.
const UNSPEAKABLE_PATTERNS: readonly RegExp[] = [
  /https?:\/\/\S+/i, // URLs
  /[{}[\]]/, // JSON / array / object braces
  /<\/?[a-z][\s\S]*>/i, // markup tags
  /\b(?:Error|Exception|stack trace|undefined|null|NaN)\b/, // technical error noise
  /[;=]{1}\s*[\w"']+\s*[;)]/, // code-ish fragments
];

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Cap to at most `maxWords` WITHOUT cutting a word. If truncation is needed the
 * result ends on a whole word (a trailing ellipsis is added). Never produces a
 * partial or malformed token.
 */
export function capWords(text: string, maxWords: number = MAX_SPOKEN_WORDS): string {
  const words = collapseWhitespace(text).split(' ').filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ') + '…';
}

/**
 * Run authored spoken copy through the Constitution: validate locale, reject
 * empty and unspeakable content, cap length word-safely, and apply speech-only
 * pronunciation. Returns the final spoken string or a typed rejection. Rejection
 * is benign — the caller simply stays silent for that state.
 */
export function applyVoicePolicy(text: string, locale: SpeechLocale): VoicePolicyResult {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return { ok: false, reason: 'unsupported-locale' };
  }
  const cleaned = collapseWhitespace(text);
  if (cleaned.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (UNSPEAKABLE_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return { ok: false, reason: 'unspeakable-content' };
  }
  const capped = capWords(cleaned);
  const spoken = applyPronunciation(capped);
  return { ok: true, text: spoken };
}
