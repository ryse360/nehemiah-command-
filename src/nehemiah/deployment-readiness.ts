export const REQUIRED_ENVIRONMENT = [
  'DATABASE_URL',
  'NEHEMIAH_FOUNDER_ID',
  'NEHEMIAH_FOUNDER_PASSWORD_HASH',
  'NEHEMIAH_SESSION_SECRET',
  'NEHEMIAH_AUTH_VERSION',
  'NEHEMIAH_AI_API_KEY',
  'NEHEMIAH_AI_MODEL',
] as const;

export const REQUIRED_MIGRATIONS = [
  '001-founder-memory.sql',
  '002-authorization-data-boundaries.sql',
  '003-security-hardening.sql',
  '004-security-exit-gate.sql',
  '005-drive-obsidian-knowledge.sql',
  '006-founder-pilot.sql',
] as const;

const REQUIRED_BACKUP_TABLES = [
  'founder_memory', 'enterprise_context', 'integration_signals',
  'security_audit_events', 'revoked_founder_sessions', 'distributed_rate_limit_attempts', 'knowledge_sources', 'founder_pilot_sessions',
] as const;

export function assessDeploymentReadiness(
  environment: Record<string, string | undefined>,
  migrationFiles: string[],
) {
  const missingEnvironment = REQUIRED_ENVIRONMENT.filter((key) => {
    const value = environment[key];
    if (!value) return true;
    if (key === 'NEHEMIAH_SESSION_SECRET') return value.length < 32;
    return false;
  });
  const missingMigrations = REQUIRED_MIGRATIONS.filter((name) => !migrationFiles.includes(name));
  return { ready: missingEnvironment.length === 0 && missingMigrations.length === 0, missingEnvironment, missingMigrations };
}

export type BackupManifest = {
  createdAt?: string;
  encrypted?: boolean;
  tables?: string[];
  restoreRehearsedAt?: string;
  checksum?: string;
};

export function verifyBackupManifest(manifest: BackupManifest) {
  const missingTables = REQUIRED_BACKUP_TABLES.filter((table) => !manifest.tables?.includes(table));
  const errors: string[] = [];
  if (!manifest.createdAt || Number.isNaN(Date.parse(manifest.createdAt))) errors.push('A valid backup creation time is required.');
  if (manifest.encrypted !== true) errors.push('The backup must be encrypted.');
  if (!manifest.restoreRehearsedAt || Number.isNaN(Date.parse(manifest.restoreRehearsedAt))) errors.push('A restore rehearsal time is required.');
  if (!manifest.checksum?.startsWith('sha256:')) errors.push('A SHA-256 checksum is required.');
  if (missingTables.length) errors.push(`Missing protected tables: ${missingTables.join(', ')}`);
  return { valid: errors.length === 0, errors, missingTables };
}
