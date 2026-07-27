import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechOrchestrator } from './speech-orchestrator.ts';
import type { PlaybackController } from './playback-controller.ts';
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

/**
 * A promise the test resolves by hand, used to hold a synthesis mid-flight.
 * The definite-assignment assertion is required: TypeScript cannot see the
 * assignment that happens inside the Promise executor.
 */
function deferred(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** A playback double that records what it was asked to play. */
function fakePlayback(played: string[] = []): PlaybackController & { played: string[] } {
  return {
    played,
    play: async (url: string) => {
      played.push(url);
      return { status: 'played' as const };
    },
    stop: () => {},
    currentSequence: () => 0,
    setVolume: () => {},
    setRate: () => {},
  };
}

test('does nothing at all when the capability is disabled', async () => {
  let synthesized = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        synthesized += 1;
        return { ok: true as const, audioUrl: '/a.wav', generationId: 'g1' };
      },
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => false,
    autoSpeak: true,
    now: () => 0,
  });
  assert.deepEqual(await orchestrator.speak(utterance()), { status: 'disabled' });
  assert.equal(synthesized, 0, 'must not touch the network when disabled');
});

test('does nothing when the Founder has auto-speak off', async () => {
  let synthesized = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        synthesized += 1;
        return { ok: true as const, audioUrl: '/a.wav', generationId: 'g1' };
      },
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: false,
    now: () => 0,
  });
  assert.deepEqual(await orchestrator.speak(utterance()), { status: 'disabled' });
  assert.equal(synthesized, 0);
});

test('dedupes on utterance identity, not text equality', async () => {
  let synthesized = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        synthesized += 1;
        return { ok: true as const, audioUrl: '/a.wav', generationId: `g${synthesized}` };
      },
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });

  await orchestrator.speak(utterance());
  const sameTransition = await orchestrator.speak(
    utterance({ text: 'Totally different wording.' }),
  );
  assert.deepEqual(sameTransition, { status: 'deduped' });
  assert.equal(synthesized, 1);

  const newRevision = await orchestrator.speak(
    utterance({ id: 'j1:focus-surfaced:2:en-US', text: 'The focus is ready for you.' }),
  );
  assert.deepEqual(newRevision, { status: 'spoken' }, 'same text, new transition, speaks again');
});

test('an empty utterance is silently ignored', async () => {
  let synthesized = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        synthesized += 1;
        return { ok: true as const, audioUrl: '/a.wav', generationId: 'g1' };
      },
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });
  const outcome = await orchestrator.speak(utterance({ text: '   ' }));
  assert.notDeepEqual(outcome, { status: 'spoken' });
  assert.equal(synthesized, 0);
});

test('refuses content the Voice Constitution rejects', async () => {
  let synthesized = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        synthesized += 1;
        return { ok: true as const, audioUrl: '/a.wav', generationId: 'g1' };
      },
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });
  const outcome = await orchestrator.speak(utterance({ text: 'See https://example.com' }));
  assert.notDeepEqual(outcome, { status: 'spoken' });
  assert.equal(synthesized, 0);
});

test('reports unavailable and does not synthesize when Voicebox is unreachable', async () => {
  let synthesized = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => false,
      synthesize: async () => {
        synthesized += 1;
        return { ok: true as const, audioUrl: '/a.wav', generationId: 'g1' };
      },
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });
  assert.deepEqual(await orchestrator.speak(utterance()), { status: 'unavailable' });
  assert.equal(synthesized, 0);
});

test('negative connection cache expires so Voicebox can be started later', async () => {
  let checks = 0;
  let connected = false;
  let now = 0;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => {
        checks += 1;
        return connected;
      },
      synthesize: async () => ({ ok: true as const, audioUrl: '/a.wav', generationId: 'g1' }),
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => now,
    negativeCacheMs: 30_000,
  });

  assert.deepEqual(await orchestrator.speak(utterance({ id: 'a' })), { status: 'unavailable' });
  assert.deepEqual(await orchestrator.speak(utterance({ id: 'b' })), { status: 'unavailable' });
  assert.equal(checks, 1, 'second attempt uses the negative cache');

  now += 31_000;
  connected = true;
  assert.deepEqual(await orchestrator.speak(utterance({ id: 'c' })), { status: 'spoken' });
  assert.equal(checks, 2, 'cache expired, so it re-checked');
});

test('reconnect clears the negative cache immediately', async () => {
  let checks = 0;
  let connected = false;
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => {
        checks += 1;
        return connected;
      },
      synthesize: async () => ({ ok: true as const, audioUrl: '/a.wav', generationId: 'g1' }),
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });
  await orchestrator.speak(utterance({ id: 'a' }));
  connected = true;
  orchestrator.reconnect();
  assert.deepEqual(await orchestrator.speak(utterance({ id: 'b' })), { status: 'spoken' });
  assert.equal(checks, 2);
});

test('a newer utterance cancels the in-flight generation and the stale one cannot play', async () => {
  const cancelled: string[] = [];
  const played: string[] = [];
  const gate = deferred();
  let counter = 0;

  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        counter += 1;
        const id = `g${counter}`;
        if (counter === 1) await gate.promise;
        return { ok: true as const, audioUrl: `/${id}.wav`, generationId: id };
      },
      cancel: async (id: string) => {
        cancelled.push(id);
      },
    },
    playback: fakePlayback(played),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });

  const first = orchestrator.speak(utterance({ id: 'first' }));
  await Promise.resolve();
  await Promise.resolve();
  const second = await orchestrator.speak(utterance({ id: 'second' }));
  gate.release();
  const firstOutcome = await first;

  assert.deepEqual(second, { status: 'spoken' });
  assert.deepEqual(firstOutcome, { status: 'cancelled' }, 'the superseded utterance must not play');
  assert.deepEqual(played, ['/g2.wav'], 'only the newest audio plays');
});

test('disabling voice mid-generation cancels and prevents playback', async () => {
  let enabled = true;
  const played: string[] = [];
  const gate = deferred();

  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => {
        await gate.promise;
        return { ok: true as const, audioUrl: '/a.wav', generationId: 'g1' };
      },
      cancel: async () => {},
    },
    playback: fakePlayback(played),
    isEnabled: () => enabled,
    autoSpeak: true,
    now: () => 0,
  });

  const pending = orchestrator.speak(utterance());
  await Promise.resolve();
  await Promise.resolve();
  enabled = false;
  gate.release();
  const outcome = await pending;

  assert.notDeepEqual(outcome, { status: 'spoken' });
  assert.deepEqual(played, [], 'audio must not play after voice was disabled');
});

test('stop cancels the in-flight generation and halts playback', async () => {
  let stopped = 0;
  const playback = fakePlayback();
  playback.stop = () => {
    stopped += 1;
  };
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => ({ ok: true as const, audioUrl: '/a.wav', generationId: 'g1' }),
      cancel: async () => {},
    },
    playback,
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });
  await orchestrator.speak(utterance());
  orchestrator.stop();
  assert.equal(stopped, 1);
});

test('replayLast re-speaks the last spoken utterance despite the dedupe guard', async () => {
  const played: string[] = [];
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => ({ ok: true as const, audioUrl: '/a.wav', generationId: 'g1' }),
      cancel: async () => {},
    },
    playback: fakePlayback(played),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });
  await orchestrator.speak(utterance());
  assert.deepEqual(await orchestrator.replayLast(), { status: 'spoken' });
  assert.equal(played.length, 2);
});

test('replayLast is a no-op before anything has been spoken', async () => {
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => true,
      synthesize: async () => ({ ok: true as const, audioUrl: '/a.wav', generationId: 'g1' }),
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
  });
  assert.deepEqual(await orchestrator.replayLast(), { status: 'disabled' });
});

test('never passes narrative text to the logger', async () => {
  const logged: string[] = [];
  const orchestrator = createSpeechOrchestrator({
    provider: {
      checkConnection: async () => false,
      synthesize: async () => ({ ok: false as const, reason: 'network' as const }),
      cancel: async () => {},
    },
    playback: fakePlayback(),
    isEnabled: () => true,
    autoSpeak: true,
    now: () => 0,
    log: (message: string) => logged.push(message),
  });
  const secret = 'The pilot boundary decision is confidential.';
  await orchestrator.speak(utterance({ text: secret }));
  assert.ok(logged.length > 0, 'expected at least one log line to check');
  for (const line of logged) {
    assert.ok(!line.includes(secret), `log leaked narrative text: ${line}`);
  }
});
