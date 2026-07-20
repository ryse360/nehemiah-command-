import test from 'node:test';
import assert from 'node:assert/strict';
import { auditReleaseCandidate, type ReleaseAuditInput } from './release-audit';

const completeInput = (overrides: Partial<ReleaseAuditInput> = {}): ReleaseAuditInput => ({
  requiredFilesPresent: true,
  requiredMigrationsPresent: true,
  requiredTagsPresent: true,
  testsPassed: true,
  typecheckPassed: true,
  buildPassed: true,
  performancePassed: true,
  smokePassed: true,
  securityHeadersVerified: true,
  dependencyAuditCurrent: true,
  productionSecretsInstalled: true,
  cloudDatabaseReady: true,
  backupRestoreVerified: true,
  productionDeploymentVerified: true,
  founderPilotPassed: true,
  founderApproved: true,
  ...overrides,
});

test('code release candidate passes when all internal engineering gates are present', () => {
  const result = auditReleaseCandidate(completeInput({ productionDeploymentVerified: false, founderPilotPassed: false, founderApproved: false }));
  assert.equal(result.codeReady, true);
  assert.equal(result.productionReady, false);
  assert.ok(result.externalBlockers.includes('Production deployment has not been verified.'));
});

test('code readiness fails when a build or migration is missing', () => {
  const result = auditReleaseCandidate(completeInput({ buildPassed: false, requiredMigrationsPresent: false }));
  assert.equal(result.codeReady, false);
  assert.ok(result.codeBlockers.includes('Optimized production build has not passed.'));
  assert.ok(result.codeBlockers.includes('One or more required database migrations are missing.'));
});

test('production readiness requires all external evidence and Founder approval', () => {
  const result = auditReleaseCandidate(completeInput());
  assert.equal(result.codeReady, true);
  assert.equal(result.productionReady, true);
  assert.deepEqual(result.externalBlockers, []);
});
