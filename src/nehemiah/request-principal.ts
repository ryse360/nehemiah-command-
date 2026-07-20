import { createIntegrationPrincipal, type IntegrationPrincipal } from './authorization';
import { parseRotatingIntegrationKeys, verifyRotatingIntegrationKey } from './security-hardening';

export const parseIntegrationKeys = parseRotatingIntegrationKeys;

export function authenticateIntegrationHeaders(
  headers: { integrationId?: string | null; integrationKey?: string | null },
  keys: Map<string, string | import('./security-hardening').RotatingIntegrationKey> = parseRotatingIntegrationKeys(process.env.NEHEMIAH_INTEGRATION_KEYS),
  now = new Date(),
): IntegrationPrincipal | null {
  const integrationId = headers.integrationId?.trim();
  const candidate = headers.integrationKey;
  if (!integrationId || !candidate) return null;
  const normalized = new Map([...keys].map(([id, value]) => [id, typeof value === 'string' ? { current: value } : value]));
  if (!verifyRotatingIntegrationKey(integrationId, candidate, normalized, now)) return null;
  return createIntegrationPrincipal(integrationId);
}
