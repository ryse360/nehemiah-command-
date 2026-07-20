export {};
import { existsSync, readdirSync } from 'node:fs';
import { assessDeploymentReadiness } from '../src/nehemiah/deployment-readiness';
import { evaluateDeploymentRehearsal } from '../src/nehemiah/deployment-rehearsal';

const migrationFiles = existsSync('docs/database') ? readdirSync('docs/database') : [];
const readiness = assessDeploymentReadiness(process.env, migrationFiles);
const evidence = {
  readiness: readiness.ready,
  migrations: readiness.missingMigrations.length === 0,
  backupRestore: process.env.NEHEMIAH_BACKUP_RESTORE_VERIFIED === 'true',
  tests: process.env.NEHEMIAH_TESTS_VERIFIED === 'true',
  typecheck: process.env.NEHEMIAH_TYPECHECK_VERIFIED === 'true',
  build: existsSync('.next/BUILD_ID'),
  performance: process.env.NEHEMIAH_PERFORMANCE_VERIFIED === 'true',
  smoke: process.env.NEHEMIAH_SMOKE_VERIFIED === 'true',
  securityHeaders: process.env.NEHEMIAH_HEADERS_VERIFIED === 'true',
  rollbackPrepared: process.env.NEHEMIAH_ROLLBACK_PREPARED === 'true',
};
const result = evaluateDeploymentRehearsal(evidence);
console.log(JSON.stringify({ readiness, evidence, result }, null, 2));
if (result.status !== 'pass') process.exit(1);
