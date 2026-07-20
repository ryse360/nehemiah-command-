import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDeploymentRehearsal } from './deployment-rehearsal';

test('passes only when every production gate has evidence', () => {
  const result = evaluateDeploymentRehearsal({
    readiness: true, migrations: true, backupRestore: true, tests: true,
    typecheck: true, build: true, performance: true, smoke: true,
    securityHeaders: true, rollbackPrepared: true,
  });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.blockers, []);
});

test('blocks release when restore or rollback evidence is missing', () => {
  const result = evaluateDeploymentRehearsal({
    readiness: true, migrations: true, backupRestore: false, tests: true,
    typecheck: true, build: true, performance: true, smoke: true,
    securityHeaders: true, rollbackPrepared: false,
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.includes('backupRestore'));
  assert.ok(result.blockers.includes('rollbackPrepared'));
});

test('reports a bounded release score without claiming partial success', () => {
  const result = evaluateDeploymentRehearsal({
    readiness: true, migrations: true, backupRestore: true, tests: true,
    typecheck: true, build: false, performance: true, smoke: false,
    securityHeaders: true, rollbackPrepared: true,
  });
  assert.equal(result.score, 80);
  assert.equal(result.status, 'blocked');
});
