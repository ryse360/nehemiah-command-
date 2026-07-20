import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addPreparationEvidence,
  verifyPreparationEvidence,
  type PreparationEvidenceInput,
} from './founder-decision-evidence';
import { buildDecisionPreparationWorkspace, resolvePreparationItem } from './founder-decision-preparation';
import type { FounderDecisionReadiness } from './founder-decision-readiness';

function readiness(): FounderDecisionReadiness {
  return {
    score: 4,
    total: 5,
    status: 'conditional',
    canSurfaceToFounder: true,
    dimensions: [
      { key: 'evidence', label: 'Evidence', ready: false, explanation: 'Evidence is missing.' },
      { key: 'ownership', label: 'Ownership', ready: true, explanation: 'Ownership is ready.' },
      { key: 'capacity', label: 'Capacity', ready: true, explanation: 'Capacity is ready.' },
      { key: 'boundaries', label: 'Boundaries', ready: true, explanation: 'Boundaries are ready.' },
      { key: 'proof', label: 'Proof', ready: true, explanation: 'Proof is ready.' },
    ],
    missing: ['evidence'],
    summary: 'The decision may be surfaced with conditions.',
    nextRequirement: 'Evidence is missing.',
  };
}

const linkEvidence: PreparationEvidenceInput = {
  type: 'link',
  title: 'Pilot reliability report',
  reference: 'https://example.com/pilot-report',
  owner: 'Product Operations',
  dueDate: '2026-07-28',
};

test('adds structured evidence to a readiness requirement', () => {
  const workspace = buildDecisionPreparationWorkspace(readiness());
  const updated = addPreparationEvidence(workspace, 'evidence', linkEvidence, '2026-07-20T10:00:00.000Z');

  assert.equal(updated.items[0].evidence.length, 1);
  assert.equal(updated.items[0].evidence[0].type, 'link');
  assert.equal(updated.items[0].evidence[0].verificationStatus, 'unverified');
  assert.equal(updated.items[0].evidence[0].owner, 'Product Operations');
});

test('rejects malformed evidence references', () => {
  const workspace = buildDecisionPreparationWorkspace(readiness());

  assert.throws(
    () => addPreparationEvidence(workspace, 'evidence', { ...linkEvidence, reference: 'not-a-link' }),
    /valid https link/i,
  );
});

test('verified evidence records verifier and verification time', () => {
  const workspace = addPreparationEvidence(
    buildDecisionPreparationWorkspace(readiness()),
    'evidence',
    linkEvidence,
    '2026-07-20T10:00:00.000Z',
  );
  const evidenceId = workspace.items[0].evidence[0].id;
  const verified = verifyPreparationEvidence(
    workspace,
    'evidence',
    evidenceId,
    'Founder',
    '2026-07-20T11:00:00.000Z',
  );

  assert.equal(verified.items[0].evidence[0].verificationStatus, 'verified');
  assert.equal(verified.items[0].evidence[0].verifiedBy, 'Founder');
  assert.equal(verified.items[0].evidence[0].verifiedAt, '2026-07-20T11:00:00.000Z');
});

test('evidence readiness cannot resolve until at least one attachment is verified', () => {
  let workspace = buildDecisionPreparationWorkspace(readiness());
  workspace = addPreparationEvidence(workspace, 'evidence', linkEvidence);

  assert.throws(
    () => resolvePreparationItem(workspace, 'evidence', 'The pilot report demonstrates reliable context transfer.'),
    /verified evidence attachment/i,
  );

  const evidenceId = workspace.items[0].evidence[0].id;
  workspace = verifyPreparationEvidence(workspace, 'evidence', evidenceId, 'Founder');
  const resolved = resolvePreparationItem(
    workspace,
    'evidence',
    'The verified pilot report demonstrates reliable context transfer.',
  );

  assert.equal(resolved.items[0].status, 'resolved');
});
