import { NextResponse } from 'next/server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';
import { buildFounderAgenda } from '@/nehemiah/calendar-gmail-integration';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { PostgresBoundedDataStore } from '@/nehemiah/postgres-bounded-data-store';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireAuthorization({ principal: createFounderPrincipal(session.founderId), domain: 'integration', action: 'read' });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  try {
    const signals = await new PostgresBoundedDataStore(connectionString).listIntegrationSignals(session.founderId, 100);
    return NextResponse.json(buildFounderAgenda(signals));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Founder agenda unavailable.' }, { status: 503 });
  }
}
