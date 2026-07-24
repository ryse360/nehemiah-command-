import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORGANISM_STATUS_LABEL,
  commandSurfaceByState,
  organismStateLabels,
  restingLabCommandSurface,
} from './organism-lab-contract';
import type { NehemiahState } from './state-machine';

const states: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

test('the resting state announces itself as BREATHING', () => {
  assert.equal(ORGANISM_STATUS_LABEL, 'BREATHING');
});

test('the command surface exists but is inactive in the resting milestone', () => {
  assert.equal(restingLabCommandSurface.active, false);
  assert.ok(restingLabCommandSurface.placeholder.length > 0);
  assert.ok(restingLabCommandSurface.helperText.length > 0);
});

test('every state carries a restrained uppercase label', () => {
  for (const state of states) {
    const label = organismStateLabels[state];
    assert.ok(label.length > 0);
    assert.equal(label, label.toUpperCase());
    assert.ok(!label.includes('...'), 'no loading-toast ellipses');
  }
});

test('labels follow the tense arc and end past-tense at proof', () => {
  assert.equal(organismStateLabels.resting, 'BREATHING');
  assert.equal(organismStateLabels['decision-required'], 'WEIGHING');
  assert.equal(organismStateLabels['proof-created'], 'WITNESSED');
  assert.ok(
    organismStateLabels['proof-created'].endsWith('ED'),
    'the final state breaks present tense deliberately',
  );
});

test('labels are unique across states', () => {
  const labels = states.map((state) => organismStateLabels[state]);
  assert.equal(new Set(labels).size, labels.length);
});

test('the command surface is never functionally active in the laboratory', () => {
  for (const state of states) {
    assert.equal(commandSurfaceByState[state].active, false);
  }
});

test('the surface is dormant at rest and attentive once the organism wakes', () => {
  assert.equal(commandSurfaceByState.resting.presence, 'dormant');
  for (const state of states.filter((s) => s !== 'resting')) {
    assert.equal(commandSurfaceByState[state].presence, 'attentive');
  }
});
