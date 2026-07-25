import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeOrbState,
  deriveMemorySignals,
  orbStateFromMemory,
  restingOrbState,
  type OrbSignals,
  type OrbStateDTO,
} from './orb-state';
import type { FounderMemory } from './founder-memory';
import type { IntegrityDecisionRecord } from './decision-record-integrity';
import type { NehemiahState } from './state-machine';

const NOW = Date.UTC(2026, 6, 25, 19, 0, 0); // fixed "now" for deterministic recency
const DAY = 24 * 60 * 60 * 1000;

const ALL_STATES: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

// Every string here is Founder CONTENT — a title, note, command, proof, lesson,
// name, or identifier. The contract is that NONE of it may appear in OrbSignals
// OR in the OrbStateDTO.
const SECRETS = [
  'Acquire Northwind Robotics',
  'board is split on the term sheet',
  'CFO flagged the runway risk',
  'Jane Doe promised to deliver by Q3',
  'proof: signed LOI in DocuSign',
  'lesson: never skip the reference calls',
  'decision-9f1c-secret-logical-id',
];

function record(overrides: Partial<IntegrityDecisionRecord>, ageDays: number): IntegrityDecisionRecord {
  const at = new Date(NOW - ageDays * DAY).toISOString();
  return {
    id: 'decision-9f1c-secret-logical-id',
    logicalDecisionId: 'decision-9f1c-secret-logical-id',
    recordVersion: 1,
    command: 'Acquire Northwind Robotics',
    disposition: 'approve',
    decisionNote: 'board is split on the term sheet',
    decidedAt: at,
    visibleAction: 'CFO flagged the runway risk',
    proof: 'proof: signed LOI in DocuSign',
    proofRecordedAt: at,
    lesson: 'lesson: never skip the reference calls',
    provenance: [{ kind: 'note', summary: 'Jane Doe promised to deliver by Q3', recordedAt: at } as never],
    auditTrail: [],
    ...overrides,
  };
}

function memoryWith(...records: IntegrityDecisionRecord[]): FounderMemory {
  return { version: 2, decisions: records };
}

// ---------------------------------------------------------------------------
// Compile-time boundary proof. Never called at runtime; `tsc --noEmit`
// validates every @ts-expect-error, so if the type boundary ever weakens the
// build turns red. This is the "types make the leak impossible" guarantee.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function __typeBoundaryProof(memory: FounderMemory) {
  // @ts-expect-error computeOrbState must NOT accept raw Founder memory.
  computeOrbState(memory);
  // @ts-expect-error computeOrbState must NOT accept a bare state + records.
  computeOrbState('resting', memory.decisions);
  // @ts-expect-error OrbSignals cannot carry a content string field.
  const withContent: OrbSignals = { operatingState: 'resting', decisionAgesMs: [], title: 'secret' };
  // @ts-expect-error OrbSignals.decisionAgesMs is numbers only, never records.
  const withRecords: OrbSignals = { operatingState: 'resting', decisionAgesMs: memory.decisions };
  // @ts-expect-error OrbStateDTO cannot carry a content string field.
  const dtoWithContent: OrbStateDTO = { ...restingOrbState(), title: 'secret' };
  return [withContent, withRecords, dtoWithContent];
}

// ---------------------------------------------------------------------------

test('OrbSignals is content-free: only a generic enum and a number array', () => {
  const signals = deriveMemorySignals(memoryWith(record({}, 1), record({}, 10)), 'decision-required', NOW);
  assert.deepEqual(Object.keys(signals).sort(), ['decisionAgesMs', 'operatingState']);
  assert.ok(Array.isArray(signals.decisionAgesMs));
  for (const age of signals.decisionAgesMs) {
    assert.equal(typeof age, 'number', 'every signal age is a number');
  }
});

test('CONTRACT: no Founder content crosses into OrbSignals', () => {
  const memory = memoryWith(record({}, 0), record({}, 5), record({}, 30));
  const signals = deriveMemorySignals(memory, 'decision-required', NOW);
  const serialized = JSON.stringify(signals).toLowerCase();
  for (const secret of SECRETS) {
    assert.ok(!serialized.includes(secret.toLowerCase()), `OrbSignals leaked: "${secret}"`);
  }
  assert.ok(!/\d{4}-\d{2}-\d{2}t/.test(serialized), 'no ISO timestamp in signals');
  assert.ok(!serialized.includes('approve'), 'no disposition in signals');
});

test('the DTO carries only derived numbers and a closed enum', () => {
  const dto = orbStateFromMemory(memoryWith(record({}, 1), record({}, 10)), 'decision-required', NOW);
  const numericKeys: (keyof OrbStateDTO)[] = [
    'nodeCount',
    'recencyWeight',
    'intensity',
    'convergence',
    'openLoops',
    'settled',
  ];
  for (const key of numericKeys) {
    assert.equal(typeof dto[key], 'number', `${key} must be a number`);
  }
  for (const band of ['high', 'medium', 'low'] as const) {
    assert.equal(typeof dto.bands[band], 'number');
  }
  assert.ok(ALL_STATES.includes(dto.operatingState), 'operatingState is a closed enum');
});

test('CONTRACT: no Founder content crosses into the DTO', () => {
  const memory = memoryWith(record({}, 0), record({}, 5), record({}, 30));
  const dto = orbStateFromMemory(memory, 'decision-required', NOW);
  // The serialized DTO is exactly what a client would receive. It must contain
  // none of the Founder content, and no timestamp, id, or disposition either.
  const serialized = JSON.stringify(dto).toLowerCase();
  for (const secret of SECRETS) {
    assert.ok(!serialized.includes(secret.toLowerCase()), `DTO leaked Founder content: "${secret}"`);
  }
  assert.ok(!/\d{4}-\d{2}-\d{2}t/.test(serialized), 'no ISO timestamp crossed the boundary');
  assert.ok(!serialized.includes('approve'), 'no disposition crossed the boundary');
});

test('recency decays: a fresh decision reads brighter than an old one', () => {
  const fresh = orbStateFromMemory(memoryWith(record({}, 0)), 'resting', NOW);
  const stale = orbStateFromMemory(memoryWith(record({}, 30)), 'resting', NOW);
  assert.ok(fresh.recencyWeight > stale.recencyWeight);
  assert.ok(fresh.recencyWeight <= 1 && stale.recencyWeight >= 0);
});

test('priority bands bucket decisions by age', () => {
  const dto = orbStateFromMemory(
    memoryWith(record({}, 1), record({}, 2), record({}, 7), record({}, 40)),
    'resting',
    NOW,
  );
  assert.equal(dto.bands.high, 2, 'two within 3 days');
  assert.equal(dto.bands.medium, 1, 'one within 14 days');
  assert.equal(dto.bands.low, 1, 'one older');
  assert.equal(dto.settled, 4);
});

test('an undated decision is counted but never affects recency', () => {
  const signals = deriveMemorySignals(
    memoryWith(record({ decidedAt: '', proofRecordedAt: '' }, 0)),
    'resting',
    NOW,
  );
  assert.equal(signals.decisionAgesMs.length, 1);
  assert.equal(signals.decisionAgesMs[0], Number.POSITIVE_INFINITY);
  const dto = computeOrbState(signals);
  assert.equal(dto.settled, 1);
  assert.equal(dto.bands.low, 1);
  assert.equal(dto.recencyWeight, 0, 'undated decision does not read as recent');
});

test('node surfacing is clamped so a large memory is not a starfield', () => {
  const many = Array.from({ length: 500 }, () => record({}, 2));
  const dto = orbStateFromMemory(memoryWith(...many), 'resting', NOW);
  assert.ok(dto.nodeCount <= 220, 'nodeCount is capped');
  assert.equal(dto.settled, 500, 'the true count is still derivable, just not surfaced');
});

test('open loops derive from the operating state, not from content', () => {
  const memory = memoryWith(record({}, 1));
  assert.equal(orbStateFromMemory(memory, 'decision-required', NOW).openLoops, 1);
  assert.equal(orbStateFromMemory(memory, 'resting', NOW).openLoops, 0);
  assert.equal(orbStateFromMemory(memory, 'proof-created', NOW).openLoops, 0);
});

test('an empty memory yields a calm, valid DTO; resting default matches', () => {
  const dto = orbStateFromMemory(memoryWith(), 'resting', NOW);
  assert.equal(dto.nodeCount, 0);
  assert.equal(dto.settled, 0);
  assert.equal(dto.recencyWeight, 0);
  assert.deepEqual(dto.bands, { high: 0, medium: 0, low: 0 });
  assert.deepEqual(restingOrbState(), dto);
});

test('intensity and convergence stay within 0..1 across all states', () => {
  for (const state of ALL_STATES) {
    const dto = orbStateFromMemory(memoryWith(record({}, 1), record({}, 2)), state, NOW);
    assert.ok(dto.intensity >= 0 && dto.intensity <= 1, `${state} intensity in range`);
    assert.ok(dto.convergence >= 0 && dto.convergence <= 1, `${state} convergence in range`);
  }
});

test('computeOrbState is pure over identical signals', () => {
  const signals = deriveMemorySignals(memoryWith(record({}, 1), record({}, 9)), 'action-underway', NOW);
  assert.deepEqual(computeOrbState(signals), computeOrbState(signals));
});
