# Backup and Recovery Controls

- Use encrypted managed PostgreSQL backups with point-in-time recovery.
- Retain daily backups for at least 30 days during the Founder pilot.
- Run a monthly restoration rehearsal into an isolated database.
- Compare restored Founder memory record counts and audit-chain verification with production.
- Never place database dumps, secrets, or access keys in Git or release archives.
- Record each completed restoration rehearsal as a `backup.verified` security audit event.
