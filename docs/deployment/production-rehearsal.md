# Production Deployment Rehearsal

A release may proceed only when all ten gates have current evidence:

1. Production secrets and configuration readiness
2. Database migrations applied
3. Encrypted backup and successful restore rehearsal
4. Full automated test suite
5. Strict TypeScript checking
6. Optimized production build
7. Static-asset performance budget
8. Runtime smoke test
9. Security-header inspection
10. Rollback target and operator prepared

## Rehearsal command

Run the build and verification commands, set the `NEHEMIAH_*_VERIFIED` evidence variables, then execute:

```bash
npm run deployment:rehearse
```

The script fails closed if any gate lacks evidence. A rehearsal report must be preserved with the release record. Deployment credentials and secret values must never appear in that report.
