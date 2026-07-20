import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeFounderMemory,
  findSimilarDecisions,
  filterFounderDecisions,
  summarizeRecurringPatterns,
} from './founder-memory-intelligence';
import type { FounderMemory } from './founder-memory';

const memory: FounderMemory = {
  version: 1,
  decisions: [
    {
      id: 'd1',
      command: 'Authorize the restricted platform pilot for Product and Engineering.',
      disposition: 'approve-with-limits',
      decisionNote: 'Pause one lower-priority initiative.',
      decidedAt: '2026-07-20T12:00:00.000Z',
      visibleAction: 'Approve the pilot boundary and name ownership.',
      actionStartedAt: '2026-07-20T12:01:00.000Z',
      proof: 'Pilot launched with no critical failures.',
      proofRecordedAt: '2026-07-20T13:00:00.000Z',
      lesson: 'Restricted pilots reduce risk while preserving momentum.',
    },
    {
      id: 'd2',
      command: 'Approve a limited coaching cohort pilot.',
      disposition: 'approve-with-limits',
      decisionNote: 'Cap enrollment at twenty members.',
      decidedAt: '2026-07-21T12:00:00.000Z',
      visibleAction: 'Launch the cohort with a limited enrollment boundary.',
      actionStartedAt: '2026-07-21T12:01:00.000Z',
      proof: 'Cohort filled and completed onboarding.',
      proofRecordedAt: '2026-07-21T13:00:00.000Z',
      lesson: 'Limits make early execution safer and clearer.',
    },
    {
      id: 'd3',
      command: 'Reject the unvalidated mobile application expansion.',
      disposition: 'reject',
      decidedAt: '2026-07-22T12:00:00.000Z',
      proof: 'Expansion was removed from the roadmap.',
      proofRecordedAt: '2026-07-22T13:00:00.000Z',
      lesson: 'Do not expand before the core experience is proven.',
    },
  ],
};

test('filters decision history by search text and disposition', () => {
  const results = filterFounderDecisions(memory.decisions, {
    query: 'pilot',
    disposition: 'approve-with-limits',
  });
  assert.deepEqual(results.map((record) => record.id), ['d2', 'd1']);
});

test('finds prior decisions resembling a new Founder command', () => {
  const results = findSimilarDecisions(
    memory.decisions,
    'Should we authorize another restricted Product pilot?',
  );
  assert.equal(results[0]?.record.id, 'd1');
  assert.ok((results[0]?.score ?? 0) > 0);
});

test('summarizes recurring disposition and boundary patterns', () => {
  const patterns = summarizeRecurringPatterns(memory.decisions);
  assert.match(patterns[0]?.summary ?? '', /approve with limits/i);
  assert.equal(patterns[0]?.count, 2);
});

test('creates an intelligence summary with lessons and similar decisions', () => {
  const intelligence = analyzeFounderMemory(
    memory,
    'Authorize a restricted pilot for the next coaching product.',
  );
  assert.equal(intelligence.totalDecisions, 3);
  assert.ok(intelligence.lessons.length >= 3);
  assert.equal(intelligence.similarDecisions[0]?.record.id, 'd1');
});
