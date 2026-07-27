import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceboxProvider } from './voicebox-provider.ts';

const config = { enabled: true, baseUrl: 'http://127.0.0.1:17493', profileId: 'p1' };

/** Minimal EventSource double: tests push events by hand. */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  emit(data: string) {
    this.onmessage?.({ data });
  }
  fail() {
    this.onerror?.(new Error('stream error'));
  }
  close() {
    this.closed = true;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const esFactory = (url: string) => new FakeEventSource(url) as unknown as EventSource;

/** Let the provider reach its await points before the test emits an event. */
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test('checkConnection returns true on a healthy profiles response', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse([]),
    eventSourceFactory: esFactory,
  });
  assert.equal(await provider.checkConnection(), true);
});

test('checkConnection returns false instead of throwing when unreachable', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => {
      throw new Error('Failed to fetch');
    },
    eventSourceFactory: esFactory,
  });
  assert.equal(await provider.checkConnection(), false);
});

test('synthesize resolves the audio url from the status stream and closes it', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse({ id: 'g1' }),
    eventSourceFactory: esFactory,
  });
  const pending = provider.synthesize({ text: 'hello', locale: 'en-US' });
  await settle();
  FakeEventSource.last!.emit('{"status":"complete","audio_url":"/audio/g1.wav"}');
  const result = await pending;
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.audioUrl, '/audio/g1.wav');
  assert.equal(FakeEventSource.last!.closed, true, 'stream must be closed on completion');
});

test('synthesize fails silently when no profile is configured', async () => {
  const provider = createVoiceboxProvider({
    config: { ...config, profileId: undefined },
    fetchImpl: async () => jsonResponse({ id: 'g1' }),
    eventSourceFactory: esFactory,
  });
  const result = await provider.synthesize({ text: 'hello', locale: 'en-US' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'provider-unavailable');
});

test('synthesize reports a generation error and closes the stream', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse({ id: 'g1' }),
    eventSourceFactory: esFactory,
  });
  const pending = provider.synthesize({ text: 'hello', locale: 'en-US' });
  await settle();
  FakeEventSource.last!.emit('{"status":"error"}');
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'generation-error');
  assert.equal(FakeEventSource.last!.closed, true);
});

test('synthesize sends the Spanish language code and the required profile_id', async () => {
  let sent: string | undefined;
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async (_url, init) => {
      sent = init?.body as string;
      return jsonResponse({ id: 'g1' });
    },
    eventSourceFactory: esFactory,
  });
  const pending = provider.synthesize({ text: 'hola', locale: 'es-US' });
  await settle();
  FakeEventSource.last!.emit('{"status":"complete","audio_url":"/a.wav"}');
  await pending;
  assert.match(sent ?? '', /"language":"es"/);
  assert.match(sent ?? '', /"profile_id":"p1"/);
});

test('a non-ok generate response is a generation error, not a throw', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse({ detail: 'missing profile_id' }, 422),
    eventSourceFactory: esFactory,
  });
  const result = await provider.synthesize({ text: 'hello', locale: 'en-US' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'generation-error');
});

test('a stream error resolves as a failure rather than hanging', async () => {
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async () => jsonResponse({ id: 'g1' }),
    eventSourceFactory: esFactory,
  });
  const pending = provider.synthesize({ text: 'hello', locale: 'en-US' });
  await settle();
  FakeEventSource.last!.fail();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(FakeEventSource.last!.closed, true);
});

test('cancel posts to the cancel endpoint and never throws', async () => {
  const calls: string[] = [];
  const provider = createVoiceboxProvider({
    config,
    fetchImpl: async (url) => {
      calls.push(String(url));
      throw new Error('network down');
    },
    eventSourceFactory: esFactory,
  });
  await provider.cancel('g9');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/generate\/g9\/cancel$/);
});
