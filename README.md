# Nehemiah Command

Nehemiah is the Founder’s private intelligence and strategic operating system for MiP Coaching. It prepares consequential decisions, protects Founder authority, connects evidence to action, preserves proof, and compounds lessons without autonomously approving or executing enterprise decisions.

## Release status

Current version: **1.0.0-rc.1**

The source code has passed the local production engineering gate. The release remains a candidate until real production infrastructure, backups, integrations, five Founder pilot sessions, and explicit Founder approval are verified. See `docs/production/remaining-external-actions.md`.

## Core capabilities

- Six-state Founder journey: Resting → Listening → Focus Surfaced → Decision Required → Action Underway → Proof Created
- Decision readiness, preparation workspace, evidence attachments, and enforced decision gate
- Strategic recall, recurring-pattern intelligence, and three-move consequence mapping
- Append-only Founder decision history with provenance and tamper detection
- PostgreSQL persistence boundary with revision conflict protection
- Founder authentication, authorization domains, security controls, and distributed rate limiting
- Governed AI decision preparation with structured outputs and fail-closed behavior
- Calendar, Gmail, Drive, and Obsidian ingestion boundaries
- Governed Projects and Actions with ownership, blockers, deadlines, and proof
- Accessibility, responsive behavior, performance budgets, health checks, and operational events
- Deployment rehearsal and Founder pilot release gates

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Engineering verification

```bash
npm test
npm run typecheck
npm run build
npm run quality:performance
```

Run the production server and then:

```bash
NEHEMIAH_BASE_URL=http://127.0.0.1:3000 npm run quality:smoke
```

Run the code release audit with verified local gate evidence:

```bash
NEHEMIAH_TESTS_VERIFIED=true \
NEHEMIAH_TYPECHECK_VERIFIED=true \
NEHEMIAH_PERFORMANCE_VERIFIED=true \
NEHEMIAH_SMOKE_VERIFIED=true \
NEHEMIAH_HEADERS_VERIFIED=true \
npm run release:audit
```

`npm run release:verify-production` fails until all production and Founder-pilot evidence is present.

## Production setup

1. Provision private PostgreSQL.
2. Apply migrations `docs/database/001-*.sql` through `006-founder-pilot.sql` in order.
3. Configure secrets from `.env.example` through the deployment platform’s encrypted secret store.
4. Connect approved Google Workspace, Drive, and Obsidian synchronization boundaries.
5. Run the deployment rehearsal in `docs/deployment/production-rehearsal.md`.
6. Complete the Founder pilot protocol in `docs/pilot/founder-pilot-protocol.md`.
7. Record explicit Founder release approval only after all blockers are resolved.

## Canonical documentation

- `docs/BUILD_LOG.md`
- `docs/production/v1-release-checklist.md`
- `docs/production/remaining-external-actions.md`
- `docs/deployment/production-rehearsal.md`
- `docs/security/incident-response.md`
- `docs/pilot/founder-pilot-protocol.md`
