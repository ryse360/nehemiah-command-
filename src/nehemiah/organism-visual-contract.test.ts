import test from 'node:test';
import assert from 'node:assert/strict';
import type { NehemiahState } from './state-machine';
import { organismVisualContract } from './organism-visual-contract';

const approvedStates: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

test('defines one visual profile for every approved Nehemiah state', () => {
  assert.deepEqual(
    Object.keys(organismVisualContract).sort(),
    [...approvedStates].sort(),
  );
});

test('resting remains alive without excessive motion', () => {
  const resting = organismVisualContract.resting;

  assert.equal(resting.continuouslyAlive, true);
  assert.equal(resting.motionIntensity, 'low');
  assert.equal(resting.coreEmphasis, 'quiet');
});

test('proof created uses the strongest controlled gold emphasis', () => {
  const proof = organismVisualContract['proof-created'];

  assert.equal(proof.goldEmphasis, 'strong');
  assert.equal(proof.coreEmphasis, 'resolved');
});
