# Rollback Runbook

1. Stop new integration ingestion if integrity or privacy is at risk.
2. Identify the last verified Git tag and database migration state.
3. Preserve current logs and audit evidence.
4. Restore the last verified application deployment.
5. Roll back database changes only when the migration has an approved reverse plan; otherwise restore from the verified encrypted backup.
6. Run health, authentication-boundary, memory-integrity, and smoke checks.
7. Record the incident, consequence, correction, and proof of recovery.
