import postgres from 'postgres';
import type { EnterpriseContext, IntegrationSignal } from './data-boundaries';
import { MemoryConflictError } from './cloud-memory';

export type CloudEnterpriseContext = {
  founderId: string;
  context: EnterpriseContext;
  revision: number;
  updatedAt: string;
};

export class PostgresBoundedDataStore {
  private readonly sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 2, prepare: false });
  }

  async loadEnterpriseContext(founderId: string): Promise<CloudEnterpriseContext | null> {
    const rows = await this.sql<{
      founder_id: string;
      context: EnterpriseContext;
      revision: number;
      updated_at: Date;
    }[]>`
      select founder_id, context, revision, updated_at
      from enterprise_context
      where founder_id = ${founderId}
      limit 1
    `;
    const row = rows[0];
    return row ? {
      founderId: row.founder_id,
      context: row.context,
      revision: row.revision,
      updatedAt: row.updated_at.toISOString(),
    } : null;
  }

  async saveEnterpriseContext(
    founderId: string,
    context: EnterpriseContext,
    expectedRevision: number,
  ): Promise<CloudEnterpriseContext> {
    const rows = await this.sql<{
      founder_id: string;
      context: EnterpriseContext;
      revision: number;
      updated_at: Date;
    }[]>`
      insert into enterprise_context (founder_id, context, revision)
      values (${founderId}, ${this.sql.json(context)}, 1)
      on conflict (founder_id) do update
      set context = excluded.context,
          revision = enterprise_context.revision + 1,
          updated_at = now()
      where enterprise_context.revision = ${expectedRevision}
      returning founder_id, context, revision, updated_at
    `;
    const row = rows[0];
    if (!row) throw new MemoryConflictError('Enterprise context changed in another session.');
    return {
      founderId: row.founder_id,
      context: row.context,
      revision: row.revision,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async appendIntegrationSignal(founderId: string, signal: IntegrationSignal): Promise<IntegrationSignal> {
    await this.sql`
      insert into integration_signals (
        founder_id, integration_id, external_id, signal_type,
        occurred_at, received_at, summary, payload
      ) values (
        ${founderId}, ${signal.integrationId}, ${signal.externalId}, ${signal.type},
        ${signal.occurredAt}, ${signal.receivedAt}, ${signal.summary},
        ${this.sql.json(JSON.parse(JSON.stringify(signal.payload ?? {})))}
      )
      on conflict (founder_id, integration_id, external_id) do nothing
    `;
    return signal;
  }

  async listIntegrationSignals(founderId: string, limit = 50): Promise<IntegrationSignal[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 200));
    const rows = await this.sql<{
      integration_id: string;
      external_id: string;
      signal_type: string;
      occurred_at: Date;
      received_at: Date;
      summary: string;
      payload: Record<string, unknown>;
    }[]>`
      select integration_id, external_id, signal_type, occurred_at, received_at, summary, payload
      from integration_signals
      where founder_id = ${founderId}
      order by received_at desc
      limit ${boundedLimit}
    `;
    return rows.map((row) => ({
      integrationId: row.integration_id,
      externalId: row.external_id,
      type: row.signal_type,
      occurredAt: row.occurred_at.toISOString(),
      receivedAt: row.received_at.toISOString(),
      summary: row.summary,
      payload: row.payload,
    }));
  }
}
