import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceUtteranceForState } from './voice-utterance-for-state.ts';
import { applyVoicePolicy, MAX_SPOKEN_WORDS } from './nehemiah-voice-policy.ts';

const ctx = (over = {}) => ({ journeyId: 'j1', stateRevision: 1, ...over });

test('stays silent in resting and listening (no meaningful spoken content)', () => {
  assert.equal(voiceUtteranceForState('resting', ctx()), null);
  assert.equal(voiceUtteranceForState('listening', ctx()), null);
});

test('authors an utterance for each meaningful state', () => {
  for (const state of [
    'focus-surfaced',
    'decision-required',
    'action-underway',
    'proof-created',
  ] as const) {
    const u = voiceUtteranceForState(state, ctx());
    assert.ok(u, `${state} should speak`);
    assert.equal(u?.speaker, 'NEHEMIAH');
    assert.equal(u?.lifecycle, state);
    assert.ok((u?.text.length ?? 0) > 0);
  }
});

test('the decision state is important and speaks the need for Founder judgment', () => {
  const u = voiceUtteranceForState('decision-required', ctx());
  assert.equal(u?.priority, 'important');
  assert.match(u?.text ?? '', /judgment/i);
});

test('utterance identity keys on the transition, not the text', () => {
  const a = voiceUtteranceForState('focus-surfaced', ctx({ stateRevision: 1 }));
  const b = voiceUtteranceForState('focus-surfaced', ctx({ stateRevision: 2 }));
  assert.notEqual(a?.id, b?.id, 'a new revision is a new utterance');

  const c = voiceUtteranceForState('focus-surfaced', ctx({ stateRevision: 1 }));
  assert.equal(a?.id, c?.id, 'same transition dedupes to the same id');

  const d = voiceUtteranceForState('focus-surfaced', ctx({ stateRevision: 1, locale: 'es-US' }));
  assert.notEqual(a?.id, d?.id, 'locale is part of identity');
});

test('carries source-agent provenance without making them speakers', () => {
  const u = voiceUtteranceForState('decision-required', ctx({ sourceAgents: ['ALEXANDER', 'GALILEO'] }));
  assert.deepEqual(u?.sourceAgents, ['ALEXANDER', 'GALILEO']);
  assert.equal(u?.speaker, 'NEHEMIAH');
});

test('all authored copy passes the Voice Constitution and stays within the word cap', () => {
  for (const state of [
    'focus-surfaced',
    'decision-required',
    'action-underway',
    'proof-created',
  ] as const) {
    const u = voiceUtteranceForState(state, ctx());
    const policy = applyVoicePolicy(u!.text, u!.locale);
    assert.equal(policy.ok, true, `${state} copy must be speakable`);
    assert.ok(u!.text.split(' ').length <= MAX_SPOKEN_WORDS);
  }
});
