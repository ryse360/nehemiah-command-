import { createSecurityEvent, type SecurityEvent } from './security-hardening';
import { distributedRateLimitStoreFromEnv } from './distributed-rate-limit';
import { securityStoreFromEnv } from './security-store';


export function requestFingerprint(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return `${scope}:${forwarded || realIp || 'unknown'}`;
}

export async function consumeLoginAttempt(request: Request) {
  return distributedRateLimitStoreFromEnv().consume(requestFingerprint(request, 'login'), { limit: 5, windowMs: 15 * 60_000 });
}

export async function resetLoginAttempts(request: Request) {
  await distributedRateLimitStoreFromEnv().reset(requestFingerprint(request, 'login'));
}

export async function consumeIntegrationAttempt(request: Request, integrationId: string) {
  return distributedRateLimitStoreFromEnv().consume(requestFingerprint(request, `integration:${integrationId || 'unknown'}`), { limit: 120, windowMs: 60_000 });
}

export async function recordSecurityEvent(event: SecurityEvent, founderId?: string): Promise<void> {
  try {
    await securityStoreFromEnv().appendSecurityEvent(event, founderId);
  } catch (error) {
    console.error('Security audit event could not be persisted.', {
      eventType: event.eventType,
      requestId: event.requestId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export function securityEventForRequest(
  request: Request,
  input: Omit<Parameters<typeof createSecurityEvent>[0], 'requestId'>,
) {
  return createSecurityEvent({
    ...input,
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
  });
}
