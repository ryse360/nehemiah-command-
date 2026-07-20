# Monitoring and Incident Operations

## Signals
- `/api/health` reports bounded dependency configuration without secret values.
- Founder-authenticated `/api/operational-events` exposes redacted operational events and severity totals.
- Production smoke tests confirm the public health route, private home route, and authentication boundary.

## Severity
- Info: expected lifecycle events.
- Warning: degraded dependency or retryable integration failure.
- Error: failed operation requiring review.
- Fatal: loss of protected availability or integrity.

## Response
1. Preserve the event and request ID.
2. Protect Founder-private data and stop unsafe automation.
3. Determine affected domain and time window.
4. Roll back or isolate the failing integration.
5. Verify recovery through smoke tests and protected data checks.
6. Capture the lesson and preventive action.
