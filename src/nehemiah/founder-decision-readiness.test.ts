import assert from 'node:assert/strict';
import test from 'node:test';
import { assessDecisionReadiness } from './founder-decision-readiness';
import type { StrategicConsequenceMap } from './strategic-consequence-mapping';
import type { StrategicRecall } from './founder-strategic-recall';

const consequenceMap: StrategicConsequenceMap = {
  immediateResponse: 'Product and Engineering will run a bounded pilot.',
  secondOrderConsequence: 'Capacity will be consumed.',
  resourceTradeoff: 'Pause one lower-priority initiative.',
  preparedContinuation: 'Require proof before expansion.',
  stopCondition: 'Stop if context transfer fails.',
  assumptions: ['Founder authority is required.'],
  riskLevel: 'moderate',
  founderQuestion: 'What happens next?',
};

test('marks a decision ready when all five readiness dimensions are explicit', () => {
  const result = assessDecisionReadiness(
    'Authorize a restricted platform pilot with Product and Engineering ownership and a context-transfer proof gate.',
    consequenceMap,
    null,
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.score, 5);
  assert.deepEqual(result.missing, []);
});

test('blocks Founder escalation when ownership and proof criteria are missing', () => {
  const result = assessDecisionReadiness('Launch the new initiative.', null, null);

  assert.equal(result.status, 'not-ready');
  assert.ok(result.missing.includes('ownership'));
  assert.ok(result.missing.includes('proof'));
  assert.equal(result.canSurfaceToFounder, false);
});

test('requires stronger evidence when a costly precedent warning exists', () => {
  const recall = {
    warning: { message: 'Prior execution failed because context transfer evidence was insufficient.' },
  } as StrategicRecall;

  const result = assessDecisionReadiness(
    'Authorize a restricted platform pilot with Product ownership and a proof gate.',
    { ...consequenceMap, riskLevel: 'high' },
    recall,
  );

  assert.equal(result.status, 'conditional');
  assert.ok(result.missing.includes('evidence'));
  assert.equal(result.canSurfaceToFounder, true);
});
