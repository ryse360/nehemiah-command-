# v1.0.0-rc.1 Release-Candidate Evidence

Verified on 2026-07-20 against the exact release-candidate source.

## Internal engineering evidence

- Automated tests: 122 passed, 0 failed.
- Strict TypeScript: passed.
- Optimized Next.js production build: passed.
- Performance budget: passed at 2,613,466 total static bytes against a 4,000,000-byte budget.
- Runtime smoke: `/api/health` 200, `/` 200, and unauthenticated protected routes 401.
- Security headers: Content Security Policy, Referrer Policy, content-type protection, frame denial, and cross-origin protections passed.
- Required database migrations 001–006: present.
- Required release tags through v0.25.0: present.
- Release audit result: code-ready, not production-ready.

## External evidence not completed in this environment

- A current dependency advisory report. The configured registry audit endpoint returned HTTP 502.
- Installation and validation of real production secrets.
- Provisioned cloud PostgreSQL with migrations 001–006 applied.
- Encrypted backup and successful restore rehearsal.
- Verification of the production deployment URL.
- Five real Founder pilot sessions passing the exit gate.
- Explicit Founder approval for v1.0.0 production release.

The absence of external evidence is a release blocker, not a source-code failure.
