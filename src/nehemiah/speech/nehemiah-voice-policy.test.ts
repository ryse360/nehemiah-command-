import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVoicePolicy, capWords, MAX_SPOKEN_WORDS } from './nehemiah-voice-policy.ts';

test('accepts a calm one-sentence utterance and applies pronunciation', () => {
  const result = applyVoicePolicy('Nehemiah has surfaced the focus.', 'en-US');
  assert.equal(result.ok, true);
  if (result.ok) assert.match(result.text, /Neh-uh-MY-uh has surfaced the focus\./);
});

test('rejects empty or whitespace-only content (Nehemiah stays silent)', () => {
  assert.deepEqual(applyVoicePolicy('', 'en-US'), { ok: false, reason: 'empty' });
  assert.deepEqual(applyVoicePolicy('   \n\t ', 'en-US'), { ok: false, reason: 'empty' });
});

test('rejects an unsupported locale', () => {
  // @ts-expect-error deliberately passing an unsupported locale
  assert.deepEqual(applyVoicePolicy('Hello', 'fr-FR'), {
    ok: false,
    reason: 'unsupported-locale',
  });
});

test('refuses to speak URLs, JSON, markup, or technical error noise', () => {
  assert.equal(applyVoicePolicy('See https://example.com now', 'en-US').ok, false);
  assert.equal(applyVoicePolicy('{"state":"blocked"}', 'en-US').ok, false);
  assert.equal(applyVoicePolicy('Render <div>hi</div>', 'en-US').ok, false);
  assert.equal(applyVoicePolicy('Uncaught Error at line 4', 'en-US').ok, false);
});

test('caps length without cutting a word', () => {
  const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
  const capped = capWords(long);
  const words = capped.replace(/…$/, '').trim().split(' ');
  assert.equal(words.length, MAX_SPOKEN_WORDS);
  // no partial/malformed token: every kept word is intact
  for (const w of words) assert.match(w, /^word\d+$/);
  assert.match(capped, /…$/);
});

test('does not append an ellipsis when already within the cap', () => {
  assert.equal(capWords('short and calm'), 'short and calm');
});

test('accepts the Spanish locale', () => {
  const result = applyVoicePolicy('La decisión requiere tu juicio.', 'es-US');
  assert.equal(result.ok, true);
});
