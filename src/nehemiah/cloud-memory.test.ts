import assert from 'node:assert/strict';
import test from 'node:test';
import { appendJourneyToMemory, createFounderMemory } from './founder-memory';
import type { FounderJourney } from './founder-journey';
import {
  InMemoryFounderMemoryStore,
  MemoryConflictError,
  mergeFounderMemories,
} from './cloud-memory';

const journey: FounderJourney = {
  lifecycle: 'proof-created',
  command: 'Authorize the restricted pilot.',
  decision: { disposition: 'approve', decidedAt: '2026-07-20T12:00:00.000Z' },
  action: { visibleAction: 'Start the restricted pilot.', startedAt: '2026-07-20T12:01:00.000Z' },
  proof: { evidence: 'Pilot completed.', recordedAt: '2026-07-20T13:00:00.000Z' },
  history: [],
};

test('stores and retrieves durable Founder memory with a revision', async () => {
  const store = new InMemoryFounderMemoryStore();
  const memory = appendJourneyToMemory(createFounderMemory(), journey);
  const saved = await store.save('founder-1', memory, 0);
  const loaded = await store.load('founder-1');

  assert.equal(saved.revision, 1);
  assert.deepEqual(loaded?.memory, memory);
  assert.equal(loaded?.revision, 1);
});

test('rejects stale writes instead of silently overwriting cloud memory', async () => {
  const store = new InMemoryFounderMemoryStore();
  await store.save('founder-1', createFounderMemory(), 0);

  await assert.rejects(
    () => store.save('founder-1', createFounderMemory(), 0),
    MemoryConflictError,
  );
});

test('merges local and cloud ledgers without duplicating record versions', () => {
  const local = appendJourneyToMemory(createFounderMemory(), journey);
  const cloud = { ...local, decisions: [...local.decisions, ...local.decisions] };
  const merged = mergeFounderMemories(local, cloud);

  assert.equal(merged.decisions.length, 1);
  assert.equal(merged.decisions[0]?.id, local.decisions[0]?.id);
});
