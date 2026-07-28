import test from 'node:test';
import assert from 'node:assert/strict';
import {
  audioPathForGeneration,
  buildGenerateBody,
  classifyStatusEvent,
  extractAudioUrl,
  extractGenerationId,
} from './voicebox-contract.ts';

test('extracts the generation id across known key spellings', () => {
  assert.equal(extractGenerationId({ id: 'g1' }), 'g1');
  assert.equal(extractGenerationId({ generation_id: 'g2' }), 'g2');
  assert.equal(extractGenerationId({ generationId: 'g3' }), 'g3');
  assert.equal(extractGenerationId({ job_id: 7 }), '7');
});

test('returns null when no id is present', () => {
  assert.equal(extractGenerationId({ detail: 'nope' }), null);
  assert.equal(extractGenerationId(null), null);
  assert.equal(extractGenerationId('string'), null);
});

test('extracts the audio url across known key spellings, including nested', () => {
  assert.equal(extractAudioUrl({ audio_url: '/a.wav' }), '/a.wav');
  assert.equal(extractAudioUrl({ audioUrl: '/b.wav' }), '/b.wav');
  assert.equal(extractAudioUrl({ url: '/c.wav' }), '/c.wav');
  assert.equal(extractAudioUrl({ result: { audio_url: '/d.wav' } }), '/d.wav');
  assert.equal(extractAudioUrl({ path: '/e.wav' }), '/e.wav');
  assert.equal(extractAudioUrl({ nothing: true }), null);
});

test('classifies SSE payloads into lifecycle kinds', () => {
  assert.equal(classifyStatusEvent('{"status":"complete","audio_url":"/a.wav"}'), 'complete');
  assert.equal(classifyStatusEvent('{"status":"done"}'), 'complete');
  assert.equal(classifyStatusEvent('{"status":"ready"}'), 'complete');
  assert.equal(classifyStatusEvent('{"status":"error","message":"boom"}'), 'error');
  assert.equal(classifyStatusEvent('{"status":"failed"}'), 'error');
  assert.equal(classifyStatusEvent('{"status":"cancelled"}'), 'cancelled');
  assert.equal(classifyStatusEvent('{"status":"running","progress":0.4}'), 'progress');
  assert.equal(classifyStatusEvent('not json'), 'progress');
});

test('builds a generate body that always carries the required profile_id', () => {
  const body = buildGenerateBody({ text: 'hello', profileId: 'p1', locale: 'en-US' });
  assert.equal(body.text, 'hello');
  assert.equal(body.profile_id, 'p1');
  assert.equal(body.language, 'en');
});

test('maps the Spanish locale to the Voicebox language code', () => {
  const body = buildGenerateBody({ text: 'hola', profileId: 'p1', locale: 'es-US' });
  assert.equal(body.language, 'es');
});

// Payloads captured verbatim from a live Voicebox v0.5.0 on 2026-07-27.
test('live contract: generation id is returned as `id` (uuid)', () => {
  assert.equal(
    extractGenerationId({ id: 'a3efd690-9d32-474f-ae8b-e900fa8e7f12' }),
    'a3efd690-9d32-474f-ae8b-e900fa8e7f12',
  );
});

test('live contract: a failed status event classifies as an error, not a completion', () => {
  const observed =
    '{"id": "a3efd690-9d32-474f-ae8b-e900fa8e7f12", "status": "failed", "duration": 0.0, "error": "No module named \'qwen_tts\'"}';
  assert.equal(classifyStatusEvent(observed), 'error');
  assert.equal(extractGenerationId(JSON.parse(observed)), 'a3efd690-9d32-474f-ae8b-e900fa8e7f12');
});

// REGRESSION: every live event carries an `error` KEY (null when healthy).
// Scanning the raw JSON for the word "error" wrongly failed healthy events.
test('live contract: a healthy event with a null error key is progress, not an error', () => {
  const observed =
    '{"id": "14dc733a-ffd7-4038-9dd3-6068e6b20a5f", "status": "loading_model", "duration": 0.0, "error": null, "source": "manual"}';
  assert.equal(classifyStatusEvent(observed), 'progress');
});

test('classification reads the status field, ignoring words elsewhere in the payload', () => {
  assert.equal(
    classifyStatusEvent('{"status":"running","error":null,"message":"no errors so far"}'),
    'progress',
  );
  assert.equal(
    classifyStatusEvent('{"status":"completed","error":null,"note":"cancelled nothing"}'),
    'complete',
  );
  assert.equal(classifyStatusEvent('{"status":"queued","error":null}'), 'progress');
  assert.equal(classifyStatusEvent('{"status":"generating","error":null}'), 'progress');
});

test('a non-JSON payload still falls back to the raw-text heuristic', () => {
  assert.equal(classifyStatusEvent('generation complete'), 'complete');
  assert.equal(classifyStatusEvent('ping'), 'progress');
});

// The full lifecycle observed live: loading_model -> generating -> completed.
test('live contract: the real generation lifecycle classifies correctly', () => {
  const id = '757e5586-42f7-4c1b-b20d-36cc7cf9899d';
  const event = (status: string, duration = 0.0) =>
    `{"id": "${id}", "status": "${status}", "duration": ${duration}, "error": null, "source": "manual"}`;

  assert.equal(classifyStatusEvent(event('loading_model')), 'progress');
  assert.equal(classifyStatusEvent(event('generating')), 'progress');
  assert.equal(classifyStatusEvent(event('completed', 2.675)), 'complete');
});

test('live contract: the completed event carries NO audio reference', () => {
  const completed = JSON.parse(
    '{"id": "757e5586-42f7-4c1b-b20d-36cc7cf9899d", "status": "completed", "duration": 2.675, "error": null, "source": "manual"}',
  );
  assert.equal(
    extractAudioUrl(completed),
    null,
    'the stream never carries a URL — the path must be constructed',
  );
});

test('live contract: audio is served from /audio/{generationId}', () => {
  assert.equal(
    audioPathForGeneration('052bb4b7-1ae9-42e6-b278-e65c3de3a7b0'),
    '/audio/052bb4b7-1ae9-42e6-b278-e65c3de3a7b0',
  );
});

test('the audio path encodes an id containing unsafe characters', () => {
  assert.equal(audioPathForGeneration('a/b?c'), '/audio/a%2Fb%3Fc');
});
