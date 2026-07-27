// The governed speech contract for the MiP intelligence system.
//
// Phase 0 is text-to-speech only. This file defines the UNIT OF SPEECH — a
// structured utterance — and the OBSERVABLE OUTCOME of trying to speak it.
// Raw strings are deliberately not the interface: tests, diagnostics, and later
// orchestration must never lose provenance or result.
//
// PURE TYPES. No runtime, no DOM, no network — safe to import anywhere.

import type { NehemiahState } from '@/nehemiah/state-machine.ts';

/** Languages Nehemiah may speak in Phase 0. */
export type SpeechLocale = 'en-US' | 'es-US';

/** How a new utterance treats speech already in flight. */
export type InterruptionPolicy = 'replace' | 'queue' | 'ignore';

/** Relative importance — informs interruption and future quiet-hours logic. */
export type SpeechPriority = 'ambient' | 'normal' | 'important';

/**
 * One thing Nehemiah says. The audible speaker is ALWAYS Nehemiah in Phase 0;
 * `sourceAgents` records which operating agents contributed the underlying
 * intelligence (provenance only — never spoken, never a separate voice).
 */
export interface VoiceUtterance {
  /** Stable transition identity: `${journeyId}:${lifecycle}:${revision}:${locale}`. */
  id: string;
  speaker: 'NEHEMIAH';
  /** Provenance, e.g. ['ALEXANDER','GALILEO']. Not spoken. */
  sourceAgents?: string[];
  journeyId?: string;
  lifecycle: NehemiahState;
  /** Authored SPOKEN copy — not the on-screen display copy. */
  text: string;
  locale: SpeechLocale;
  priority: SpeechPriority;
  interruption: InterruptionPolicy;
  /** Optional wall-clock ms after which the utterance is stale and skipped. */
  expiresAt?: number;
}

export type SpeechFailureReason =
  | 'network'
  | 'timeout'
  | 'generation-error'
  | 'invalid-audio-origin'
  | 'audio-decode'
  | 'provider-unavailable';

/**
 * The observable result of a speak attempt. Only `spoken` produced audio; every
 * other variant is a benign, non-blocking outcome the UI may ignore but tests
 * and diagnostics must be able to assert on.
 */
export type SpeechOutcome =
  | { status: 'spoken' }
  | { status: 'disabled' } // capability flag off or Founder auto-speak off
  | { status: 'deduped' } // same utterance identity already spoken
  | { status: 'cancelled' } // superseded by a newer utterance
  | { status: 'unavailable' } // Voicebox unreachable (fail-safe, silent)
  | { status: 'autoplay-blocked' } // browser requires a user gesture first
  | { status: 'failed'; reason: SpeechFailureReason };

/** Validated, loopback-restricted provider configuration (see config.ts). */
export interface VoiceboxConfig {
  enabled: boolean;
  /** Always an approved loopback origin: 127.0.0.1 / localhost / [::1]. */
  baseUrl: string;
  profileId?: string;
  profileVersion?: string;
}
