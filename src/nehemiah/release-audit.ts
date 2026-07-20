export type ReleaseAuditInput = {
  requiredFilesPresent: boolean;
  requiredMigrationsPresent: boolean;
  requiredTagsPresent: boolean;
  testsPassed: boolean;
  typecheckPassed: boolean;
  buildPassed: boolean;
  performancePassed: boolean;
  smokePassed: boolean;
  securityHeadersVerified: boolean;
  dependencyAuditCurrent: boolean;
  productionSecretsInstalled: boolean;
  cloudDatabaseReady: boolean;
  backupRestoreVerified: boolean;
  productionDeploymentVerified: boolean;
  founderPilotPassed: boolean;
  founderApproved: boolean;
};

export function auditReleaseCandidate(input: ReleaseAuditInput) {
  const codeBlockers: string[] = [];
  if (!input.requiredFilesPresent) codeBlockers.push('One or more required release files are missing.');
  if (!input.requiredMigrationsPresent) codeBlockers.push('One or more required database migrations are missing.');
  if (!input.requiredTagsPresent) codeBlockers.push('One or more required release tags are missing.');
  if (!input.testsPassed) codeBlockers.push('The automated test suite has not passed.');
  if (!input.typecheckPassed) codeBlockers.push('Strict type checking has not passed.');
  if (!input.buildPassed) codeBlockers.push('Optimized production build has not passed.');
  if (!input.performancePassed) codeBlockers.push('Performance budget has not passed.');
  if (!input.smokePassed) codeBlockers.push('Runtime smoke checks have not passed.');
  if (!input.securityHeadersVerified) codeBlockers.push('Security headers have not been verified.');

  const externalBlockers: string[] = [];
  if (!input.dependencyAuditCurrent) externalBlockers.push('Dependency audit evidence is not current.');
  if (!input.productionSecretsInstalled) externalBlockers.push('Production secrets have not been installed and validated.');
  if (!input.cloudDatabaseReady) externalBlockers.push('Cloud database and migrations have not been verified.');
  if (!input.backupRestoreVerified) externalBlockers.push('Encrypted backup and restore rehearsal have not been verified.');
  if (!input.productionDeploymentVerified) externalBlockers.push('Production deployment has not been verified.');
  if (!input.founderPilotPassed) externalBlockers.push('Founder pilot exit gate has not passed.');
  if (!input.founderApproved) externalBlockers.push('Founder has not explicitly approved the production release.');

  const codeReady = codeBlockers.length === 0;
  return { codeReady, productionReady: codeReady && externalBlockers.length === 0, codeBlockers, externalBlockers };
}
