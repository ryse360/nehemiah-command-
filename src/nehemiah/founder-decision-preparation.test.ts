import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDecisionPreparation,
  buildDecisionPreparationWorkspace,
  resolvePreparationItem,
} from './founder-decision-preparation';
import type { FounderDecisionReadiness } from './founder-decision-readiness';

function readiness(missing: FounderDecisionReadiness['missing']): FounderDecisionReadiness {
  const keys = ['evidence', 'ownership', 'capacity', 'boundaries', 'proof'] as const;
  const dimensions = keys.map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    ready: !missing.includes(key),
    explanation: missing.includes(key) ? `${key} is missing.` : `${key} is ready.`,
  }));
  const score = 5 - missing.length;
  return {
    score,
    total: 5,
    status: score === 5 ? 'ready' : score >= 3 ? 'conditional' : 'not-ready',
    canSurfaceToFounder: score >= 3,
    dimensions,
    missing,
    summary: 'summary',
    nextRequirement: missing.length ? `${missing[0]} is missing.` : undefined,
  };
}

test('creates one actionable preparation item for every missing readiness dimension', () => {
  const workspace = buildDecisionPreparationWorkspace(readiness(['ownership', 'proof']));

  assert.equal(workspace.status, 'in-progress');
  assert.deepEqual(workspace.items.map((item) => item.dimension), ['ownership', 'proof']);
  assert.match(workspace.items[0].prompt, /accountable/i);
  assert.match(workspace.items[1].prompt, /proof/i);
});

test('rejects empty or vague preparation responses', () => {
  const workspace = buildDecisionPreparationWorkspace(readiness(['capacity']));

  assert.throws(
    () => resolvePreparationItem(workspace, 'capacity', 'later'),
    /specific response/i,
  );
});

test('resolves a preparation item and records the Founder supplied detail', () => {
  const workspace = buildDecisionPreparationWorkspace(readiness(['boundaries']));
  const resolved = resolvePreparationItem(
    workspace,
    'boundaries',
    'Limit the pilot to 20 members and stop after two critical failures.',
  );

  assert.equal(resolved.status, 'complete');
  assert.equal(resolved.items[0].status, 'resolved');
  assert.match(resolved.items[0].response ?? '', /20 members/i);
});

test('recalculates decision readiness after preparation requirements are resolved', () => {
  const original = readiness(['ownership', 'proof']);
  let workspace = buildDecisionPreparationWorkspace(original);
  workspace = resolvePreparationItem(
    workspace,
    'ownership',
    'Product owns pilot delivery and Engineering owns context-transfer reliability.',
  );
  workspace = resolvePreparationItem(
    workspace,
    'proof',
    'Proof requires 20 completed sessions with correct context transfer and no critical failures.',
  );

  const updated = applyDecisionPreparation(original, workspace);

  assert.equal(updated.status, 'ready');
  assert.equal(updated.score, 5);
  assert.deepEqual(updated.missing, []);
  assert.equal(updated.canSurfaceToFounder, true);
});
