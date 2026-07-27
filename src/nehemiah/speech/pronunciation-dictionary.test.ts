import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPronunciation, PRONUNCIATION_DICTIONARY } from './pronunciation-dictionary.ts';

test('rewrites governed names for speech', () => {
  assert.equal(applyPronunciation('Nehemiah is ready.'), 'Neh-uh-MY-uh is ready.');
  assert.equal(applyPronunciation('Ask MiP about it.'), 'Ask M I P about it.');
});

test('multi-word entries win over single-word overlaps', () => {
  assert.equal(applyPronunciation('Consult Sun Tzu first.'), 'Consult Sun Zoo first.');
});

test('handles the hyphenated Fei-Fei correctly', () => {
  assert.equal(applyPronunciation('Fei-Fei reviewed it.'), 'Fay Fay reviewed it.');
});

test('is case-insensitive but leaves unrelated words alone', () => {
  const out = applyPronunciation('nehemiah and the mission');
  assert.match(out, /Neh-uh-MY-uh/);
  assert.match(out, /and the mission/);
});

test('does not partially match inside a larger word', () => {
  // "Vossler" should not become "Vosssler"
  assert.equal(applyPronunciation('Vossler'), 'Vossler');
});

test('returns input unchanged when nothing matches (display text is never mutated by side effect)', () => {
  const original = 'The pilot team is blocked.';
  const spoken = applyPronunciation(original);
  assert.equal(spoken, original);
  // original reference is untouched
  assert.equal(original, 'The pilot team is blocked.');
});

test('dictionary is a reviewed, non-empty governance artifact', () => {
  assert.ok(PRONUNCIATION_DICTIONARY.length > 0);
  for (const entry of PRONUNCIATION_DICTIONARY) {
    assert.equal(typeof entry.written, 'string');
    assert.equal(typeof entry.spoken, 'string');
  }
});
