import { NextRequest, NextResponse } from 'next/server';
import { PostgresFounderMemoryStore } from '@/nehemiah/postgres-founder-memory-store';
import { deserializeFounderMemory, type FounderMemory } from '@/nehemiah/founder-memory';
import { MemoryConflictError } from '@/nehemiah/cloud-memory';

export const runtime = 'nodejs';

function authorize(request: NextRequest): boolean {
  const configured = process.env.NEHEMIAH_FOUNDER_ACCESS_KEY;
  if (!configured) return false;
  return request.headers.get('authorization') === `Bearer ${configured}`;
}

function store() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  return new PostgresFounderMemoryStore(connectionString);
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const founderId = process.env.NEHEMIAH_FOUNDER_ID ?? 'primary-founder';
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
  if (!authorize(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { memory?: FounderMemory; expectedRevision?: number };
    if (!body.memory || typeof body.expectedRevision !== 'number') {
      return NextResponse.json({ error: 'Memory and expectedRevision are required.' }, { status: 400 });
    }
    const founderId = process.env.NEHEMIAH_FOUNDER_ID ?? 'primary-founder';
    const record = await store().save(founderId, body.memory, body.expectedRevision);
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof MemoryConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloud memory unavailable.' }, { status: 503 });
  }
}
