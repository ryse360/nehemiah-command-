import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHealthSnapshot, createOperationalEvent, summarizeOperationalEvents } from './observability';

test('health snapshot reports degraded dependencies without exposing secrets', () => {
  const result = buildHealthSnapshot({ database: false, aiProvider: true, integrations: true, version: '0.23.0' }, new Date('2026-07-20T12:00:00Z'));
  assert.equal(result.status, 'degraded');
  assert.equal(result.checks.database, 'unavailable');
  assert.equal(JSON.stringify(result).includes('DATABASE_URL'), false);
});

test('operational events redact secret-like fields', () => {
  const event = createOperationalEvent('api.error', 'error', { route: '/api/test', token: 'secret', password: 'hidden', message: 'failed' });
  assert.equal(event.context.token, '[REDACTED]');
  assert.equal(event.context.password, '[REDACTED]');
  assert.equal(event.context.message, 'failed');
});

test('event summary groups severity and identifies unresolved errors', () => {
  const events = [
    createOperationalEvent('api.ok', 'info', {}),
    createOperationalEvent('api.error', 'error', {}),
    createOperationalEvent('api.warn', 'warning', {}),
  ];
  const summary = summarizeOperationalEvents(events);
  assert.deepEqual(summary.byLevel, { info: 1, warning: 1, error: 1, fatal: 0 });
  assert.equal(summary.requiresAttention, true);
});
