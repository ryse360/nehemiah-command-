import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorize,
  createEnterprisePrincipal,
  createFounderPrincipal,
  createIntegrationPrincipal,
  type AuthorizationRequest,
} from './authorization';

function allowed(request: AuthorizationRequest) {
  return authorize(request).allowed;
}

test('Founder can access all bounded domains', () => {
  const principal = createFounderPrincipal('primary-founder');

  assert.equal(allowed({ principal, domain: 'founder-private', action: 'read' }), true);
  assert.equal(allowed({ principal, domain: 'founder-private', action: 'write' }), true);
  assert.equal(allowed({ principal, domain: 'enterprise', action: 'write' }), true);
  assert.equal(allowed({ principal, domain: 'integration', action: 'manage' }), true);
});

test('enterprise principal cannot access Founder-private or integration administration', () => {
  const principal = createEnterprisePrincipal('operations-lead');

  assert.equal(allowed({ principal, domain: 'enterprise', action: 'read' }), true);
  assert.equal(allowed({ principal, domain: 'enterprise', action: 'write' }), true);
  assert.equal(allowed({ principal, domain: 'founder-private', action: 'read' }), false);
  assert.equal(allowed({ principal, domain: 'integration', action: 'manage' }), false);
});

test('integration principal can append only to its own integration boundary', () => {
  const principal = createIntegrationPrincipal('google-calendar');

  assert.equal(allowed({
    principal,
    domain: 'integration',
    action: 'append',
    integrationId: 'google-calendar',
  }), true);
  assert.equal(allowed({
    principal,
    domain: 'integration',
    action: 'append',
    integrationId: 'gmail',
  }), false);
  assert.equal(allowed({ principal, domain: 'enterprise', action: 'read' }), false);
  assert.equal(allowed({ principal, domain: 'founder-private', action: 'read' }), false);
});

test('authorization denial includes a stable policy reason', () => {
  const decision = authorize({
    principal: createIntegrationPrincipal('gmail'),
    domain: 'founder-private',
    action: 'read',
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /Founder-private/i);
});
