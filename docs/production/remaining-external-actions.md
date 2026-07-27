# Remaining External Production Actions

The repository can provide a verified release candidate, but the following evidence must come from the real production environment before v1.0.0 may be declared live:

1. Provision a private PostgreSQL database and apply migrations 001–006.
2. Install production Founder authentication, session, AI, and integration secrets.
3. Configure Google Workspace OAuth and governed synchronization.
4. Configure Drive and Obsidian synchronization paths.
5. Deploy the tagged release to the production hosting project.
6. Verify security headers, authentication boundaries, persistence, AI fail-closed behavior, and integration rate limits on the deployed URL.
7. Schedule encrypted backups and perform a documented restore rehearsal.
8. ~~Obtain a current dependency vulnerability audit through a functioning
   registry.~~ **Done 2026-07-27** — evidence at
   `docs/production/dependency-audit-result.json`. Nine high-severity Next.js
   advisories were resolved by upgrading `next` 16.2.10 → 16.2.12. Three high
   advisories remain inside Next.js's bundled tree with no upstream fix
   available; they now require an explicit Founder risk acceptance rather than
   further audit work. See `docs/security/dependency-advisory.md`.
9. Complete at least five real Founder pilot sessions with no unresolved critical or high issues.
10. Record explicit Founder approval.

Until all ten are evidenced, the system is a production-ready release candidate—not a completed live production deployment.
