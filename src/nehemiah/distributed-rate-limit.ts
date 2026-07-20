import postgres from 'postgres';
import type { RateLimitResult } from './security-hardening';

export type DistributedRateLimitOptions = { limit: number; windowMs: number };

export interface DistributedRateLimitStore {
  consume(key: string, options: DistributedRateLimitOptions, now?: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export class InMemoryDistributedRateLimitStore implements DistributedRateLimitStore {
  private readonly attempts = new Map<string, number[]>();

  async consume(key: string, options: DistributedRateLimitOptions, now = Date.now()): Promise<RateLimitResult> {
    const recent = (this.attempts.get(key) ?? []).filter((timestamp) => timestamp > now - options.windowMs);
    if (recent.length >= options.limit) {
      return {
        allowed: false,
        retryAfterMs: Math.max(1, recent[0] + options.windowMs - now),
        remaining: 0,
      };
    }
    recent.push(now);
    this.attempts.set(key, recent);
    return { allowed: true, retryAfterMs: 0, remaining: Math.max(0, options.limit - recent.length) };
  }

  async reset(key: string): Promise<void> {
    this.attempts.delete(key);
  }
}

export class PostgresDistributedRateLimitStore implements DistributedRateLimitStore {
  private readonly sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 2, prepare: false });
  }

  async consume(key: string, options: DistributedRateLimitOptions, now = Date.now()): Promise<RateLimitResult> {
    const windowStart = new Date(now - options.windowMs).toISOString();
    const expiresAt = new Date(now + options.windowMs).toISOString();
    const rows = await this.sql<{ attempt_count: number; first_attempt_at: Date; was_inserted: boolean }[]>`
      with cleaned as (
        delete from distributed_rate_limit_attempts where expires_at <= to_timestamp(${now} / 1000.0)
      ), current_window as (
        select count(*)::int as attempt_count, min(attempted_at) as first_attempt_at
        from distributed_rate_limit_attempts
        where limiter_key = ${key} and attempted_at > ${windowStart}
      ), inserted as (
        insert into distributed_rate_limit_attempts (limiter_key, attempted_at, expires_at)
        select ${key}, to_timestamp(${now} / 1000.0), ${expiresAt}
        where (select attempt_count from current_window) < ${options.limit}
        returning 1
      )
      select
        (select attempt_count from current_window) + (select count(*)::int from inserted) as attempt_count,
        coalesce((select first_attempt_at from current_window), to_timestamp(${now} / 1000.0)) as first_attempt_at,
        exists(select 1 from inserted) as was_inserted
    `;
    const count = rows[0]?.attempt_count ?? 0;
    const allowed = Boolean(rows[0]?.was_inserted);
    if (!allowed) {
      return { allowed: false, retryAfterMs: Math.max(1, (rows[0]?.first_attempt_at.getTime() ?? now) + options.windowMs - now), remaining: 0 };
    }
    return { allowed: true, retryAfterMs: 0, remaining: Math.max(0, options.limit - count) };
  }

  async reset(key: string): Promise<void> {
    await this.sql`delete from distributed_rate_limit_attempts where limiter_key = ${key}`;
  }
}

let memoryStore: InMemoryDistributedRateLimitStore | undefined;

export function distributedRateLimitStoreFromEnv(): DistributedRateLimitStore {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) return new PostgresDistributedRateLimitStore(connectionString);
  memoryStore ??= new InMemoryDistributedRateLimitStore();
  return memoryStore;
}
