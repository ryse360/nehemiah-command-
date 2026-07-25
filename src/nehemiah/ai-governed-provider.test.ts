import test from 'node:test';
import assert from 'node:assert/strict';

import { AIOrchestrationError, type AIModelProvider, type AIProviderResponse } from './ai-orchestration';
import { GovernedProvider } from './ai-governed-provider';
import { DEFAULT_MODELS } from './cost';

function fakeInner() {
  let calls = 0;
  const provider: AIModelProvider = {
    async generate() {
      calls += 1;
      return { model: 'test-model', providerRequestId: `r${calls}`, output: { ok: true, n: calls } };
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

test('identical calls are served from cache — inner provider hit once', async () => {
  const inner = fakeInner();
  const gov = new GovernedProvider(inner.provider, {
    model: DEFAULT_MODELS.standard,
    dailyUsdCeiling: 100,
    perOperationUsdCeiling: 1,
    now: () => DAY,
  });

  const a = await gov.generate(GEN_INPUT);
  const b = await gov.generate(GEN_INPUT);

  assert.deepEqual(a.output, b.output, 'same response');
  assert.equal(inner.calls(), 1, 'provider called once; second served from cache');

  const report = gov.report();
  assert.equal(report.telemetry.calls, 2);
  assert.equal(report.telemetry.cacheHits, 1);
  assert.ok(report.telemetry.savingsUsd > 0, 'cache avoided real spend');
});

test('a runaway prompt is refused by the per-call ceiling BEFORE the provider runs', async () => {
  const inner = fakeInner();
  const gov = new GovernedProvider(inner.provider, {
    model: DEFAULT_MODELS.premium, // dear model makes the ceiling bite
    dailyUsdCeiling: 100,
    perOperationUsdCeiling: 0.0005,
    now: () => DAY,
  });

  await assert.rejects(
    () => gov.generate({ ...GEN_INPUT, user: 'x'.repeat(20000) }),
    (err: unknown) =>
      err instanceof AIOrchestrationError &&
      err.code === 'provider_unavailable' &&
      /ceiling/i.test(err.message),
  );
  assert.equal(inner.calls(), 0, 'the brake held — provider never ran');
});

test('spend accumulates in the ledger and is reported', async () => {
  const inner = fakeInner();
  const gov = new GovernedProvider(inner.provider, {
    model: DEFAULT_MODELS.standard,
    dailyUsdCeiling: 100,
    perOperationUsdCeiling: 5,
    now: () => DAY,
  });

  // three DISTINCT prompts so none are cached
  for (let i = 0; i < 3; i += 1) {
    await gov.generate({ ...GEN_INPUT, user: `distinct question number ${i}` });
  }
  assert.equal(inner.calls(), 3);
  const report = gov.report();
  assert.equal(report.telemetry.calls, 3);
  assert.equal(report.telemetry.cacheHits, 0);
  assert.ok(report.spentTodayUsd > 0, 'ledger recorded real spend');
});

test('the daily ceiling refuses further calls once the budget is spent', async () => {
  const inner = fakeInner();
  const gov = new GovernedProvider(inner.provider, {
    model: DEFAULT_MODELS.premium,
    dailyUsdCeiling: 0.02,
    perOperationUsdCeiling: 1,
    now: () => DAY,
    estOutputTokens: 2000,
  });

  // burn through the tiny daily budget with distinct prompts, then expect a refusal
  let refused = false;
  for (let i = 0; i < 40 && !refused; i += 1) {
    try {
      await gov.generate({ ...GEN_INPUT, user: `unique prompt ${i} ${'y'.repeat(400)}` });
    } catch (err) {
      if (err instanceof AIOrchestrationError && /ceiling/i.test(err.message)) refused = true;
    }
  }
  assert.ok(refused, 'daily ceiling eventually refuses within a warm process');
});
