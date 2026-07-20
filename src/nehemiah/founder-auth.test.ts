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
  passwordHash: createPasswordHash('correct horse battery staple', Buffer.alloc(16, 4)),
  sessionSecret: 'a-very-long-founder-session-secret-that-is-private',
  sessionTtlSeconds: 3600,
  authVersion: 1,
};

test('verifies the configured Founder password without accepting a different value', () => {
  assert.equal(verifyFounderPassword('correct horse battery staple', config), true);
  assert.equal(verifyFounderPassword('incorrect', config), false);
});

test('creates and verifies a signed Founder session token', () => {
  const token = createSessionToken(config, new Date('2026-07-20T12:00:00.000Z'));
  const session = verifySessionToken(token, config, new Date('2026-07-20T12:30:00.000Z'));

  assert.equal(session?.founderId, 'primary-founder');
  assert.equal(session?.expiresAt, '2026-07-20T13:00:00.000Z');
});

test('rejects tampered and expired Founder sessions', () => {
  const token = createSessionToken(config, new Date('2026-07-20T12:00:00.000Z'));
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

  assert.equal(verifySessionToken(tampered, config, new Date('2026-07-20T12:30:00.000Z')), null);
  assert.equal(verifySessionToken(token, config, new Date('2026-07-20T13:00:01.000Z')), null);
});
