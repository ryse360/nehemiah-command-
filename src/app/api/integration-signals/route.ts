import { NextRequest, NextResponse } from 'next/server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';
import { createIntegrationSignal, type IntegrationSignalInput } from '@/nehemiah/data-boundaries';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { PostgresBoundedDataStore } from '@/nehemiah/postgres-bounded-data-store';
import { authenticateIntegrationHeaders } from '@/nehemiah/request-principal';

export const runtime = 'nodejs';

function store() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  return new PostgresBoundedDataStore(connectionString);
}

export async function POST(request: NextRequest) {
  const principal = authenticateIntegrationHeaders({
    integrationId: request.headers.get('x-nehemiah-integration-id'),
    integrationKey: request.headers.get('x-nehemiah-integration-key'),
  });
  if (!principal) return NextResponse.json({ error: 'Unauthorized integration.' }, { status: 401 });
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
