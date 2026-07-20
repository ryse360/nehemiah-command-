import assert from 'node:assert/strict';
import test from 'node:test';
import type { FounderJourney } from './founder-journey';
import {
  appendJourneyWithIntegrity,
  createIntegrityMemory,
  reviseDecisionRecord,
  verifyDecisionRecordIntegrity,
} from './decision-record-integrity';

const journey: FounderJourney = {
  lifecycle: 'proof-created',
  command: 'Authorize the restricted pilot.',
  decision: {
    disposition: 'approve-with-limits',
    note: 'Pause one lower-priority initiative.',
    decidedAt: '2026-07-20T12:00:00.000Z',
  },
  action: {
    visibleAction: 'Approve the pilot boundary and name ownership.',
    startedAt: '2026-07-20T12:01:00.000Z',
  },
  proof: {
    evidence: 'Pilot completed with correct context transfer.',
    lesson: 'Use a restricted pilot before wider activation.',
    recordedAt: '2026-07-20T13:00:00.000Z',
  },
  history: [
    { kind: 'command', summary: 'Authorize the restricted pilot.', recordedAt: '2026-07-20T11:55:00.000Z' },
    { kind: 'decision', summary: 'Decision disposition: approve-with-limits.', recordedAt: '2026-07-20T12:00:00.000Z' },
    { kind: 'proof', summary: 'Pilot completed with correct context transfer.', recordedAt: '2026-07-20T13:00:00.000Z' },
  ],
};

test('archives a versioned decision with provenance and a valid audit chain', () => {
  const memory = appendJourneyWithIntegrity(createIntegrityMemory(), journey);
  const record = memory.decisions[0];

  assert.equal(memory.version, 2);
  assert.equal(record?.recordVersion, 1);
  assert.equal(record?.provenance.length, 3);
  assert.equal(record?.auditTrail.length, 1);
  assert.equal(record?.auditTrail[0]?.eventType, 'decision-archived');
  assert.equal(verifyDecisionRecordIntegrity(record!), true);
});

test('detects material record tampering', () => {
  const memory = appendJourneyWithIntegrity(createIntegrityMemory(), journey);
  const record = memory.decisions[0]!;
  const tampered = { ...record, proof: 'A different outcome.' };

  assert.equal(verifyDecisionRecordIntegrity(tampered), false);
});

test('creates a new immutable revision instead of overwriting the prior version', () => {
  const memory = appendJourneyWithIntegrity(createIntegrityMemory(), journey);
  const original = memory.decisions[0]!;
  const revised = reviseDecisionRecord(
    memory,
    original.id,
    { lesson: 'Require a named rollback owner before activation.' },
    'Founder',
    'Clarified the operating lesson after review.',
    '2026-07-21T09:00:00.000Z',
  );

  assert.equal(revised.decisions.length, 2);
  assert.equal(revised.decisions[0]?.recordVersion, 2);
  assert.equal(revised.decisions[0]?.supersedesVersion, 1);
  assert.equal(revised.decisions[1]?.recordVersion, 1);
  assert.equal(revised.decisions[1]?.lesson, original.lesson);
  assert.equal(revised.decisions[0]?.auditTrail.length, 2);
  assert.equal(verifyDecisionRecordIntegrity(revised.decisions[0]!), true);
});

test('rejects revisions without a reason or material change', () => {
  const memory = appendJourneyWithIntegrity(createIntegrityMemory(), journey);
  const id = memory.decisions[0]!.id;

  assert.throws(() => reviseDecisionRecord(memory, id, { lesson: journey.proof?.lesson }, 'Founder', ' ', '2026-07-21T09:00:00.000Z'));
  assert.throws(() => reviseDecisionRecord(memory, id, {}, 'Founder', 'Correction', '2026-07-21T09:00:00.000Z'));
});
