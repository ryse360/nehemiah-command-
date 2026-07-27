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
