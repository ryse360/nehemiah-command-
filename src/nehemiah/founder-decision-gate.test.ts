import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFounderDecisionGate } from './founder-decision-gate';
import type { FounderDecisionReadiness } from './founder-decision-readiness';

function readiness(status: FounderDecisionReadiness['status']): FounderDecisionReadiness {
  const score = status === 'ready' ? 5 : status === 'conditional' ? 3 : 2;
  return {
    score,
    total: 5,
    status,
    canSurfaceToFounder: status !== 'not-ready',
    dimensions: [],
    missing: status === 'ready' ? [] : ['evidence'],
    summary: 'summary',
    nextRequirement: status === 'ready' ? undefined : 'Strengthen the evidence.',
  };
}

test('opens the full decision gate when readiness is complete', () => {
  const gate = buildFounderDecisionGate(readiness('ready'));

  assert.equal(gate.status, 'open');
  assert.equal(gate.canOpenDecision, true);
  assert.deepEqual(gate.allowedDispositions, [
    'approve',
    'approve-with-limits',
    'request-evidence',
    'delay',
    'reject',
  ]);
});

test('requires explicit limits before a conditional decision can be approved', () => {
  const gate = buildFounderDecisionGate(readiness('conditional'));

  assert.equal(gate.status, 'conditional');
  assert.equal(gate.canOpenDecision, true);
  assert.equal(gate.allowedDispositions.includes('approve'), false);
  assert.equal(gate.allowedDispositions.includes('approve-with-limits'), true);
  assert.match(gate.message, /limits/i);
});

test('blocks decision disposition when preparation is not ready', () => {
  const gate = buildFounderDecisionGate(readiness('not-ready'));

  assert.equal(gate.status, 'blocked');
  assert.equal(gate.canOpenDecision, false);
  assert.deepEqual(gate.allowedDispositions, ['request-evidence', 'delay', 'reject']);
  assert.match(gate.message, /continue preparing/i);
});
