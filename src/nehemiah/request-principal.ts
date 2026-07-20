import { timingSafeEqual } from 'node:crypto';
import { createIntegrationPrincipal, type IntegrationPrincipal } from './authorization';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseIntegrationKeys(serialized: string | undefined): Map<string, string> {
  if (!serialized) return new Map();
  try {
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    return new Map(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return new Map();
  }
}

export function authenticateIntegrationHeaders(
  headers: { integrationId?: string | null; integrationKey?: string | null },
  keys = parseIntegrationKeys(process.env.NEHEMIAH_INTEGRATION_KEYS),
): IntegrationPrincipal | null {
  const integrationId = headers.integrationId?.trim();
  const candidate = headers.integrationKey;
  if (!integrationId || !candidate) return null;
  const expected = keys.get(integrationId);
  if (!expected || !safeEqual(candidate, expected)) return null;
  return createIntegrationPrincipal(integrationId);
}
