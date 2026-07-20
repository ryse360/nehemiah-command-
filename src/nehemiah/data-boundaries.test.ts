import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEnterpriseContext,
  createIntegrationSignal,
  validateEnterpriseContext,
  validateIntegrationSignalInput,
} from './data-boundaries';

test('creates enterprise context without accepting Founder-private fields', () => {
  const context = createEnterpriseContext({
    priorities: ['Ship restricted pilot'],
    commitments: ['Protect Founder morning window'],
    projects: [{ id: 'platform-v2', name: 'Platform v2', owner: 'Product', status: 'active' }],
  });

  assert.equal(context.version, 1);
  assert.equal(context.projects[0]?.owner, 'Product');
  assert.equal('personalStandards' in context, false);
});

test('rejects enterprise payloads containing private-context keys', () => {
  const result = validateEnterpriseContext({
    priorities: ['Ship restricted pilot'],
    commitments: [],
    projects: [],
    personalStandards: ['Never sacrifice family'],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /private/i);
});

test('validates and creates an integration signal with provenance', () => {
  const input = {
    externalId: 'event-123',
    type: 'calendar.commitment.changed',
    occurredAt: '2026-07-20T14:00:00.000Z',
    summary: 'Product review moved into protected window.',
    payload: { calendarId: 'primary' },
  };

  assert.equal(validateIntegrationSignalInput(input).valid, true);
  const signal = createIntegrationSignal('google-calendar', input, new Date('2026-07-20T14:01:00.000Z'));
  assert.equal(signal.integrationId, 'google-calendar');
  assert.equal(signal.receivedAt, '2026-07-20T14:01:00.000Z');
});

test('rejects integration payloads that attempt to declare a Founder identity', () => {
  const result = validateIntegrationSignalInput({
    externalId: 'event-123',
    type: 'calendar.commitment.changed',
    occurredAt: '2026-07-20T14:00:00.000Z',
    summary: 'Changed.',
    founderId: 'primary-founder',
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /Founder identity/i);
});
