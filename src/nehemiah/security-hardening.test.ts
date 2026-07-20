import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPasswordHash,
  verifyPasswordHash,
  createSlidingWindowRateLimiter,
  parseRotatingIntegrationKeys,
  verifyRotatingIntegrationKey,
  createSecurityEvent,
} from './security-hardening';

test('creates a salted password hash and verifies only the correct password', () => {
  const encoded = createPasswordHash('correct horse battery staple', Buffer.alloc(16, 7));
  assert.match(encoded, /^scrypt\$/);
  assert.equal(verifyPasswordHash('correct horse battery staple', encoded), true);
  assert.equal(verifyPasswordHash('incorrect', encoded), false);
});

test('rejects malformed password hashes', () => {
  assert.equal(verifyPasswordHash('anything', 'not-a-valid-hash'), false);
});

test('limits repeated actions inside a fixed window and resets afterward', () => {
  const limiter = createSlidingWindowRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(limiter.consume('founder', 0).allowed, true);
  assert.equal(limiter.consume('founder', 1_000).allowed, true);
  const blocked = limiter.consume('founder', 2_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 58_000);
  assert.equal(limiter.consume('founder', 61_000).allowed, true);
});

test('accepts current integration keys and time-bounded previous keys', () => {
  const keys = parseRotatingIntegrationKeys(JSON.stringify({
    calendar: {
      current: 'current-secret',
      previous: 'previous-secret',
      previousExpiresAt: '2026-07-21T00:00:00.000Z',
    },
  }));

  assert.equal(verifyRotatingIntegrationKey('calendar', 'current-secret', keys, new Date('2026-07-20T12:00:00Z')), true);
  assert.equal(verifyRotatingIntegrationKey('calendar', 'previous-secret', keys, new Date('2026-07-20T12:00:00Z')), true);
  assert.equal(verifyRotatingIntegrationKey('calendar', 'previous-secret', keys, new Date('2026-07-22T12:00:00Z')), false);
});

test('creates redacted security audit events without secret fields', () => {
  const event = createSecurityEvent({
    actorType: 'founder',
    actorId: 'primary-founder',
    eventType: 'auth.login.failed',
    outcome: 'denied',
    requestId: 'req-1',
    metadata: { reason: 'invalid_credentials', password: 'must-not-survive' },
  }, new Date('2026-07-20T12:00:00.000Z'));

  assert.equal(event.occurredAt, '2026-07-20T12:00:00.000Z');
  assert.equal(event.metadata.reason, 'invalid_credentials');
  assert.equal('password' in event.metadata, false);
});
