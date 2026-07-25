import test from 'node:test';
import assert from 'node:assert/strict';
import type { NehemiahState } from './state-machine';
import { organismCoreModel } from './organism-core-model';

const approvedStates: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

test('defines a luminous core profile for every approved state', () => {
  assert.deepEqual(
    Object.keys(organismCoreModel).sort(),
    [...approvedStates].sort(),
  );
});

test('resting core remains alive without excessive pulse or halo', () => {
  const resting = organismCoreModel.resting;

  assert.ok(resting.pulseAmplitude > 0);
  assert.ok(resting.pulseAmplitude <= 0.03);
  assert.ok(resting.haloOpacity <= 0.2);
  assert.ok(resting.emissiveIntensity > 1);
});

test('listening increases attention above resting', () => {
  assert.ok(
    organismCoreModel.listening.pointLightIntensity >
      organismCoreModel.resting.pointLightIntensity,
  );
});

test('proof resolves with stronger illumination than action', () => {
  assert.ok(
    organismCoreModel['proof-created'].emissiveIntensity >
      organismCoreModel['action-underway'].emissiveIntensity,
  );
});
