# Nehemiah v1 Release Checklist

## Code gate — v1.0.0-rc.1
- [x] Full tests pass
- [x] Strict TypeScript passes
- [x] Optimized build passes
- [x] Performance budget passes
- [x] Runtime smoke test passes
- [x] Security headers verified
- [x] Required migrations and release tags present

## Production gate
- [ ] Current dependency audit
- [ ] Production secrets validated
- [ ] PostgreSQL and migrations verified in production
- [ ] Encrypted backup and restore rehearsed
- [ ] Production URL verified
- [ ] Five-session Founder pilot passed
- [ ] No unresolved critical or unaccepted high issues
- [ ] Founder release approval recorded

Production v1.0.0 must not be tagged until every production-gate item has evidence.
