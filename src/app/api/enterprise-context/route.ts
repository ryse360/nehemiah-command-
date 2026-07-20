import { NextResponse } from 'next/server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';
import { createEnterpriseContext, type EnterpriseContextInput } from '@/nehemiah/data-boundaries';
import { MemoryConflictError } from '@/nehemiah/cloud-memory';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { PostgresBoundedDataStore } from '@/nehemiah/postgres-bounded-data-store';

export const runtime = 'nodejs';

function store() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  return new PostgresBoundedDataStore(connectionString);
}

export async function GET() {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireAuthorization({
    principal: createFounderPrincipal(session.founderId),
    domain: 'enterprise',
    action: 'read',
  });
  try {
    const record = await store().loadEnterpriseContext(session.founderId);
    return NextResponse.json(record ?? {
      founderId: session.founderId,
      context: createEnterpriseContext({ priorities: [], commitments: [], projects: [] }),
      revision: 0,
      updatedAt: null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Enterprise context unavailable.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireAuthorization({
    principal: createFounderPrincipal(session.founderId),
    domain: 'enterprise',
    action: 'write',
  });
  try {
    const body = await request.json() as { context?: EnterpriseContextInput; expectedRevision?: number };
    if (!body.context || typeof body.expectedRevision !== 'number') {
      return NextResponse.json({ error: 'Context and expectedRevision are required.' }, { status: 400 });
    }
    const context = createEnterpriseContext(body.context);
    return NextResponse.json(await store().saveEnterpriseContext(session.founderId, context, body.expectedRevision));
  } catch (error) {
    if (error instanceof MemoryConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Enterprise context unavailable.' }, { status: 503 });
  }
}
