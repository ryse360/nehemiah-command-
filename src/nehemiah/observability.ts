import { randomUUID } from 'node:crypto';

export type OperationalLevel = 'info' | 'warning' | 'error' | 'fatal';
export type OperationalEvent = {
  id: string;
  name: string;
  level: OperationalLevel;
  occurredAt: string;
  context: Record<string, unknown>;
};

const SECRET_PATTERN = /(secret|token|password|key|authorization|cookie|session)/i;
const inMemoryEvents: OperationalEvent[] = [];

function redact(value: unknown, key = ''): unknown {
  if (SECRET_PATTERN.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]));
  }
  if (typeof value === 'string') return value.slice(0, 500);
  return value;
}

export function createOperationalEvent(name: string, level: OperationalLevel, context: Record<string, unknown>, now = new Date()): OperationalEvent {
  if (!/^[a-z0-9.-]{3,80}$/i.test(name)) throw new Error('Operational event name is invalid.');
  return { id: randomUUID(), name, level, occurredAt: now.toISOString(), context: redact(context) as Record<string, unknown> };
}

export function appendOperationalEvent(event: OperationalEvent): void {
  inMemoryEvents.push(event);
  if (inMemoryEvents.length > 500) inMemoryEvents.splice(0, inMemoryEvents.length - 500);
}

export function listOperationalEvents(limit = 100): OperationalEvent[] {
  return inMemoryEvents.slice(-Math.max(1, Math.min(limit, 500))).reverse();
}

export function summarizeOperationalEvents(events: OperationalEvent[]) {
  const byLevel = { info: 0, warning: 0, error: 0, fatal: 0 };
  for (const event of events) byLevel[event.level] += 1;
  return { total: events.length, byLevel, requiresAttention: byLevel.error > 0 || byLevel.fatal > 0 };
}

export function buildHealthSnapshot(input: { database: boolean; aiProvider: boolean; integrations: boolean; version: string }, now = new Date()) {
  const checks = {
    database: input.database ? 'available' : 'unavailable',
    aiProvider: input.aiProvider ? 'configured' : 'unconfigured',
    integrations: input.integrations ? 'configured' : 'unconfigured',
  } as const;
  const unavailable = Object.values(checks).filter((value) => value === 'unavailable').length;
  return {
    status: unavailable ? 'degraded' as const : 'healthy' as const,
    version: input.version,
    checks,
    timestamp: now.toISOString(),
  };
}
