import test from 'node:test';
import assert from 'node:assert/strict';
import type { NehemiahState } from './state-machine';
import { organismRenderModel } from './organism-render-model';

const approvedStates: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

test('provides render parameters for every approved state', () => {
  assert.deepEqual(
    Object.keys(organismRenderModel).sort(),
    [...approvedStates].sort(),
  );
});

test('resting is alive while remaining visually restrained', () => {
  const resting = organismRenderModel.resting;

  assert.ok(resting.breathAmplitude > 0);
  assert.ok(resting.particleSpeed <= 0.25);
  assert.ok(resting.goldIntensity < 1);
});

test('decision strengthens neural focus above resting', () => {
  assert.ok(
    organismRenderModel['decision-required'].threadOpacity >
      organismRenderModel.resting.threadOpacity,
  );
});

test('proof has stronger gold emphasis than action', () => {
  assert.ok(
    organismRenderModel['proof-created'].goldIntensity >
      organismRenderModel['action-underway'].goldIntensity,
  );
});
