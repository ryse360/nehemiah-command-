// Authored spoken copy per journey state.
//
// Screen copy and spoken copy are DIFFERENT MEDIA. This module does not scrape
// what is on screen; it produces intentionally authored, concise spoken output
// for each state (~one or two calm sentences). States with no meaningful change
// return null — Nehemiah stays silent rather than narrating everything.
//
// The audible speaker is always Nehemiah; `sourceAgents` records provenance.
// Final wording and tone are an Anakin/Miller acceptance gate — the strings
// here are the authored Phase 0 baseline, structured so wording can be revised
// without touching the pipeline.
//
// PURE. Governed by Anakin (meaning), Miller (clarity), Jony (character).

import type { NehemiahState } from '@/nehemiah/state-machine.ts';
import type {
  InterruptionPolicy,
  SpeechLocale,
  SpeechPriority,
  VoiceUtterance,
} from '@/platform/speech/types.ts';

export interface UtteranceContext {
  journeyId?: string;
  /**
   * Monotonic revision of the current state. Part of the utterance identity so
   * dedupe keys on the transition, not on text equality.
   */
  stateRevision: number;
  locale?: SpeechLocale;
  sourceAgents?: string[];
}

interface AuthoredLine {
  text: string;
  priority: SpeechPriority;
  interruption: InterruptionPolicy;
}

// Authored baseline copy. Silence (absence here) is intentional for states with
// no meaningful spoken content — `resting` and `listening` say nothing.
const AUTHORED: Partial<Record<NehemiahState, AuthoredLine>> = {
  'focus-surfaced': {
    text: 'I have surfaced the focus that matters most right now. Take a moment with it when you are ready.',
    priority: 'normal',
    interruption: 'replace',
  },
  'decision-required': {
    text: 'A decision now needs your judgment. I have prepared the case; the choice, and its consequences, are yours.',
    priority: 'important',
    interruption: 'replace',
  },
  'action-underway': {
    text: 'The decision is set. I am carrying it into coordinated action.',
    priority: 'normal',
    interruption: 'replace',
  },
  'proof-created': {
    text: 'Progress is verified and preserved as proof. The record stands on its own.',
    priority: 'normal',
    interruption: 'replace',
  },
};

/**
 * Build the authored utterance for a state, or null when Nehemiah should stay
 * silent. The returned text is pre-policy: the caller runs it through
 * `applyVoicePolicy` before synthesis.
 */
export function voiceUtteranceForState(
  state: NehemiahState,
  context: UtteranceContext,
): VoiceUtterance | null {
  const line = AUTHORED[state];
  if (!line) return null;

  const locale = context.locale ?? 'en-US';
  const journeyPart = context.journeyId ?? 'session';
  const id = `${journeyPart}:${state}:${context.stateRevision}:${locale}`;

  return {
    id,
    speaker: 'NEHEMIAH',
    sourceAgents: context.sourceAgents,
    journeyId: context.journeyId,
    lifecycle: state,
    text: line.text,
    locale,
    priority: line.priority,
    interruption: line.interruption,
  };
}
