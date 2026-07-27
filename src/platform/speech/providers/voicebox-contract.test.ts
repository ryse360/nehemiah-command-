import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
