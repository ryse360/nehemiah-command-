import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShellModel } from './shell-model.ts';

test('resting state keeps the Founder canvas quiet', () => {
  const model = buildShellModel('resting');

  assert.equal(model.showFocus, false);
  assert.equal(model.showDecision, false);
  assert.equal(model.showAction, false);
  assert.equal(model.showProof, false);
  assert.equal(model.organismState, 'resting');
});

test('decision state exposes one Founder decision and no status strip', () => {
  const model = buildShellModel('decision-required');

  assert.equal(model.showFocus, true);
  assert.equal(model.showDecision, true);
  assert.equal(model.permanentStatusStrip, false);
  assert.equal(model.decision?.title, 'Authorize Platform v2 Restricted Pilot');
});

test('proof state uses Founder-approved language', () => {
  const model = buildShellModel('proof-created');

  assert.equal(model.showProof, true);
  assert.equal(model.proofMessage, 'Proof change is possible.');
});
