import { readdir } from 'node:fs/promises';
import { assessDeploymentReadiness } from '../src/nehemiah/deployment-readiness';

const migrations = await readdir(new URL('../docs/database/', import.meta.url));
const report = assessDeploymentReadiness(process.env, migrations);
console.log(JSON.stringify(report, null, 2));
if (!report.ready) process.exit(1);
