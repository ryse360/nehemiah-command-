# Nehemiah Command

Nehemiah is the Founder’s private intelligence and strategic operating interface for MiP Coaching.

## Phase 1

This production prototype implements the approved six-state behavior system:

1. Resting
2. Listening
3. Focus Surfaced
4. Decision Required
5. Action Underway
6. Proof Created

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

## Canonical documentation

- `docs/design/phase-1-state-system.md`
- `docs/design/motion-specification.md`
- `docs/design/engineering-handoff.md`
- `docs/BUILD_LOG.md`
- `docs/superpowers/plans/2026-07-20-nehemiah-phase-1.md`

## Founder decision journey

Version 0.4.0 adds the first governed behavior loop. Begin in the resting state, submit a command, surface focus, prepare the decision, select a Founder disposition, capture visible proof, and close the review.

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

## Founder Memory Intelligence

Decision history is searchable and filterable. Nehemiah preserves lessons, detects repeated decision patterns, and surfaces relevant precedents when a new Founder command resembles a prior situation.

## Current Milestone

Security Hardening protects Founder access with scrypt password hashes, revocable versioned sessions, rate limits, rotating integration keys, redacted security audit events, and restrictive HTTP headers.


## Cloud persistence setup

1. Provision PostgreSQL and run `docs/database/001-founder-memory.sql`.
2. Copy `.env.example` to `.env.local`.
3. Configure `DATABASE_URL`, `NEHEMIAH_FOUNDER_ID`, `NEHEMIAH_FOUNDER_PASSWORD_HASH`, and `NEHEMIAH_SESSION_SECRET`.
4. Run all database migrations through `docs/database/003-security-hardening.sql`.

Browser memory remains available when cloud configuration is absent. Cloud writes use revision checks so a stale device cannot silently overwrite newer Founder memory.

## Founder authentication

Generate `NEHEMIAH_FOUNDER_PASSWORD_HASH` with `npm run security:hash-password -- "your passphrase"` and set a long random `NEHEMIAH_SESSION_SECRET` before deployment. Nehemiah uses a signed HttpOnly session cookie; Founder memory APIs no longer accept manually entered access keys.

## Authorization boundaries (v0.16.0)

Nehemiah separates Founder-private memory, MiP enterprise context, and external integration signals. Authorization is enforced on the server. Run `docs/database/002-authorization-data-boundaries.sql` and configure `NEHEMIAH_INTEGRATION_KEYS` before enabling integrations.


## Security hardening (v0.17.1)

Run `docs/database/003-security-hardening.sql`, configure `NEHEMIAH_AUTH_VERSION`, and use the rotating integration-key format in `.env.example`. See `docs/security/incident-response.md` and `docs/security/backup-recovery.md` before production rollout.


## Security exit gate

```bash
npm run security:check-readiness
npm run security:verify-backup -- docs/security/backup-manifest.example.json
```

Production distributed rate limiting requires `DATABASE_URL` and migration `004-security-exit-gate.sql`.
