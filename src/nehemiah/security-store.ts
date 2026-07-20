import postgres from 'postgres';
import type { SecurityEvent } from './security-hardening';

export interface SecurityStore {
  revokeSession(founderId: string, sessionId: string, expiresAt: Date): Promise<void>;
  isSessionRevoked(founderId: string, sessionId: string): Promise<boolean>;
  appendSecurityEvent(event: SecurityEvent, founderId?: string): Promise<void>;
  listSecurityEvents(founderId: string, limit?: number): Promise<SecurityEvent[]>;
}

export class InMemorySecurityStore implements SecurityStore {
  private readonly revoked = new Set<string>();
  private readonly events: SecurityEvent[] = [];

  async revokeSession(founderId: string, sessionId: string, _expiresAt: Date): Promise<void> {
    this.revoked.add(`${founderId}:${sessionId}`);
  }

  async isSessionRevoked(founderId: string, sessionId: string): Promise<boolean> {
    return this.revoked.has(`${founderId}:${sessionId}`);
  }

  async appendSecurityEvent(event: SecurityEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }

  async listSecurityEvents(_founderId: string, limit = 100): Promise<SecurityEvent[]> {
    return this.events.slice(-limit).map((event) => structuredClone(event));
  }
}

export class PostgresSecurityStore implements SecurityStore {
  private readonly sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 2, prepare: false });
  }

  async revokeSession(founderId: string, sessionId: string, expiresAt: Date): Promise<void> {
    await this.sql`
      insert into revoked_founder_sessions (founder_id, session_id, expires_at)
      values (${founderId}, ${sessionId}, ${expiresAt.toISOString()})
      on conflict (founder_id, session_id) do update set expires_at = excluded.expires_at
    `;
  }

  async isSessionRevoked(founderId: string, sessionId: string): Promise<boolean> {
    const rows = await this.sql<{ exists: boolean }[]>`
      select exists(
        select 1 from revoked_founder_sessions
        where founder_id = ${founderId}
          and session_id = ${sessionId}
          and expires_at > now()
      ) as exists
    `;
    return Boolean(rows[0]?.exists);
  }

  async appendSecurityEvent(event: SecurityEvent, founderId = 'primary-founder'): Promise<void> {
    await this.sql`
      insert into security_audit_events (
        founder_id, actor_type, actor_id, event_type, outcome,
        request_id, occurred_at, metadata
      ) values (
        ${founderId}, ${event.actorType}, ${event.actorId}, ${event.eventType}, ${event.outcome},
        ${event.requestId}, ${event.occurredAt}, ${this.sql.json(JSON.parse(JSON.stringify(event.metadata)))}
      )
    `;
  }

  async listSecurityEvents(founderId: string, limit = 100): Promise<SecurityEvent[]> {
    const bounded = Math.max(1, Math.min(limit, 500));
    const rows = await this.sql<{
      actor_type: SecurityEvent['actorType']; actor_id: string; event_type: string;
      outcome: SecurityEvent['outcome']; request_id: string; occurred_at: Date;
      metadata: Record<string, unknown>;
    }[]>`
      select actor_type, actor_id, event_type, outcome, request_id, occurred_at, metadata
      from security_audit_events
      where founder_id = ${founderId}
      order by occurred_at desc
      limit ${bounded}
    `;
    return rows.map((row) => ({
      actorType: row.actor_type,
      actorId: row.actor_id,
      eventType: row.event_type,
      outcome: row.outcome,
      requestId: row.request_id,
      occurredAt: row.occurred_at.toISOString(),
      metadata: row.metadata,
    }));
  }
}

let memoryStore: InMemorySecurityStore | undefined;

export function securityStoreFromEnv(): SecurityStore {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) return new PostgresSecurityStore(connectionString);
  memoryStore ??= new InMemorySecurityStore();
  return memoryStore;
}
