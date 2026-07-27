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
- [x] Current dependency audit — 2026-07-27, registry responsive for the first
      time since v0.17.1. Evidence: `docs/production/dependency-audit-result.json`.
      See `docs/security/dependency-advisory.md`.
- [ ] Production secrets validated
- [ ] PostgreSQL and migrations verified in production
- [ ] Encrypted backup and restore rehearsed
- [ ] Production URL verified
- [ ] Five-session Founder pilot passed
- [ ] No unresolved critical or unaccepted high issues — **3 high remain**
      (`postcss` and `sharp`, both nested inside Next.js; `next` itself is
      clean at 16.2.12). No upstream fix exists today. Requires an explicit
      Founder risk acceptance or an `overrides` remediation; options are laid
      out in `docs/security/dependency-advisory.md`.
- [ ] Founder release approval recorded

Production v1.0.0 must not be tagged until every production-gate item has evidence.
