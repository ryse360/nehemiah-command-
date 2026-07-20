import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConsequenceMap } from './strategic-consequence-mapping';
import type { StrategicRecall } from './founder-strategic-recall';

const recall: StrategicRecall = {
  headline: 'Relevant precedent found before this decision moves forward.',
  precedent: {
    record: {
      id: 'platform-pilot',
      command: 'Authorize a restricted platform pilot for Product and Engineering.',
      disposition: 'approve-with-limits',
      decisionNote: 'Pause one lower-priority initiative and cap the pilot at ten users.',
      decidedAt: '2026-07-20T12:00:00.000Z',
      visibleAction: 'Name Product ownership and define the activation gate.',
      actionStartedAt: '2026-07-20T12:01:00.000Z',
      proof: 'The pilot launched but context transfer failed twice and delayed onboarding.',
      proofRecordedAt: '2026-07-20T13:00:00.000Z',
      lesson: 'Do not expand the platform until context transfer is proven under load.',
    },
    score: 0.72,
    sharedTerms: ['restricted', 'platform', 'pilot'],
  },
  similarities: ['restricted', 'platform', 'pilot'],
  differences: { currentOnly: ['context', 'layer'], precedentOnly: ['engineering'] },
  founderQuestion: 'What is structurally different this time?',
};

test('maps three moves ahead for a restricted pilot decision', () => {
  const map = buildConsequenceMap(
    'Authorize a restricted platform pilot for a new AI context layer.',
    recall,
  );

  assert.match(map.immediateResponse, /product|engineering|pilot/i);
  assert.match(map.secondOrderConsequence, /capacity|onboarding|context|priority/i);
  assert.match(map.resourceTradeoff, /pause|capacity|initiative|time/i);
  assert.match(map.preparedContinuation, /gate|proof|rollback|boundary/i);
});

test('uses costly precedent to strengthen the continuation', () => {
  const map = buildConsequenceMap(
    'Authorize another restricted platform pilot before context transfer is proven.',
    recall,
  );

  assert.equal(map.riskLevel, 'high');
  assert.match(map.preparedContinuation, /context transfer/i);
  assert.match(map.stopCondition, /fail|delay|threshold|rollback/i);
});

test('creates a bounded neutral map when no precedent exists', () => {
  const map = buildConsequenceMap('Launch a limited coaching cohort for twenty members.', null);

  assert.equal(map.riskLevel, 'moderate');
  assert.ok(map.assumptions.length > 0);
  assert.match(map.founderQuestion, /response|consequence|continuation/i);
});
