import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionState, type NehemiahEvent, type NehemiahState } from './state-machine.ts';

test('moves from resting to listening when founder input begins', () => {
  assert.equal(transitionState('resting', 'input-started'), 'listening');
});

test('moves through the complete approved decision lifecycle', () => {
  const events: NehemiahEvent[] = [
    'input-started',
    'focus-identified',
    'decision-justified',
    'decision-approved',
    'proof-received',
  ];

  const finalState = events.reduce<NehemiahState>(
    (state, event) => transitionState(state, event),
    'resting',
  );

  assert.equal(finalState, 'proof-created');
});

test('rejects transitions that have no approved purpose', () => {
  assert.throws(
    () => transitionState('resting', 'decision-approved'),
    /Invalid Nehemiah transition/,
  );
});
