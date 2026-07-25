import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InMemoryUsageLedgerStore,
  UsageBudgetError,
  UsageLedger,
  costNanoFromUsage,
  phoenixDayKey,
  priceFor,
  type UsageLedgerConfig,
} from './usage-ledger';
import { nanoToUsd, usdToNano } from './cost';

// each call: 1000 in + 1000 out at the default $3/$15 per-million →
// 1000*3000 + 1000*15000 = 18,000,000 nano = $0.018
const CALL = { estInputTokens: 1000, estOutputTokens: 1000 };
const CALL_NANO = 18_000_000;

function ledger(overrides: Partial<UsageLedgerConfig> = {}, nowMs = Date.UTC(2026, 5, 1, 20, 0, 0)) {
  return new UsageLedger({
    store: new InMemoryUsageLedgerStore(),
    dailyCeilingUsd: 100,
    perCallCeilingUsd: 5,
    now: () => nowMs,
    ...overrides,
  });
}

test('Phoenix day boundary rolls at 00:00 local (07:00 UTC, no DST)', () => {
  // 06:59 UTC is still the previous Phoenix day; 07:00 UTC is the new one.
  assert.equal(phoenixDayKey(Date.UTC(2026, 0, 1, 6, 59, 0)), '2025-12-31');
  assert.equal(phoenixDayKey(Date.UTC(2026, 0, 1, 7, 0, 0)), '2026-01-01');
});

test('cost is computed from usage × the versioned price table', () => {
  const price = priceFor('any-model');
  assert.equal(price.version, '2026-07');
  assert.equal(costNanoFromUsage(price, 1000, 1000), CALL_NANO);
});

test('per-call ceiling fails closed before any reservation', async () => {
  const l = ledger({ perCallCeilingUsd: 0.01 }); // below one $0.018 call
  await assert.rejects(
    () => l.reserve({ requestId: 'r1', agent: 'founder-ai', model: 'm', ...CALL }),
    (e: unknown) => e instanceof UsageBudgetError && e.reason === 'per-call',
  );
});

test('concurrent reservations cannot bypass the daily ceiling', async () => {
  // daily budget = exactly three calls
  const l = ledger({ dailyCeilingUsd: nanoToUsd(3 * CALL_NANO) });
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      l.reserve({ requestId: `r${i}`, agent: 'founder-ai', model: 'm', ...CALL }),
    ),
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const daily = results.filter(
    (r) => r.status === 'rejected' && (r.reason as UsageBudgetError).reason === 'daily',
  ).length;
  assert.equal(ok, 3, 'exactly three fit under the ceiling');
  assert.equal(daily, 7, 'the rest are refused');
});

test('duplicate request id does not double-charge', async () => {
  const l = ledger();
  await l.reserve({ requestId: 'dup', agent: 'a', model: 'm', ...CALL });
  await assert.rejects(
    () => l.reserve({ requestId: 'dup', agent: 'a', model: 'm', ...CALL }),
    (e: unknown) => e instanceof UsageBudgetError && e.reason === 'duplicate',
  );
  assert.equal(await l.spentTodayNano(), CALL_NANO, 'charged once, not twice');
});

test('a failed provider call is voided and frees the budget', async () => {
  const l = ledger({ dailyCeilingUsd: nanoToUsd(CALL_NANO) }); // room for one
  await l.reserve({ requestId: 'r1', agent: 'a', model: 'm', ...CALL });
  await l.fail('r1'); // provider errored
  assert.equal(await l.spentTodayNano(), 0, 'void reservation frees the day');
  // the freed budget can be reused
  await assert.doesNotReject(() =>
    l.reserve({ requestId: 'r2', agent: 'a', model: 'm', ...CALL }),
  );
});

test('reconciliation replaces the estimate with measured-usage cost', async () => {
  const l = ledger();
  await l.reserve({ requestId: 'r1', agent: 'a', model: 'm', ...CALL });
  assert.equal(await l.spentTodayNano(), CALL_NANO, 'estimate reserved first');
  // provider reported far fewer output tokens than estimated
  await l.reconcile({ requestId: 'r1', model: 'm', inputTokens: 1000, outputTokens: 100 });
  const settled = 1000 * 3000 + 100 * 15000; // 4,500,000
  assert.equal(await l.spentTodayNano(), settled, 'day reflects actual, not estimate');
  assert.ok(settled < CALL_NANO);
});

test('cache hits are zero-cost events that do not touch the budget', async () => {
  const l = ledger();
  await l.cacheHit({ requestId: 'c1', agent: 'a', model: 'm' });
  assert.equal(await l.spentTodayNano(), 0, 'cache hit costs nothing');
});
