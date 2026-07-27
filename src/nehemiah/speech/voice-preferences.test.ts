import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVoicePreferences,
  setAutoSpeak,
  setQuietMode,
  setRate,
  setVolume,
  shouldSpeak,
} from './voice-preferences.ts';

test('defaults are conservative: auto-speak on, full volume, normal rate, quiet off', () => {
  const prefs = createVoicePreferences();
  assert.equal(prefs.autoSpeak, true);
  assert.equal(prefs.volume, 1);
  assert.equal(prefs.rate, 1);
  assert.equal(prefs.quietMode, false);
});

test('quiet mode suppresses speech even when auto-speak is on', () => {
  const prefs = setQuietMode(createVoicePreferences(), true);
  assert.equal(prefs.autoSpeak, true);
  assert.equal(shouldSpeak(prefs), false);
});

test('auto-speak off suppresses speech', () => {
  assert.equal(shouldSpeak(setAutoSpeak(createVoicePreferences(), false)), false);
});

test('speech is allowed only when auto-speak is on and quiet mode is off', () => {
  assert.equal(shouldSpeak(createVoicePreferences()), true);
});

test('volume and rate are clamped to safe ranges', () => {
  assert.equal(setVolume(createVoicePreferences(), 5).volume, 1);
  assert.equal(setVolume(createVoicePreferences(), -2).volume, 0);
  assert.equal(setRate(createVoicePreferences(), 99).rate, 2);
  assert.equal(setRate(createVoicePreferences(), 0).rate, 0.5);
});

test('non-finite input falls back to the minimum rather than corrupting state', () => {
  assert.equal(setVolume(createVoicePreferences(), Number.NaN).volume, 0);
  assert.equal(setRate(createVoicePreferences(), Number.NaN).rate, 0.5);
});

test('reducers never mutate the input', () => {
  const original = createVoicePreferences();
  setAutoSpeak(original, false);
  setVolume(original, 0.2);
  setQuietMode(original, true);
  assert.equal(original.autoSpeak, true);
  assert.equal(original.volume, 1);
  assert.equal(original.quietMode, false);
});
