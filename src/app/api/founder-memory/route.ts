import { NextRequest, NextResponse } from 'next/server';
import { PostgresFounderMemoryStore } from '@/nehemiah/postgres-founder-memory-store';
import { deserializeFounderMemory, type FounderMemory } from '@/nehemiah/founder-memory';
import { MemoryConflictError } from '@/nehemiah/cloud-memory';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';

export const runtime = 'nodejs';

function store() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  return new PostgresFounderMemoryStore(connectionString);
}

export async function GET(request: NextRequest) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    requireAuthorization({ principal: createFounderPrincipal(session.founderId), domain: 'founder-private', action: 'read' });
    const founderId = session.founderId;
    const record = await store().load(founderId);
    return NextResponse.json(record ?? {
      founderId,
      memory: deserializeFounderMemory(null),
      revision: 0,
      updatedAt: null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloud memory unavailable.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { memory?: FounderMemory; expectedRevision?: number };
    if (!body.memory || typeof body.expectedRevision !== 'number') {
      return NextResponse.json({ error: 'Memory and expectedRevision are required.' }, { status: 400 });
    }
    requireAuthorization({ principal: createFounderPrincipal(session.founderId), domain: 'founder-private', action: 'write' });
    const founderId = session.founderId;
    const record = await store().save(founderId, body.memory, body.expectedRevision);
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof MemoryConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloud memory unavailable.' }, { status: 503 });
  }
}
