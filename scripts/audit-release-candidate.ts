export {};
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { auditReleaseCandidate } from '../src/nehemiah/release-audit';

const requiredFiles = [
  'docs/database/001-founder-memory.sql',
  'docs/database/002-authorization-data-boundaries.sql',
  'docs/database/003-security-hardening.sql',
  'docs/database/004-security-exit-gate.sql',
  'docs/database/005-drive-obsidian-knowledge.sql',
  'docs/database/006-founder-pilot.sql',
  'docs/deployment/production-rehearsal.md',
  'docs/pilot/founder-pilot-protocol.md',
  'docs/operations/monitoring-and-incidents.md',
];
const requiredTags = ['v0.21.0','v0.22.0','v0.23.0','v0.24.0','v0.25.0'];
let tags: string[] = [];
try { tags = execFileSync('git', ['tag'], { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean); } catch {}

const evidence = {
  requiredFilesPresent: requiredFiles.every(existsSync),
  requiredMigrationsPresent: requiredFiles.filter((file) => file.includes('/database/')).every(existsSync),
  requiredTagsPresent: requiredTags.every((tag) => tags.includes(tag)),
  testsPassed: process.env.NEHEMIAH_TESTS_VERIFIED === 'true',
  typecheckPassed: process.env.NEHEMIAH_TYPECHECK_VERIFIED === 'true',
  buildPassed: existsSync('.next/BUILD_ID'),
  performancePassed: process.env.NEHEMIAH_PERFORMANCE_VERIFIED === 'true',
  smokePassed: process.env.NEHEMIAH_SMOKE_VERIFIED === 'true',
  securityHeadersVerified: process.env.NEHEMIAH_HEADERS_VERIFIED === 'true',
  dependencyAuditCurrent: process.env.NEHEMIAH_DEPENDENCY_AUDIT_CURRENT === 'true',
  productionSecretsInstalled: process.env.NEHEMIAH_PRODUCTION_SECRETS_VERIFIED === 'true',
  cloudDatabaseReady: process.env.NEHEMIAH_DATABASE_VERIFIED === 'true',
  backupRestoreVerified: process.env.NEHEMIAH_BACKUP_RESTORE_VERIFIED === 'true',
  productionDeploymentVerified: process.env.NEHEMIAH_PRODUCTION_DEPLOYMENT_VERIFIED === 'true',
  founderPilotPassed: process.env.NEHEMIAH_FOUNDER_PILOT_PASSED === 'true',
  founderApproved: process.env.NEHEMIAH_FOUNDER_RELEASE_APPROVED === 'true',
};
const result = auditReleaseCandidate(evidence);
console.log(JSON.stringify({ version: JSON.parse(readFileSync('package.json','utf8')).version, evidence, result }, null, 2));
if (!result.codeReady) process.exit(1);
if (process.argv.includes('--require-production') && !result.productionReady) process.exit(2);
