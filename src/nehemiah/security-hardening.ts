import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const REDACTED_KEYS = new Set(['password', 'passphrase', 'secret', 'token', 'key', 'authorization', 'cookie']);

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createPasswordHash(password: string, salt = randomBytes(16)): string {
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return ['scrypt', '16384', '8', '1', salt.toString('base64url'), derived.toString('base64url')].join('$');
}

export function verifyPasswordHash(password: string, encoded: string): boolean {
  try {
    const [algorithm, n, r, p, saltValue, hashValue, extra] = encoded.split('$');
    if (algorithm !== 'scrypt' || extra || !n || !r || !p || !saltValue || !hashValue) return false;
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = scryptSync(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterMs: number; remaining: number };

export function createSlidingWindowRateLimiter(options: { limit: number; windowMs: number }) {
  const attempts = new Map<string, number[]>();
  return {
    consume(key: string, now = Date.now()): RateLimitResult {
      const recent = (attempts.get(key) ?? []).filter((timestamp) => timestamp > now - options.windowMs);
      if (recent.length >= options.limit) {
        return {
          allowed: false,
          retryAfterMs: Math.max(1, recent[0] + options.windowMs - now),
          remaining: 0,
        };
      }
      recent.push(now);
      attempts.set(key, recent);
      return { allowed: true, retryAfterMs: 0, remaining: Math.max(0, options.limit - recent.length) };
    },
    reset(key: string) {
      attempts.delete(key);
    },
  };
}

export type RotatingIntegrationKey = {
  current: string;
  previous?: string;
  previousExpiresAt?: string;
};

export function parseRotatingIntegrationKeys(serialized: string | undefined): Map<string, RotatingIntegrationKey> {
  if (!serialized) return new Map();
  try {
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    const entries: [string, RotatingIntegrationKey][] = [];
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value) entries.push([id, { current: value }]);
      else if (value && typeof value === 'object') {
        const candidate = value as Record<string, unknown>;
        if (typeof candidate.current === 'string' && candidate.current) {
          entries.push([id, {
            current: candidate.current,
            previous: typeof candidate.previous === 'string' ? candidate.previous : undefined,
            previousExpiresAt: typeof candidate.previousExpiresAt === 'string' ? candidate.previousExpiresAt : undefined,
          }]);
        }
      }
    }
    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function verifyRotatingIntegrationKey(
  integrationId: string,
  candidate: string,
  keys: Map<string, RotatingIntegrationKey>,
  now = new Date(),
): boolean {
  const configured = keys.get(integrationId);
  if (!configured) return false;
  if (safeEqual(Buffer.from(candidate), Buffer.from(configured.current))) return true;
  if (!configured.previous || !configured.previousExpiresAt) return false;
  if (Date.parse(configured.previousExpiresAt) <= now.getTime()) return false;
  return safeEqual(Buffer.from(candidate), Buffer.from(configured.previous));
}

export type SecurityEvent = {
  actorType: 'founder' | 'integration' | 'system' | 'anonymous';
  actorId: string;
  eventType: string;
  outcome: 'allowed' | 'denied' | 'error';
  requestId: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

function redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !REDACTED_KEYS.has(key.toLowerCase())));
}

export function createSecurityEvent(
  input: Omit<SecurityEvent, 'occurredAt' | 'metadata'> & { metadata?: Record<string, unknown> },
  now = new Date(),
): SecurityEvent {
  return {
    ...input,
    occurredAt: now.toISOString(),
    metadata: redactMetadata(input.metadata ?? {}),
  };
}
