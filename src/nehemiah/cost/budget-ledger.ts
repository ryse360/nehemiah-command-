// The budget ledger: every model call is recorded here, in integer
// nano-dollars, attributed to an agent and bucketed by UTC day. This is the
// source of truth for "how much has been spent, by whom, today".
//
// SERVER-ONLY. In-memory reference implementation with a pluggable clock; a
// durable store (Postgres — already a dependency) can back the same interface
// later without changing callers.

export interface LedgerEntry {
  agent: string;
  task: string;
  model: string;
  tier: string;
  inputTokens: number;
  outputTokens: number;
  costNano: number;
  timestampMs: number;
  /** UTC calendar day, YYYY-MM-DD — the daily-ceiling bucket. */
  dayKey: string;
}

export type Clock = () => number;

/** UTC day bucket. Deterministic given a timestamp — no local-timezone drift. */
export function dayKeyOf(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

export class BudgetLedger {
  private readonly entries: LedgerEntry[] = [];
  private readonly now: Clock;

  constructor(now: Clock) {
    this.now = now;
  }

  record(entry: Omit<LedgerEntry, 'timestampMs' | 'dayKey'>): LedgerEntry {
    const timestampMs = this.now();
    const full: LedgerEntry = { ...entry, timestampMs, dayKey: dayKeyOf(timestampMs) };
    this.entries.push(full);
    return full;
  }

  /** Total spend on a given UTC day (defaults to the clock's current day). */
  spentOnDayNano(dayKey: string = dayKeyOf(this.now())): number {
    return this.entries
      .filter((e) => e.dayKey === dayKey)
      .reduce((sum, e) => sum + e.costNano, 0);
  }

  /** Spend by one agent on a given UTC day. */
  spentByAgentOnDayNano(
    agent: string,
    dayKey: string = dayKeyOf(this.now()),
  ): number {
    return this.entries
      .filter((e) => e.dayKey === dayKey && e.agent === agent)
      .reduce((sum, e) => sum + e.costNano, 0);
  }

  /** Cost attribution: total nano-dollars per agent on a given day. */
  attributionByAgent(dayKey: string = dayKeyOf(this.now())): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.entries) {
      if (e.dayKey !== dayKey) continue;
      out[e.agent] = (out[e.agent] ?? 0) + e.costNano;
    }
    return out;
  }

  all(): readonly LedgerEntry[] {
    return this.entries;
  }
}
