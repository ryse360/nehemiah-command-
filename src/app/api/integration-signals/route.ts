import { NextRequest, NextResponse } from 'next/server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';
import { createIntegrationSignal, type IntegrationSignalInput } from '@/nehemiah/data-boundaries';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { PostgresBoundedDataStore } from '@/nehemiah/postgres-bounded-data-store';
import { authenticateIntegrationHeaders } from '@/nehemiah/request-principal';
import { consumeIntegrationAttempt, recordSecurityEvent, securityEventForRequest } from '@/nehemiah/security-runtime';

export const runtime = 'nodejs';

function store() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  return new PostgresBoundedDataStore(connectionString);
}

export async function POST(request: NextRequest) {
  const integrationId = request.headers.get('x-nehemiah-integration-id') ?? '';
  const rate = await consumeIntegrationAttempt(request, integrationId);
  if (!rate.allowed) {
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'integration', actorId: integrationId || 'unknown',
      eventType: 'integration.ingest.rate_limited', outcome: 'denied',
      metadata: { retryAfterMs: rate.retryAfterMs },
    }));
    return NextResponse.json({ error: 'Integration rate limit exceeded.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) },
    });
  }
  const principal = authenticateIntegrationHeaders({
    integrationId,
    integrationKey: request.headers.get('x-nehemiah-integration-key'),
  });
  if (!principal) {
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'integration', actorId: integrationId || 'unknown',
      eventType: 'integration.auth.failed', outcome: 'denied',
    }));
    return NextResponse.json({ error: 'Unauthorized integration.' }, { status: 401 });
  }
  requireAuthorization({
    principal,
    domain: 'integration',
    action: 'append',
    integrationId: principal.integrationId,
  });
  try {
    const input = await request.json() as IntegrationSignalInput;
    const signal = createIntegrationSignal(principal.integrationId, input);
    const founderId = process.env.NEHEMIAH_FOUNDER_ID ?? 'primary-founder';
    await store().appendIntegrationSignal(founderId, signal);
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'integration', actorId: principal.integrationId,
      eventType: 'integration.signal.accepted', outcome: 'allowed',
      metadata: { externalId: signal.externalId, signalType: signal.type },
    }), founderId);
    return NextResponse.json(signal, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Integration signal rejected.' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireAuthorization({
    principal: createFounderPrincipal(session.founderId),
    domain: 'integration',
    action: 'read',
  });
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50);
    return NextResponse.json({ signals: await store().listIntegrationSignals(session.founderId, limit) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Integration signals unavailable.' }, { status: 503 });
  }
}
