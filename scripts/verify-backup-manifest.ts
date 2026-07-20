import { readFile } from 'node:fs/promises';
import { verifyBackupManifest } from '../src/nehemiah/deployment-readiness';

const path = process.argv[2];
if (!path) {
  console.error('Usage: npm run security:verify-backup -- path/to/backup-manifest.json');
  process.exit(1);
}
const manifest = JSON.parse(await readFile(path, 'utf8'));
const result = verifyBackupManifest(manifest);
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exit(1);
