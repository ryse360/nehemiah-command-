import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFounderPilot, validatePilotSession, type FounderPilotSession } from './founder-pilot';

const session = (overrides: Partial<FounderPilotSession> = {}): FounderPilotSession => ({
  id: 'pilot-1', startedAt: '2026-07-20T08:00:00.000Z', endedAt: '2026-07-20T08:30:00.000Z',
  command: 'Authorize the restricted platform pilot.', completedJourney: true,
  proofCaptured: true, decisionUseful: true,
  fiveSecondGate: { mattersMost: true, whyFirst: true, founderAuthority: true, visibleAction: true, proofRequired: true },
  criticalIssues: 0, highIssues: 0, acceptedHighIssues: 0, notes: 'Completed without confusion.',
  ...overrides,
});

test('validates a complete bounded Founder pilot session', () => {
  assert.deepEqual(validatePilotSession(session()), { valid: true, errors: [] });
});

test('rejects reversed timestamps and incomplete five-second evidence', () => {
  const reversed = validatePilotSession(session({ endedAt: '2026-07-20T07:59:00.000Z' }));
  assert.ok(reversed.errors.includes('Pilot end time must be after the start time.'));

  const malformed = validatePilotSession({
    ...session(),
    fiveSecondGate: { mattersMost: true } as FounderPilotSession['fiveSecondGate'],
  });
  assert.ok(malformed.errors.includes('All five usability-gate answers must be explicit booleans.'));
});



test('rejects non-boolean outcome evidence', () => {
  const malformed = validatePilotSession({
    ...session(),
    proofCaptured: 'yes' as unknown as boolean,
  });
  assert.ok(malformed.errors.includes('Journey, proof, and usefulness results must be explicit booleans.'));
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

test('high issues require explicit acceptance or resolution', () => {
  const blocked = Array.from({ length: 5 }, (_, index) => session({ id: `pilot-${index + 1}`, highIssues: index === 4 ? 1 : 0 }));
  assert.equal(assessFounderPilot(blocked, true).status, 'blocked');

  const accepted = blocked.map((item, index) => index === 4 ? { ...item, acceptedHighIssues: 1 } : item);
  const result = assessFounderPilot(accepted, true);
  assert.equal(result.status, 'pass');
  assert.equal(result.unresolvedHighIssues, 0);
});
