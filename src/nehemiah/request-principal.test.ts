import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateIntegrationHeaders, parseIntegrationKeys } from './request-principal';

test('parses configured integration keys without exposing secrets', () => {
  const keys = parseIntegrationKeys('{"google-calendar":"calendar-secret","gmail":"gmail-secret"}');
  assert.deepEqual([...keys.keys()], ['google-calendar', 'gmail']);
});

test('authenticates a configured integration only for its matching key', () => {
  const keys = new Map([['google-calendar', 'calendar-secret']]);
  assert.equal(authenticateIntegrationHeaders({
    integrationId: 'google-calendar',
    integrationKey: 'calendar-secret',
  }, keys)?.integrationId, 'google-calendar');
  assert.equal(authenticateIntegrationHeaders({
    integrationId: 'google-calendar',
    integrationKey: 'wrong',
  }, keys), null);
});
