import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionToken,
  verifyFounderPassword,
  verifySessionToken,
  type FounderAuthConfig,
} from './founder-auth';
import { createPasswordHash } from './security-hardening';

const config: FounderAuthConfig = {
  founderId: 'primary-founder',
  passwordHash: createPasswordHash('correct horse battery staple', Buffer.alloc(16, 9)),
  sessionSecret: 'a-very-long-founder-session-secret-that-is-private',
  sessionTtlSeconds: 3600,
  authVersion: 3,
};

test('verifies the Founder password against a scrypt hash', () => {
  assert.equal(verifyFounderPassword('correct horse battery staple', config), true);
  assert.equal(verifyFounderPassword('incorrect', config), false);
});

test('embeds a session id and auth version in signed sessions', () => {
  const token = createSessionToken(config, new Date('2026-07-20T12:00:00.000Z'), 'session-123');
  const session = verifySessionToken(token, config, new Date('2026-07-20T12:30:00.000Z'));
  assert.equal(session?.sessionId, 'session-123');
  assert.equal(session?.authVersion, 3);
});

test('rejects sessions issued under an earlier auth version', () => {
  const token = createSessionToken(config, new Date('2026-07-20T12:00:00.000Z'), 'session-123');
  const rotated = { ...config, authVersion: 4 };
  assert.equal(verifySessionToken(token, rotated, new Date('2026-07-20T12:30:00.000Z')), null);
});
