import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackController, type PlaybackControllerDeps } from './playback-controller.ts';

class FakeAudio {
  src = '';
  volume = 1;
  playbackRate = 1;
  paused = false;
  playCalls = 0;
  shouldReject: Error | null = null;
  async play() {
    this.playCalls += 1;
    if (this.shouldReject) throw this.shouldReject;
  }
  pause() {
    this.paused = true;
  }
}

function audioResponse(contentType = 'audio/wav', size = 1024) {
  return {
    ok: true,
    status: 200,
    headers: { get: (header: string) => (header.toLowerCase() === 'content-type' ? contentType : null) },
    blob: async () => ({ size, type: contentType }) as Blob,
  } as unknown as Response;
}

function makeDeps(over: Partial<PlaybackControllerDeps> = {}) {
  const audio = new FakeAudio();
  const revoked: string[] = [];
  let created = 0;
  const deps: PlaybackControllerDeps = {
    baseUrl: 'http://127.0.0.1:17493',
    audioFactory: () => audio as unknown as HTMLAudioElement,
    fetchImpl: async () => audioResponse(),
    createObjectUrl: () => `blob:fake-${++created}`,
    revokeObjectUrl: (url: string) => revoked.push(url),
    ...over,
  };
  return { audio, revoked, deps };
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
  assert.deepEqual(await controller.play('/audio/a.wav', 1), { status: 'played' });
});

test('fail-closed: refuses audio from an unapproved origin and never fetches it', async () => {
  let fetched = false;
  const { deps } = makeDeps({
    fetchImpl: async () => {
      fetched = true;
      return audioResponse();
    },
  });
  const controller = createPlaybackController(deps);
  const result = await controller.play('http://evil.example.com/a.wav', 1);
  assert.deepEqual(result, { status: 'rejected', reason: 'invalid-audio-origin' });
  assert.equal(fetched, false, 'must not fetch from an unapproved origin');
});

test('rejects a non-audio content type', async () => {
  const { deps } = makeDeps({ fetchImpl: async () => audioResponse('text/html', 10) });
  const controller = createPlaybackController(deps);
  assert.deepEqual(await controller.play('/a.wav', 1), {
    status: 'rejected',
    reason: 'audio-decode',
  });
});

test('rejects an oversized audio payload', async () => {
  const { deps } = makeDeps({
    maxBytes: 100,
    fetchImpl: async () => audioResponse('audio/wav', 5_000),
  });
  const controller = createPlaybackController(deps);
  assert.deepEqual(await controller.play('/a.wav', 1), {
    status: 'rejected',
    reason: 'audio-decode',
  });
});

test('handles autoplay rejection without an unhandled promise', async () => {
  const { audio, deps } = makeDeps();
  const error = new Error('play() failed');
  error.name = 'NotAllowedError';
  audio.shouldReject = error;
  const controller = createPlaybackController(deps);
  assert.deepEqual(await controller.play('/a.wav', 1), { status: 'autoplay-blocked' });
});

test('a stale sequence is superseded and never plays', async () => {
  const { audio, deps } = makeDeps();
  const controller = createPlaybackController(deps);
  await controller.play('/new.wav', 5);
  assert.deepEqual(await controller.play('/old.wav', 2), { status: 'superseded' });
  assert.equal(audio.playCalls, 1, 'stale audio must not play');
});

test('revokes the previous blob url when replaced and on stop', async () => {
  const { revoked, deps } = makeDeps();
  const controller = createPlaybackController(deps);
  await controller.play('/a.wav', 1);
  await controller.play('/b.wav', 2);
  assert.ok(revoked.includes('blob:fake-1'), 'replacement must revoke the prior url');
  controller.stop();
  assert.ok(revoked.includes('blob:fake-2'), 'stop must revoke the active url');
});

test('a network failure degrades silently rather than throwing', async () => {
  const { deps } = makeDeps({
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  const controller = createPlaybackController(deps);
  assert.deepEqual(await controller.play('/a.wav', 1), { status: 'rejected', reason: 'network' });
});

test('volume and rate apply to the audio element', async () => {
  const { audio, deps } = makeDeps();
  const controller = createPlaybackController(deps);
  controller.setVolume(0.4);
  controller.setRate(1.25);
  await controller.play('/a.wav', 1);
  assert.equal(audio.volume, 0.4);
  assert.equal(audio.playbackRate, 1.25);
});
