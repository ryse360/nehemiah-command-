import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFounderJourney,
  reduceFounderJourney,
  type FounderJourney,
} from './founder-journey';

test('moves a Founder command into listening and preserves the command', () => {
  const initial = createFounderJourney();
  const next = reduceFounderJourney(initial, {
    type: 'command-submitted',
    command: 'Should we authorize the restricted pilot?',
  });

  assert.equal(next.lifecycle, 'listening');
  assert.equal(next.command, 'Should we authorize the restricted pilot?');
  assert.equal(next.history.at(-1)?.kind, 'command');
});

test('advances through focus and a justified decision without bypassing states', () => {
  let journey = reduceFounderJourney(createFounderJourney(), {
    type: 'command-submitted',
    command: 'Review the platform pilot.',
  });
  journey = reduceFounderJourney(journey, { type: 'focus-identified' });
  journey = reduceFounderJourney(journey, { type: 'decision-justified' });

  assert.equal(journey.lifecycle, 'decision-required');
});

test('approval creates an action record before proof can be captured', () => {
  const decisionJourney: FounderJourney = {
    ...createFounderJourney(),
    lifecycle: 'decision-required',
    command: 'Authorize the pilot.',
  };

  const approved = reduceFounderJourney(decisionJourney, {
    type: 'decision-disposed',
    disposition: 'approve-with-limits',
    note: 'Pause the lower-priority initiative for two weeks.',
  });

  assert.equal(approved.lifecycle, 'action-underway');
  assert.equal(approved.decision?.disposition, 'approve-with-limits');
  assert.match(approved.action?.visibleAction ?? '', /pilot boundary/i);
});

test('captures proof only while action is underway', () => {
  const actionJourney: FounderJourney = {
    ...createFounderJourney(),
    lifecycle: 'action-underway',
    action: {
      visibleAction: 'Approve pilot boundary and name ownership.',
      startedAt: '2026-07-20T12:00:00.000Z',
    },
  };

  const complete = reduceFounderJourney(actionJourney, {
    type: 'proof-recorded',
    evidence: 'Pilot completed with correct context transfer and no critical failures.',
  });

  assert.equal(complete.lifecycle, 'proof-created');
  assert.equal(complete.proof?.evidence, 'Pilot completed with correct context transfer and no critical failures.');
});

test('rejects invalid lifecycle events', () => {
  assert.throws(
    () => reduceFounderJourney(createFounderJourney(), { type: 'proof-recorded', evidence: 'Too soon.' }),
    /Invalid Founder journey event/,
  );
});

test('preserves a lesson when proof is recorded', () => {
  let journey = createFounderJourney();
  journey = reduceFounderJourney(journey, { type: 'command-submitted', command: 'Approve a restricted pilot.' });
  journey = reduceFounderJourney(journey, { type: 'focus-identified' });
  journey = reduceFounderJourney(journey, { type: 'decision-justified' });
  journey = reduceFounderJourney(journey, { type: 'decision-disposed', disposition: 'approve' });
  journey = reduceFounderJourney(journey, {
    type: 'proof-recorded',
    evidence: 'Pilot launched.',
    lesson: 'A narrow boundary accelerated execution.',
  });

  assert.equal(journey.proof?.lesson, 'A narrow boundary accelerated execution.');
});
