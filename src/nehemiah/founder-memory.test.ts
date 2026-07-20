import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendJourneyToMemory,
  createFounderMemory,
  deserializeFounderMemory,
  serializeFounderMemory,
} from './founder-memory';
import type { FounderJourney } from './founder-journey';

const completedJourney: FounderJourney = {
  lifecycle: 'proof-created',
  command: 'Authorize the restricted pilot.',
  decision: {
    disposition: 'approve-with-limits',
    note: 'Pause one lower-priority initiative.',
    decidedAt: '2026-07-20T12:00:00.000Z',
  },
  action: {
    visibleAction: 'Approve the pilot boundary and name ownership.',
    startedAt: '2026-07-20T12:01:00.000Z',
  },
  proof: {
    evidence: 'Pilot completed with correct context transfer.',
    recordedAt: '2026-07-20T13:00:00.000Z',
  },
  history: [],
};

test('creates an empty versioned Founder memory', () => {
  const memory = createFounderMemory();
  assert.equal(memory.version, 1);
  assert.deepEqual(memory.decisions, []);
});

test('archives a completed journey with decision, action, and proof', () => {
  const memory = appendJourneyToMemory(createFounderMemory(), completedJourney);
  assert.equal(memory.decisions.length, 1);
  assert.equal(memory.decisions[0]?.command, completedJourney.command);
  assert.equal(memory.decisions[0]?.disposition, 'approve-with-limits');
  assert.equal(memory.decisions[0]?.proof, completedJourney.proof?.evidence);
});

test('does not archive an incomplete journey', () => {
  const memory = appendJourneyToMemory(createFounderMemory(), {
    ...completedJourney,
    lifecycle: 'action-underway',
    proof: undefined,
  });
  assert.equal(memory.decisions.length, 0);
});

test('serializes and restores Founder memory', () => {
  const memory = appendJourneyToMemory(createFounderMemory(), completedJourney);
  const restored = deserializeFounderMemory(serializeFounderMemory(memory));
  assert.deepEqual(restored, memory);
});

test('returns empty memory for invalid stored content', () => {
  assert.deepEqual(deserializeFounderMemory('{broken'), createFounderMemory());
  assert.deepEqual(deserializeFounderMemory('{"version":2}'), createFounderMemory());
});

test('archives the Founder lesson with completed proof', () => {
  const memory = appendJourneyToMemory(createFounderMemory(), {
    ...completedJourney,
    proof: {
      ...completedJourney.proof!,
      lesson: 'Use a restricted pilot to protect momentum.',
    },
  });
  assert.equal(memory.decisions[0]?.lesson, 'Use a restricted pilot to protect momentum.');
});
