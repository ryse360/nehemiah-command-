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
