// Owns the ONE Audio element and the blob lifecycle.
//
// Never a generic remote-media player: audio must come from the approved
// loopback origin, is fetched as bytes, content-type and size verified, and
// played from a client-created blob: URL that is revoked on replacement/stop.
// This origin check is a genuine FAIL-CLOSED boundary (Leonidas).
//
// Latest-request-wins: each play carries a monotonic sequence; a stale sequence
// is refused so a slow earlier generation can never speak over a newer one.
//
// SSR-safe: no DOM access at module load — the Audio element is created lazily
// through an injected factory.

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
