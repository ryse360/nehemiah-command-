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

Projects and Actions Integration connects Founder decisions to governed ownership, deadlines, blockers, progress, and visible proof.


## Cloud persistence setup

1. Provision PostgreSQL and run `docs/database/001-founder-memory.sql`.
2. Copy `.env.example` to `.env.local`.
3. Configure `DATABASE_URL`, `NEHEMIAH_FOUNDER_ID`, `NEHEMIAH_FOUNDER_PASSWORD_HASH`, and `NEHEMIAH_SESSION_SECRET`.
4. Run all database migrations through `docs/database/005-drive-obsidian-knowledge.sql`.

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


## Calendar and Gmail integration (v0.19.0)

Configure rotating keys for `google-calendar` and `gmail`, then connect an approved Google Workspace bridge to the dedicated ingestion routes. See `docs/integrations/google-workspace.md`. Nehemiah stores bounded message metadata and calendar commitments; it does not send email or modify calendar events in this release.


## Drive and Obsidian knowledge integration (v0.20.0)

Configure rotating keys for `google-drive` and `obsidian`, apply migration `005-drive-obsidian-knowledge.sql`, and connect only approved Drive folders and Obsidian vault paths. See `docs/integrations/drive-obsidian.md`. Nehemiah preserves source references, timestamps, visibility, citations, and controlled synchronization history.


## Projects and Actions integration (v0.21.0)

The authenticated Founder workspace now tracks enterprise projects and actions through the existing enterprise context boundary. Actions preserve ownership, dependencies, deadlines, blockers, progress, and proof. Completion is rejected until visible proof is recorded.
