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

Cloud Persistence now moves the complete Founder integrity ledger into a private PostgreSQL database with authenticated API access, revision control, conflict protection, and local-first recovery.


## Cloud persistence setup

1. Provision PostgreSQL and run `docs/database/001-founder-memory.sql`.
2. Copy `.env.example` to `.env.local`.
3. Configure `DATABASE_URL`, `NEHEMIAH_FOUNDER_ID`, and `NEHEMIAH_FOUNDER_ACCESS_KEY`.
4. Start Nehemiah and use the Cloud control to enter the Founder access key for the browser session.

Browser memory remains available when cloud configuration is absent. Cloud writes use revision checks so a stale device cannot silently overwrite newer Founder memory.
