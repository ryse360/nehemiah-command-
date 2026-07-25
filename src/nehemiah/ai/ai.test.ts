import test from 'node:test';
import assert from 'node:assert/strict';

import { BudgetExceededError, type Clock } from '@/nehemiah/cost';
import { AIBoundary, type ModelExecutor } from './index';

function fixedClock(ms: number): Clock {
  return () => ms;
}

// A synthetic model executor: no network, deterministic usage, call counter.
function synthetic() {
  let calls = 0;
  const executor: ModelExecutor = async (model, prompt) => {
    calls += 1;
    return {
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: 200,
      text: `resp:${model.id}:${prompt.slice(0, 12)}`,
    };
  };
  return { executor, calls: () => calls };
}

const DAY = Date.UTC(2026, 0, 1, 12, 0, 0);

test('identical calls hit the cache — provider called once, second is free', async () => {
  const s = synthetic();
  const ai = new AIBoundary({
    now: fixedClock(DAY),
    ceilings: { dailyUsd: 100 },
    executor: s.executor,
  });
  const req = {
    agent: 'router',
    task: 'classify',
    complexity: 'trivial' as const,
    prompt: 'Is this message urgent? "the roof is leaking"',
  };

  const first = await ai.complete(req);
  const second = await ai.complete(req);

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.costNano, 0);
  assert.equal(s.calls(), 1, 'provider hit exactly once');

  const report = ai.report();
  assert.equal(report.telemetry.calls, 2);
  assert.equal(report.telemetry.cacheHits, 1);
  assert.equal(report.cache.hitRate, 0.5);
});

test('routing sends trivial work to economy, critical to premium', async () => {
  const s = synthetic();
  const ai = new AIBoundary({
    now: fixedClock(DAY),
    ceilings: { dailyUsd: 100 },
    executor: s.executor,
  });
  const trivial = await ai.complete({
    agent: 'a',
    task: 't',
    complexity: 'trivial',
    prompt: 'tag this',
  });
  const critical = await ai.complete({
    agent: 'a',
    task: 't',
    complexity: 'critical',
    prompt: 'weigh this decision of record carefully',
  });
  assert.equal(trivial.tier, 'economy');
  assert.equal(critical.tier, 'premium');
});

test('a ceiling refuses the call BEFORE the provider runs', async () => {
  const s = synthetic();
  const ai = new AIBoundary({
    now: fixedClock(DAY),
    ceilings: { dailyUsd: 100, perOperationUsd: 0.0005 },
    executor: s.executor,
  });
  await assert.rejects(
    () =>
      ai.complete({
        agent: 'spendy',
        task: 'big',
        complexity: 'critical',
        prompt: 'a'.repeat(400),
      }),
    (err: unknown) => err instanceof BudgetExceededError,
  );
  assert.equal(s.calls(), 0, 'provider never ran — the brake held');
});

test('remember() routes candidates through the write/dedup gate', () => {
  const s = synthetic();
  const ai = new AIBoundary({
    now: fixedClock(DAY),
    ceilings: { dailyUsd: 100 },
    executor: s.executor,
  });
  assert.equal(ai.remember('1', { text: 'thanks!', kind: 'transient' }).action, 'skip');
  assert.equal(
    ai.remember('2', {
      text: 'Founder decided to move the board meeting to the first Tuesday monthly.',
      kind: 'decision',
    }).action,
    'write',
  );
});

test('a synthetic day of Nehemiah costs far less controlled than naive', async () => {
  const s = synthetic();
  const ai = new AIBoundary({
    now: fixedClock(DAY),
    ceilings: { dailyUsd: 50, perAgentDailyUsd: 20 },
    executor: s.executor,
  });

  // a realistic mix: heavy cheap classification (much of it repeated), some
  // drafting, a little premium reasoning
  const jobs: Array<['trivial' | 'moderate' | 'critical', string, string]> = [
    ['trivial', 'router', 'classify: is this urgent?'],
    ['trivial', 'router', 'classify: is this urgent?'], // repeat -> cache
    ['trivial', 'router', 'classify: is this urgent?'], // repeat -> cache
    ['trivial', 'router', 'extract the date from this note'],
    ['moderate', 'memory', 'summarize the last standup into three bullets'],
    ['moderate', 'planner', 'draft the vendor consolidation email'],
    ['moderate', 'planner', 'draft the vendor consolidation email'], // repeat -> cache
    ['critical', 'judge', 'check this plan for contradictions with prior decisions'],
  ];

  for (const [complexity, agent, prompt] of jobs) {
    await ai.complete({ agent, task: complexity, complexity, prompt });
  }

  const r = ai.report();
  assert.equal(r.telemetry.calls, 8);
  assert.equal(s.calls(), 5, '3 of 8 served from cache');
  assert.equal(r.telemetry.cacheHits, 3);
  assert.ok(r.telemetry.controlledUsd < r.telemetry.naiveUsd);
  assert.ok(
    r.telemetry.savingsPct > 0.5,
    `expected >50% savings vs naive, got ${(r.telemetry.savingsPct * 100).toFixed(1)}%`,
  );
  assert.ok(r.spentTodayUsd < 50, 'stayed under the daily ceiling');
});
