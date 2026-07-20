import postgres from 'postgres';
import type { EnterpriseContext, IntegrationSignal } from './data-boundaries';
import type { KnowledgeRecord } from './drive-obsidian-knowledge';
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
  async upsertKnowledgeRecord(founderId: string, record: KnowledgeRecord): Promise<KnowledgeRecord> {
    const rows = await this.sql<{
      source_kind: 'google-drive' | 'obsidian';
      external_id: string;
      title: string;
      source_ref: string;
      modified_at: Date;
      received_at: Date;
      content: string;
      visibility: 'founder-private' | 'enterprise';
      tags: string[];
      owners: string[];
      mime_type: string | null;
      content_hash: string | null;
    }[]>`
      insert into knowledge_sources (
        founder_id, source_kind, external_id, title, source_ref, modified_at,
        content, visibility, tags, owners, mime_type, content_hash
      ) values (
        ${founderId}, ${record.sourceKind}, ${record.id}, ${record.title}, ${record.sourceRef}, ${record.modifiedAt},
        ${record.content}, ${record.visibility}, ${record.tags}, ${record.owners}, ${record.mimeType ?? null}, ${record.contentHash ?? null}
      )
      on conflict (founder_id, source_kind, external_id) do update
      set title = excluded.title,
          source_ref = excluded.source_ref,
          modified_at = excluded.modified_at,
          received_at = now(),
          content = excluded.content,
          visibility = excluded.visibility,
          tags = excluded.tags,
          owners = excluded.owners,
          mime_type = excluded.mime_type,
          content_hash = excluded.content_hash
      where knowledge_sources.modified_at <= excluded.modified_at
      returning source_kind, external_id, title, source_ref, modified_at, received_at, content, visibility, tags, owners, mime_type, content_hash
    `;
    const row = rows[0];
    if (!row) return record;
    return {
      id: row.external_id, title: row.title, sourceKind: row.source_kind, sourceRef: row.source_ref,
      modifiedAt: row.modified_at.toISOString(), receivedAt: row.received_at.toISOString(), content: row.content,
      visibility: row.visibility, tags: row.tags ?? [], owners: row.owners ?? [],
      mimeType: row.mime_type ?? undefined, contentHash: row.content_hash ?? undefined,
    };
  }

  async listKnowledgeRecords(founderId: string, limit = 200): Promise<KnowledgeRecord[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 500));
    const rows = await this.sql<{
      source_kind: 'google-drive' | 'obsidian'; external_id: string; title: string; source_ref: string;
      modified_at: Date; received_at: Date; content: string; visibility: 'founder-private' | 'enterprise';
      tags: string[]; owners: string[]; mime_type: string | null; content_hash: string | null;
    }[]>`
      select source_kind, external_id, title, source_ref, modified_at, received_at, content, visibility, tags, owners, mime_type, content_hash
      from knowledge_sources
      where founder_id = ${founderId}
      order by modified_at desc
      limit ${boundedLimit}
    `;
    return rows.map((row) => ({
      id: row.external_id, title: row.title, sourceKind: row.source_kind, sourceRef: row.source_ref,
      modifiedAt: row.modified_at.toISOString(), receivedAt: row.received_at.toISOString(), content: row.content,
      visibility: row.visibility, tags: row.tags ?? [], owners: row.owners ?? [],
      mimeType: row.mime_type ?? undefined, contentHash: row.content_hash ?? undefined,
    }));
  }

}
