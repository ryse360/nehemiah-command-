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
- [ ] No unresolved critical or unaccepted high issues
      - [x] **Dependency side cleared.** `npm audit --omit=dev` reports 0
            vulnerabilities across 220 production dependencies, down from 3
            high, via `overrides` on `postcss` and `sharp`. Verified against
            the full gate plus performance, smoke, headers, and a direct
            `sharp` WebP/AVIF encode test. See
            `docs/security/dependency-advisory.md`.
      - [ ] **Pilot side outstanding.** Issue severity from the five-session
            Founder pilot cannot be assessed until that pilot runs. This item
            stays open on that basis alone.
- [ ] Founder release approval recorded

Production v1.0.0 must not be tagged until every production-gate item has evidence.
