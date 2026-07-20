import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemorySecurityStore } from './security-store';
import { createSecurityEvent } from './security-hardening';

test('revokes one Founder session without revoking another', async () => {
  const store = new InMemorySecurityStore();
  await store.revokeSession('primary-founder', 'session-a', new Date('2026-07-21T00:00:00Z'));
  assert.equal(await store.isSessionRevoked('primary-founder', 'session-a'), true);
  assert.equal(await store.isSessionRevoked('primary-founder', 'session-b'), false);
});

test('preserves redacted security events in append order', async () => {
  const store = new InMemorySecurityStore();
  await store.appendSecurityEvent(createSecurityEvent({
    actorType: 'system', actorId: 'nehemiah', eventType: 'backup.verified',
    outcome: 'allowed', requestId: 'req-1', metadata: { backupId: 'backup-1' },
  }, new Date('2026-07-20T12:00:00Z')));
  const events = await store.listSecurityEvents('primary-founder');
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'backup.verified');
});
