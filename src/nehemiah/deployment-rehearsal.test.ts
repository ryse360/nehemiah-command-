import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDeploymentRehearsal, parseDeploymentRehearsalEvidence } from './deployment-rehearsal';

const completeEvidence = {
  readiness: true, migrations: true, backupRestore: true, tests: true,
  typecheck: true, build: true, performance: true, smoke: true,
  securityHeaders: true, rollbackPrepared: true,
};

test('passes only when every production gate has evidence', () => {
  const result = evaluateDeploymentRehearsal(completeEvidence);
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.blockers, []);
});

test('blocks release when restore or rollback evidence is missing', () => {
  const result = evaluateDeploymentRehearsal({
    ...completeEvidence,
    backupRestore: false,
    rollbackPrepared: false,
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.includes('backupRestore'));
  assert.ok(result.blockers.includes('rollbackPrepared'));
});

test('reports a bounded release score without claiming partial success', () => {
  const result = evaluateDeploymentRehearsal({
    ...completeEvidence,
    build: false,
    smoke: false,
  });
  assert.equal(result.score, 80);
  assert.equal(result.status, 'blocked');
});

test('rejects missing or non-boolean deployment evidence', () => {
  assert.throws(
    () => parseDeploymentRehearsalEvidence({ ...completeEvidence, smoke: 'yes' }),
    /Boolean evidence is required for: smoke/,
  );
  assert.throws(
    () => parseDeploymentRehearsalEvidence({ ...completeEvidence, unexpected: true }),
    /Unexpected deployment gates: unexpected/,
  );
});
