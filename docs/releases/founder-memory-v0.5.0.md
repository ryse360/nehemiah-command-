# Nehemiah Command v0.5.0 — Persistent Founder Memory

## Outcome

Completed Founder decisions now survive browser reloads and remain reviewable as a private decision history.

## Included

- Versioned Founder memory schema.
- Local private persistence using browser storage.
- Completed-decision archival only after proof exists and the Founder closes review.
- Decision records preserve command, disposition, limits, visible action, timestamps, and proof.
- Duplicate archival protection.
- Graceful recovery from missing, malformed, or unsupported stored data.
- Decision Memory panel accessible from the top bar and Decisions rail control.

## Governance

- Incomplete decisions are never archived as completed proof.
- Approval is not treated as completion.
- Memory is Founder-private and remains local to the current browser in this release.
- No cloud synchronization, external data transfer, or shared enterprise access is enabled.

## Verification

- 20 automated tests passed.
- TypeScript strict checking passed.
- Next.js optimized production build passed.
- Root route generated as static production content.
