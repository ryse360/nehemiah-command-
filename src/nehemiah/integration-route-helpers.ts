import { NextRequest, NextResponse } from 'next/server';
import { requireAuthorization } from './authorization';
import { createIntegrationSignal, type IntegrationSignalInput } from './data-boundaries';
import { PostgresBoundedDataStore } from './postgres-bounded-data-store';
import { authenticateIntegrationHeaders } from './request-principal';
import { consumeIntegrationAttempt, recordSecurityEvent, securityEventForRequest } from './security-runtime';

function store() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  return new PostgresBoundedDataStore(connectionString);
}

export async function ingestNormalizedSignal(
  request: NextRequest,
  expectedIntegrationId: string,
  normalize: (value: unknown) => IntegrationSignalInput,
): Promise<NextResponse> {
  const integrationId = request.headers.get('x-nehemiah-integration-id') ?? '';
  const rate = await consumeIntegrationAttempt(request, integrationId);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Integration rate limit exceeded.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) },
    });
  }
  if (integrationId !== expectedIntegrationId) {
    return NextResponse.json({ error: `Expected integration identity ${expectedIntegrationId}.` }, { status: 403 });
  }
  const principal = authenticateIntegrationHeaders({
    integrationId,
    integrationKey: request.headers.get('x-nehemiah-integration-key'),
  });
  if (!principal) return NextResponse.json({ error: 'Unauthorized integration.' }, { status: 401 });

  requireAuthorization({ principal, domain: 'integration', action: 'append', integrationId });
  try {
    const normalized = normalize(await request.json());
    const signal = createIntegrationSignal(integrationId, normalized);
    const founderId = process.env.NEHEMIAH_FOUNDER_ID ?? 'primary-founder';
    await store().appendIntegrationSignal(founderId, signal);
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'integration', actorId: integrationId,
      eventType: 'integration.signal.accepted', outcome: 'allowed',
      metadata: { externalId: signal.externalId, signalType: signal.type },
    }), founderId);
    return NextResponse.json(signal, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Integration signal rejected.' }, { status: 400 });
  }
}
