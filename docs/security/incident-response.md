# Nehemiah Security Incident Response

## Immediate containment

1. Increment `NEHEMIAH_AUTH_VERSION` to revoke every existing Founder session.
2. Rotate `NEHEMIAH_SESSION_SECRET` and the Founder password hash when credential exposure is possible.
3. Rotate affected integration keys by moving the current value to `previous`, setting a short `previousExpiresAt`, and installing a new `current` value.
4. Disable affected integrations until their provenance can be confirmed.
5. Preserve security audit events and database snapshots before corrective edits.

## Investigation

- Identify the first suspicious request ID and affected actor.
- Review authentication failures, successful sessions, integration ingestion, and memory writes.
- Confirm whether Founder-private, enterprise, or integration boundaries were crossed.
- Record scope, exposure window, and decisions made during containment.

## Recovery

- Restore from the last verified encrypted backup when integrity is uncertain.
- Reapply database migrations and verify audit-chain integrity.
- Require a new Founder sign-in after secrets are rotated.
- Re-enable integrations one at a time after key rotation and test ingestion.

## Proof required before closure

- Compromised sessions are revoked.
- Exposed credentials are rotated.
- Memory and audit integrity checks pass.
- Backup restoration has been rehearsed.
- Founder receives a concise incident record and continuation plan.
