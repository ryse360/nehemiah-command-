// Durable, concurrency-safe AI usage ledger (step 2b) — the real daily ceiling.
//
// SERVER-ONLY. Stores ONLY derived economics: request id, Phoenix day, agent,
// model, price version, status, token counts, and cost in nano-dollars. Never
// prompts, responses, Founder content, secrets, or PII.
//
// Lifecycle per call:
//   reserve()   — atomic pre-call check against per-call + daily ceilings,
//                 fail-CLOSED, idempotent by request id. Reserves the ESTIMATE.
//   reconcile() — after the provider returns measured token usage, replace the
//                 estimate with the cost computed from usage × the versioned
//                 price table.
//   fail()      — provider errored: void the reservation so it costs nothing.
//   cacheHit()  — a cache hit is a zero-provider-cost event (telemetry only).
//
// Note (accuracy): providers report measured token USAGE, not a billed amount;
// cost is always computed from usage × the versioned price table.

import { costNano, usdToNano, type ModelSpec } from './cost';

// --- Phoenix day boundary ---------------------------------------------------
// America/Phoenix observes NO daylight saving, so the offset is a stable -7h;
// Intl is used anyway so the boundary is unambiguous and data-driven.
const PHOENIX = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Phoenix',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function phoenixDayKey(epochMs: number): string {
  return PHOENIX.format(new Date(epochMs)); // YYYY-MM-DD
}

// --- Versioned price table --------------------------------------------------
export interface ModelPrice {
  model: string; // exact model id, or '*' wildcard
  version: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

// Representative default. Verify against the provider's published rates; a new
// row (new version) is added rather than editing history, so past ledger
// entries stay reproducible against the price they were charged at.
export const PRICE_TABLE: readonly ModelPrice[] = [
  { model: '*', version: '2026-07', inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
];

export function priceFor(model: string, table: readonly ModelPrice[] = PRICE_TABLE): ModelPrice {
  const exact = table.filter((p) => p.model === model);
  const wildcard = table.filter((p) => p.model === '*');
  const pool = exact.length ? exact : wildcard;
  if (!pool.length) throw new Error(`No price for model ${model}`);
  // latest version wins (lexicographic YYYY-MM sorts chronologically)
  return pool.reduce((a, b) => (b.version > a.version ? b : a));
}

export function costNanoFromUsage(
  price: ModelPrice,
  inputTokens: number,
  outputTokens: number,
): number {
  const spec: ModelSpec = {
    id: price.model as ModelSpec['id'],
    tier: 'standard',
    inputUsdPerMillion: price.inputUsdPerMillion,
    outputUsdPerMillion: price.outputUsdPerMillion,
  };
  return costNano(spec, inputTokens, outputTokens);
}

// --- Store contract ---------------------------------------------------------
export type ReserveOutcome = 'ok' | 'per-call' | 'daily' | 'duplicate';

export interface ReserveParams {
  requestId: string;
  dayKey: string;
  agent: string;
  model: string;
  priceVersion: string;
  estCostNano: number;
  perCallCeilingNano: number;
  dailyCeilingNano: number;
}

export interface UsageLedgerStore {
  /** Atomic: check ceilings and reserve the estimate, all-or-nothing. */
  reserve(params: ReserveParams): Promise<ReserveOutcome>;
  reconcile(params: {
    requestId: string;
    actualCostNano: number;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void>;
  /** Provider failed: void the reservation so it does not count. */
  release(params: { requestId: string }): Promise<void>;
  recordCacheHit(params: {
    requestId: string;
    dayKey: string;
    agent: string;
    model: string;
  }): Promise<void>;
  spentTodayNano(dayKey: string): Promise<number>;
}

// --- In-memory store (faithful semantics, for tests) ------------------------
// Serializes reserve() through a promise chain — the JS equivalent of the
// Postgres per-day advisory lock — so the sum-check + insert is atomic and
// concurrent reservations cannot bypass the ceiling.
interface Row {
  requestId: string;
  dayKey: string;
  agent: string;
  model: string;
  status: 'reserved' | 'settled' | 'void' | 'cache_hit';
  estCostNano: number;
  actualCostNano: number | null;
}

export class InMemoryUsageLedgerStore implements UsageLedgerStore {
  private readonly rows = new Map<string, Row>();
  private lock: Promise<unknown> = Promise.resolve();

  private serialize<T>(fn: () => T): Promise<T> {
    const run = this.lock.then(fn, fn);
    this.lock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private daySpentNano(dayKey: string): number {
    let sum = 0;
    for (const r of this.rows.values()) {
      if (r.dayKey === dayKey && (r.status === 'reserved' || r.status === 'settled')) {
        sum += r.actualCostNano ?? r.estCostNano;
      }
    }
    return sum;
  }

  reserve(p: ReserveParams): Promise<ReserveOutcome> {
    return this.serialize(() => {
      const existing = this.rows.get(p.requestId);
      if (existing && existing.status !== 'void') return 'duplicate';
      if (p.estCostNano > p.perCallCeilingNano) return 'per-call';
      if (this.daySpentNano(p.dayKey) + p.estCostNano > p.dailyCeilingNano) return 'daily';
      this.rows.set(p.requestId, {
        requestId: p.requestId,
        dayKey: p.dayKey,
        agent: p.agent,
        model: p.model,
        status: 'reserved',
        estCostNano: p.estCostNano,
        actualCostNano: null,
      });
      return 'ok';
    });
  }

  async reconcile(p: {
    requestId: string;
    actualCostNano: number;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    const row = this.rows.get(p.requestId);
    if (row && row.status === 'reserved') {
      row.status = 'settled';
      row.actualCostNano = p.actualCostNano;
    }
  }

  async release(p: { requestId: string }): Promise<void> {
    const row = this.rows.get(p.requestId);
    if (row && row.status === 'reserved') {
      row.status = 'void';
      row.actualCostNano = 0;
    }
  }

  async recordCacheHit(p: {
    requestId: string;
    dayKey: string;
    agent: string;
    model: string;
  }): Promise<void> {
    if (this.rows.has(p.requestId)) return;
    this.rows.set(p.requestId, {
      requestId: p.requestId,
      dayKey: p.dayKey,
      agent: p.agent,
      model: p.model,
      status: 'cache_hit',
      estCostNano: 0,
      actualCostNano: 0,
    });
  }

  async spentTodayNano(dayKey: string): Promise<number> {
    return this.daySpentNano(dayKey);
  }
}

// --- Domain orchestrator ----------------------------------------------------
export interface UsageLedgerConfig {
  store: UsageLedgerStore;
  dailyCeilingUsd: number;
  perCallCeilingUsd: number;
  priceTable?: readonly ModelPrice[];
  now?: () => number;
}

export class UsageBudgetError extends Error {
  constructor(readonly reason: ReserveOutcome | 'unavailable') {
    super(`AI usage refused: ${reason}`);
    this.name = 'UsageBudgetError';
  }
}

export class UsageLedger {
  private readonly now: () => number;
  private readonly prices: readonly ModelPrice[];

  constructor(private readonly config: UsageLedgerConfig) {
    this.now = config.now ?? (() => Date.now());
    this.prices = config.priceTable ?? PRICE_TABLE;
  }

  /**
   * Reserve budget for a call. FAILS CLOSED: any ceiling breach OR store error
   * throws UsageBudgetError — the caller must not proceed to the provider.
   * Returns the price version the reservation was made under.
   */
  async reserve(params: {
    requestId: string;
    agent: string;
    model: string;
    estInputTokens: number;
    estOutputTokens: number;
  }): Promise<{ priceVersion: string }> {
    const price = priceFor(params.model, this.prices);
    const estCostNano = costNanoFromUsage(price, params.estInputTokens, params.estOutputTokens);
    const dayKey = phoenixDayKey(this.now());
    let outcome: ReserveOutcome;
    try {
      outcome = await this.config.store.reserve({
        requestId: params.requestId,
        dayKey,
        agent: params.agent,
        model: params.model,
        priceVersion: price.version,
        estCostNano,
        perCallCeilingNano: usdToNano(this.config.perCallCeilingUsd),
        dailyCeilingNano: usdToNano(this.config.dailyCeilingUsd),
      });
    } catch {
      // store/DB unavailable → fail CLOSED, refuse the spend.
      throw new UsageBudgetError('unavailable');
    }
    if (outcome !== 'ok') throw new UsageBudgetError(outcome);
    return { priceVersion: price.version };
  }

  /** Replace the estimate with cost computed from measured provider usage. */
  async reconcile(params: {
    requestId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    const price = priceFor(params.model, this.prices);
    await this.config.store.reconcile({
      requestId: params.requestId,
      actualCostNano: costNanoFromUsage(price, params.inputTokens, params.outputTokens),
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    });
  }

  async fail(requestId: string): Promise<void> {
    await this.config.store.release({ requestId });
  }

  async cacheHit(params: { requestId: string; agent: string; model: string }): Promise<void> {
    await this.config.store.recordCacheHit({
      requestId: params.requestId,
      dayKey: phoenixDayKey(this.now()),
      agent: params.agent,
      model: params.model,
    });
  }

  async spentTodayNano(): Promise<number> {
    return this.config.store.spentTodayNano(phoenixDayKey(this.now()));
  }
}
