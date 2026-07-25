import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BudgetExceededError,
  CostController,
  DEFAULT_MODELS,
  costNano,
  routeModel,
  usdToNano,
  type Clock,
} from './index';

// A controllable clock so day-bucketing and ceilings are deterministic.
function fixedClock(ms: number): { clock: Clock; set: (ms: number) => void } {
  let current = ms;
  return { clock: () => current, set: (next) => (current = next) };
}

const DAY1 = Date.UTC(2026, 0, 1, 12, 0, 0);
const DAY2 = Date.UTC(2026, 0, 2, 12, 0, 0);

test('router maps complexity to the right tier', () => {
  assert.equal(routeModel({ complexity: 'trivial' }).tier, 'economy');
  assert.equal(routeModel({ complexity: 'simple' }).tier, 'economy');
  assert.equal(routeModel({ complexity: 'moderate' }).tier, 'standard');
  assert.equal(routeModel({ complexity: 'complex' }).tier, 'premium');
  assert.equal(routeModel({ complexity: 'critical' }).tier, 'premium');
  assert.equal(routeModel({ complexity: 'trivial' }).model.id, 'claude-haiku-4-5');
  assert.equal(routeModel({ complexity: 'critical' }).model.id, 'claude-opus-5');
});

test('router escalates exactly one tier and never past premium', () => {
  assert.equal(routeModel({ complexity: 'trivial', escalate: true }).tier, 'standard');
  assert.equal(routeModel({ complexity: 'moderate', escalate: true }).tier, 'premium');
  // already premium — escalation clamps, does not overflow
  assert.equal(routeModel({ complexity: 'critical', escalate: true }).tier, 'premium');
});

test('router honors a maxTier cost cap', () => {
  const decision = routeModel({ complexity: 'critical', maxTier: 'standard' });
  assert.equal(decision.tier, 'standard');
  assert.match(decision.reason, /capped at maxTier/);
});

test('cost arithmetic is exact in nano-dollars', () => {
  // sonnet: $3/M input (3000 nUSD/tok), $15/M output (15000 nUSD/tok)
  const sonnet = DEFAULT_MODELS.standard;
  assert.equal(costNano(sonnet, 1000, 500), 1000 * 3000 + 500 * 15000);
  assert.equal(costNano(sonnet, 1000, 500), 10_500_000); // == $0.0105
  // premium is dramatically dearer — the whole reason routing matters.
  // With the default table opus is exactly 5x sonnet on both dimensions.
  const opus = DEFAULT_MODELS.premium;
  assert.equal(costNano(opus, 1000, 500), 1000 * 15000 + 500 * 75000);
  assert.equal(costNano(opus, 1000, 500), 5 * costNano(sonnet, 1000, 500));
  // and economy is an order of magnitude cheaper than premium
  const haiku = DEFAULT_MODELS.economy;
  assert.ok(costNano(opus, 1000, 500) > 10 * costNano(haiku, 1000, 500));
});

test('ledger accumulates per agent and buckets by UTC day', () => {
  const clk = fixedClock(DAY1);
  const cost = new CostController({ now: clk.clock, ceilings: { dailyUsd: 1000 } });
  const plan = cost.route({ complexity: 'moderate' }); // sonnet

  // $0.30 == 100000 input tokens * 3000 nUSD/tok
  cost.record({ agent: 'memory', task: 'summarize', plan, inputTokens: 100_000, outputTokens: 0 });
  cost.record({ agent: 'planner', task: 'draft', plan, inputTokens: 100_000, outputTokens: 0 });

  assert.equal(cost.ledger.spentOnDayNano(), usdToNano(0.6));
  assert.equal(cost.ledger.spentByAgentOnDayNano('memory'), usdToNano(0.3));

  const report = cost.report();
  assert.equal(report.byAgentUsd.memory, 0.3);
  assert.equal(report.byAgentUsd.planner, 0.3);
  assert.equal(report.callCount, 2);

  // roll to the next UTC day — yesterday's spend no longer counts against today
  clk.set(DAY2);
  assert.equal(cost.ledger.spentOnDayNano(), 0);
});

test('per-operation ceiling hard-fails before the call', () => {
  const clk = fixedClock(DAY1);
  const cost = new CostController({
    now: clk.clock,
    ceilings: { dailyUsd: 100, perOperationUsd: 0.1 },
  });
  // a single call estimated at $0.15 breaches the $0.10 per-op ceiling
  assert.throws(
    () => cost.authorize('runaway', usdToNano(0.15)),
    (err: unknown) => err instanceof BudgetExceededError && err.kind === 'per-operation',
  );
  // a $0.05 call is fine
  assert.doesNotThrow(() => cost.authorize('runaway', usdToNano(0.05)));
});

test('per-agent daily ceiling hard-fails once the agent is spent out', () => {
  const clk = fixedClock(DAY1);
  const cost = new CostController({
    now: clk.clock,
    ceilings: { dailyUsd: 100, perAgentDailyUsd: 0.5 },
  });
  const plan = cost.route({ complexity: 'moderate' });
  // agent "memory" has already spent $0.30 today
  cost.record({ agent: 'memory', task: 't', plan, inputTokens: 100_000, outputTokens: 0 });

  // another $0.25 would bring it to $0.55, over its $0.50 cap → throw
  assert.throws(
    () => cost.authorize('memory', usdToNano(0.25)),
    (err: unknown) =>
      err instanceof BudgetExceededError && err.kind === 'per-agent-daily',
  );
  // a different agent with its own budget is unaffected
  assert.doesNotThrow(() => cost.authorize('planner', usdToNano(0.25)));
});

test('global daily ceiling hard-fails across all agents', () => {
  const clk = fixedClock(DAY1);
  const cost = new CostController({ now: clk.clock, ceilings: { dailyUsd: 1 } });
  const plan = cost.route({ complexity: 'moderate' });
  // three agents each spend $0.30 → $0.90 total, all recorded
  for (const agent of ['a', 'b', 'c']) {
    cost.record({ agent, task: 't', plan, inputTokens: 100_000, outputTokens: 0 });
  }
  assert.equal(cost.ledger.spentOnDayNano(), usdToNano(0.9));

  // a fourth $0.15 call would push the day to $1.05, over the $1.00 cap
  assert.throws(
    () => cost.authorize('d', usdToNano(0.15)),
    (err: unknown) => err instanceof BudgetExceededError && err.kind === 'daily',
  );
  // ...but a $0.05 call still fits under $1.00
  assert.doesNotThrow(() => cost.authorize('d', usdToNano(0.05)));
});

test('wouldExceed mirrors authorize without throwing', () => {
  const clk = fixedClock(DAY1);
  const cost = new CostController({
    now: clk.clock,
    ceilings: { dailyUsd: 1, perOperationUsd: 0.1 },
  });
  assert.equal(cost.guard.wouldExceed('x', usdToNano(0.05)), false);
  assert.equal(cost.guard.wouldExceed('x', usdToNano(0.15)), true);
});

test('a synthetic day of routed calls stays attributed and under budget', () => {
  const clk = fixedClock(DAY1);
  const cost = new CostController({
    now: clk.clock,
    ceilings: { dailyUsd: 5, perAgentDailyUsd: 3, perOperationUsd: 0.5 },
  });

  // realistic mix: lots of cheap classification, some drafting, rare reasoning
  const workload: Array<[string, 'trivial' | 'moderate' | 'critical', number, number]> = [
    ['router', 'trivial', 400, 40],
    ['router', 'trivial', 380, 35],
    ['memory', 'moderate', 2000, 600],
    ['planner', 'moderate', 1800, 900],
    ['judge', 'critical', 1200, 700],
  ];

  for (const [agent, complexity, inTok, outTok] of workload) {
    const plan = cost.route({ complexity });
    const est = cost.estimate(plan.model, inTok, outTok);
    cost.authorize(agent, est); // would throw if any ceiling breached
    cost.record({ agent, task: complexity, plan, inputTokens: inTok, outputTokens: outTok });
  }

  const report = cost.report();
  assert.ok(report.totalUsd < 5, `total ${report.totalUsd} under daily cap`);
  assert.equal(report.callCount, 5);
  // trivial work went to economy, critical to premium — attribution proves it
  assert.ok(report.byAgentUsd.judge > report.byAgentUsd.router);
});
