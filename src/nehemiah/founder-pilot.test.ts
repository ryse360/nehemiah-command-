import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFounderPilot, validatePilotSession, type FounderPilotSession } from './founder-pilot';

const session = (overrides: Partial<FounderPilotSession> = {}): FounderPilotSession => ({
  id: 'pilot-1', startedAt: '2026-07-20T08:00:00.000Z', endedAt: '2026-07-20T08:30:00.000Z',
  command: 'Authorize the restricted platform pilot.', completedJourney: true,
  proofCaptured: true, decisionUseful: true,
  fiveSecondGate: { mattersMost: true, whyFirst: true, founderAuthority: true, visibleAction: true, proofRequired: true },
  criticalIssues: 0, highIssues: 0, notes: 'Completed without confusion.',
  ...overrides,
});

test('validates a complete bounded Founder pilot session', () => {
  assert.deepEqual(validatePilotSession(session()), { valid: true, errors: [] });
});

test('pilot readiness remains blocked without enough successful sessions and approval', () => {
  const result = assessFounderPilot([session()], false);
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.includes('At least five completed Founder pilot sessions are required.'));
  assert.ok(result.blockers.includes('Explicit Founder release approval is required.'));
});

test('pilot readiness passes after five successful sessions and Founder approval', () => {
  const sessions = Array.from({ length: 5 }, (_, index) => session({ id: `pilot-${index + 1}` }));
  const result = assessFounderPilot(sessions, true);
  assert.equal(result.status, 'pass');
  assert.equal(result.successfulSessions, 5);
  assert.deepEqual(result.blockers, []);
});

test('critical issues block release even when session count is met', () => {
  const sessions = Array.from({ length: 5 }, (_, index) => session({ id: `pilot-${index + 1}`, criticalIssues: index === 4 ? 1 : 0 }));
  const result = assessFounderPilot(sessions, true);
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.some((item) => item.includes('critical')));
});
