import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStrategicRecall } from './founder-strategic-recall';
import type { FounderMemory } from './founder-memory';

const memory = {
  version: 1,
  decisions: [
    {
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
    {
      id: 'cohort-pilot',
      command: 'Approve a limited coaching cohort pilot for twenty members.',
      disposition: 'approve-with-limits',
      decisionNote: 'Cap enrollment at twenty members.',
      decidedAt: '2026-07-21T12:00:00.000Z',
      visibleAction: 'Launch the cohort with a limited enrollment boundary.',
      actionStartedAt: '2026-07-21T12:01:00.000Z',
      proof: 'The cohort filled and completed onboarding without critical failures.',
      proofRecordedAt: '2026-07-21T13:00:00.000Z',
      lesson: 'Bounded pilots preserve momentum when the activation gate is explicit.',
    },
  ],
} as unknown as FounderMemory;

test('introduces the strongest relevant precedent into a live decision', () => {
  const recall = buildStrategicRecall(
    memory,
    'Should we authorize a restricted platform pilot for a new AI context layer?',
  );

  assert.equal(recall?.precedent.record.id, 'platform-pilot');
  assert.match(recall?.headline ?? '', /relevant precedent/i);
  assert.ok((recall?.similarities.length ?? 0) > 0);
});

test('explains what is similar and what is materially different', () => {
  const recall = buildStrategicRecall(
    memory,
    'Should we authorize a restricted platform pilot for a new AI context layer?',
  );

  assert.ok(recall?.similarities.some((item) => /platform|restricted|pilot/i.test(item)));
  assert.ok((recall?.differences.currentOnly.length ?? 0) > 0);
  assert.ok((recall?.differences.precedentOnly.length ?? 0) > 0);
});

test('warns when the closest precedent contains a costly outcome pattern', () => {
  const recall = buildStrategicRecall(
    memory,
    'Authorize another restricted platform pilot before context transfer is proven.',
  );

  assert.equal(recall?.warning?.level, 'caution');
  assert.match(recall?.warning?.message ?? '', /failed|delayed|costly pattern/i);
  assert.match(recall?.founderQuestion ?? '', /different this time/i);
});

test('does not manufacture recall when no prior decision is meaningfully related', () => {
  const recall = buildStrategicRecall(memory, 'Choose the office holiday schedule.');
  assert.equal(recall, null);
});
