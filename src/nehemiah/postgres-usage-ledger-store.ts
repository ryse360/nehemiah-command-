// Postgres-backed usage ledger store — the durable, concurrency-safe daily
// ceiling. reserve() runs inside a transaction that first takes a per-day
// advisory lock, so the sum-check and insert are atomic: concurrent requests
// serialize per Phoenix day and cannot bypass the ceiling.
//
// SERVER-ONLY. Stores only derived economics (see 007-ai-usage-ledger.sql).

import postgres from 'postgres';
import type { ReserveOutcome, ReserveParams, UsageLedgerStore } from './usage-ledger';

export class PostgresUsageLedgerStore implements UsageLedgerStore {
  private readonly sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 4, prepare: false });
  }

  async reserve(p: ReserveParams): Promise<ReserveOutcome> {
    return this.sql.begin(async (sql) => {
      // serialize all reservations for this Phoenix day (transaction-scoped;
      // released on commit/rollback) so the check+insert below is atomic.
      await sql`select pg_advisory_xact_lock(hashtext(${p.dayKey}))`;

      const existing = await sql<{ status: string }[]>`
        select status from ai_usage_ledger where request_id = ${p.requestId}
      `;
      // a prior VOID (failed provider) may be re-reserved; anything else that
      // already exists is a genuine duplicate and must not double-charge.
      if (existing.length && existing[0].status !== 'void') {
        return 'duplicate' as ReserveOutcome;
      }

      if (p.estCostNano > p.perCallCeilingNano) return 'per-call' as ReserveOutcome;

      const [{ spent }] = await sql<{ spent: string }[]>`
        select coalesce(sum(coalesce(actual_cost_nano, est_cost_nano)), 0)::bigint as spent
        from ai_usage_ledger
        where day_key = ${p.dayKey} and status in ('reserved', 'settled')
      `;
      if (Number(spent) + p.estCostNano > p.dailyCeilingNano) {
        return 'daily' as ReserveOutcome;
      }

      await sql`
        insert into ai_usage_ledger
          (request_id, day_key, agent, model, price_version, status, est_cost_nano)
        values
          (${p.requestId}, ${p.dayKey}, ${p.agent}, ${p.model}, ${p.priceVersion}, 'reserved', ${p.estCostNano})
        on conflict (request_id) do update
          set status = 'reserved',
              est_cost_nano = excluded.est_cost_nano,
              day_key = excluded.day_key,
              price_version = excluded.price_version,
              actual_cost_nano = null,
              settled_at = null,
              created_at = now()
          where ai_usage_ledger.status = 'void'
      `;
      return 'ok' as ReserveOutcome;
    });
  }

  async reconcile(p: {
    requestId: string;
    actualCostNano: number;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    await this.sql`
      update ai_usage_ledger
        set status = 'settled',
            actual_cost_nano = ${p.actualCostNano},
            input_tokens = ${p.inputTokens},
            output_tokens = ${p.outputTokens},
            settled_at = now()
        where request_id = ${p.requestId} and status = 'reserved'
    `;
  }

  async release(p: { requestId: string }): Promise<void> {
    await this.sql`
      update ai_usage_ledger
        set status = 'void', actual_cost_nano = 0, settled_at = now()
        where request_id = ${p.requestId} and status = 'reserved'
    `;
  }

  async recordCacheHit(p: {
    requestId: string;
    dayKey: string;
    agent: string;
    model: string;
  }): Promise<void> {
    await this.sql`
      insert into ai_usage_ledger
        (request_id, day_key, agent, model, price_version, status, est_cost_nano, actual_cost_nano)
      values
        (${p.requestId}, ${p.dayKey}, ${p.agent}, ${p.model}, 'cache', 'cache_hit', 0, 0)
      on conflict (request_id) do nothing
    `;
  }

  async spentTodayNano(dayKey: string): Promise<number> {
    const [{ spent }] = await this.sql<{ spent: string }[]>`
      select coalesce(sum(coalesce(actual_cost_nano, est_cost_nano)), 0)::bigint as spent
      from ai_usage_ledger
      where day_key = ${dayKey} and status in ('reserved', 'settled')
    `;
    return Number(spent);
  }
}
