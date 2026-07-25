import test from 'node:test';
import assert from 'node:assert/strict';

import { AIOrchestrationError, type AIModelProvider, type AIProviderResponse } from './ai-orchestration';
import { GovernedProvider } from './ai-governed-provider';
import { InMemoryUsageLedgerStore, UsageLedger } from './usage-ledger';

function fakeInner(usage?: { inputTokens: number; outputTokens: number }) {
  let calls = 0;
  const provider: AIModelProvider = {
    async generate(): Promise<AIProviderResponse> {
      calls += 1;
      return { model: 'test-model', providerRequestId: `r${calls}`, output: { ok: true, n: calls }, usage };
    },
  };
  return { provider, calls: () => calls };
}

const GEN_INPUT = {
  system: 'You are a decision-preparation assistant.',
  user: 'Should we consolidate vendors this quarter?',
  schema: {},
  timeoutMs: 30000,
};

const DAY = Date.UTC(2026, 0, 1, 12, 0, 0);

// Build a GovernedProvider over a fresh in-memory ledger. The daily ceiling is
// now enforced by the UsageLedger (step 2b), not the decorator.
function governed(opts: {
  modelId?: string;
  dailyUsd: number;
  perCallUsd: number;
  estOutputTokens?: number;
  usage?: { inputTokens: number; outputTokens: number };
}) {
  const inner = fakeInner(opts.usage);
  const now = () => DAY;
  const ledger = new UsageLedger({
    store: new InMemoryUsageLedgerStore(),
    dailyCeilingUsd: opts.dailyUsd,
    perCallCeilingUsd: opts.perCallUsd,
    now,
  });
  const gov = new GovernedProvider(inner.provider, {
    modelId: opts.modelId ?? 'test-model',
    ledger,
    now,
    estOutputTokens: opts.estOutputTokens,
  });
  return { gov, inner };
}

test('identical calls are served from cache — inner provider hit once', async () => {
  const { gov, inner } = governed({ dailyUsd: 100, perCallUsd: 1 });

  const a = await gov.generate(GEN_INPUT);
  const b = await gov.generate(GEN_INPUT);

  assert.deepEqual(a.output, b.output, 'same response');
  assert.equal(inner.calls(), 1, 'provider called once; second served from cache');

  const report = await gov.report();
  assert.equal(report.telemetry.calls, 2);
  assert.equal(report.telemetry.cacheHits, 1);
  assert.ok(report.telemetry.savingsUsd > 0, 'cache avoided real spend');
});

test('a runaway prompt is refused by the per-call ceiling BEFORE the provider runs', async () => {
  const { gov, inner } = governed({ dailyUsd: 100, perCallUsd: 0.0005 });

  await assert.rejects(
    () => gov.generate({ ...GEN_INPUT, user: 'x'.repeat(20000) }),
    (err: unknown) =>
      err instanceof AIOrchestrationError &&
      err.code === 'provider_unavailable' &&
      /budget/i.test(err.message),
  );
  assert.equal(inner.calls(), 0, 'the brake held — provider never ran');
});

test('spend accumulates in the ledger and is reported', async () => {
  const { gov, inner } = governed({ dailyUsd: 100, perCallUsd: 5 });

  // three DISTINCT prompts so none are cached
  for (let i = 0; i < 3; i += 1) {
    await gov.generate({ ...GEN_INPUT, user: `distinct question number ${i}` });
  }
  assert.equal(inner.calls(), 3);
  const report = await gov.report();
  assert.equal(report.telemetry.calls, 3);
  assert.equal(report.telemetry.cacheHits, 0);
  assert.ok(report.spentTodayUsd > 0, 'ledger recorded real spend');
});

test('the daily ceiling refuses further calls once the budget is spent', async () => {
  // provider reports 1000 in + 2000 out = $0.033 settled per call; a $0.07
  // ceiling fits two, the third is refused.
  const { gov, inner } = governed({
    dailyUsd: 0.07,
    perCallUsd: 1,
    estOutputTokens: 2000,
    usage: { inputTokens: 1000, outputTokens: 2000 },
  });

  let refused = false;
  let served = 0;
  for (let i = 0; i < 40 && !refused; i += 1) {
    try {
      await gov.generate({ ...GEN_INPUT, user: `unique prompt ${i} ${'y'.repeat(400)}` });
      served += 1;
    } catch (err) {
      if (err instanceof AIOrchestrationError && /budget/i.test(err.message)) refused = true;
    }
  }
  assert.ok(refused, 'daily ceiling eventually refuses within a warm process');
  assert.ok(served >= 1 && served < 40, 'some calls were served before the ceiling bit');
  assert.equal(inner.calls(), served, 'refused calls never reached the provider');
});
