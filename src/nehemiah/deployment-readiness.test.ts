import test from 'node:test';
import assert from 'node:assert/strict';
import { assessDeploymentReadiness, verifyBackupManifest } from './deployment-readiness';

test('reports missing production secrets and migrations', () => {
  const report = assessDeploymentReadiness({}, ['001-founder-memory.sql']);
  assert.equal(report.ready, false);
  assert.ok(report.missingEnvironment.includes('DATABASE_URL'));
  assert.ok(report.missingMigrations.includes('004-security-exit-gate.sql'));
});

test('accepts a complete production configuration without exposing values', () => {
  const environment = {
    DATABASE_URL: 'postgres://private',
    NEHEMIAH_FOUNDER_ID: 'founder',
    NEHEMIAH_FOUNDER_PASSWORD_HASH: 'scrypt$hash',
    NEHEMIAH_SESSION_SECRET: 'x'.repeat(32),
    NEHEMIAH_AUTH_VERSION: '1',
  };
  const migrations = ['001-founder-memory.sql','002-authorization-data-boundaries.sql','003-security-hardening.sql','004-security-exit-gate.sql'];
  const report = assessDeploymentReadiness(environment, migrations);
  assert.equal(report.ready, true);
  assert.equal(JSON.stringify(report).includes('postgres://private'), false);
});

test('verifies backup manifests contain protected tables and a restore rehearsal', () => {
  const result = verifyBackupManifest({
    createdAt: '2026-07-20T10:00:00.000Z',
    encrypted: true,
    tables: ['founder_memory','enterprise_context','integration_signals','security_audit_events','revoked_founder_sessions','distributed_rate_limit_attempts'],
    restoreRehearsedAt: '2026-07-20T11:00:00.000Z',
    checksum: 'sha256:abc',
  });
  assert.equal(result.valid, true);
});
