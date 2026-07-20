import { NextResponse } from 'next/server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';
import { createEnterpriseContext } from '@/nehemiah/data-boundaries';
import { MemoryConflictError } from '@/nehemiah/cloud-memory';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { PostgresBoundedDataStore } from '@/nehemiah/postgres-bounded-data-store';
import { buildProjectPortfolio, normalizeEnterpriseProjects, validateProjects, type FounderProject } from '@/nehemiah/projects-actions';

export const runtime = 'nodejs';

function store() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  return new PostgresBoundedDataStore(connectionString);
}

export async function GET() {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireAuthorization({ principal: createFounderPrincipal(session.founderId), domain: 'enterprise', action: 'read' });
  try {
    const record = await store().loadEnterpriseContext(session.founderId);
    const projects = normalizeEnterpriseProjects(record?.context.projects ?? []);
    return NextResponse.json({ portfolio: buildProjectPortfolio(projects), revision: record?.revision ?? 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Projects unavailable.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireAuthorization({ principal: createFounderPrincipal(session.founderId), domain: 'enterprise', action: 'write' });
  try {
    const body = await request.json() as { projects?: FounderProject[]; expectedRevision?: number };
    if (!body.projects || typeof body.expectedRevision !== 'number') {
      return NextResponse.json({ error: 'Projects and expectedRevision are required.' }, { status: 400 });
    }
    const validation = validateProjects(body.projects);
    if (!validation.valid) return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 });
    const current = await store().loadEnterpriseContext(session.founderId);
    const context = createEnterpriseContext({
      priorities: current?.context.priorities ?? [],
      commitments: current?.context.commitments ?? [],
      projects: body.projects,
    });
    const saved = await store().saveEnterpriseContext(session.founderId, context, body.expectedRevision);
    return NextResponse.json({ portfolio: buildProjectPortfolio(body.projects), revision: saved.revision });
  } catch (error) {
    if (error instanceof MemoryConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Projects unavailable.' }, { status: 503 });
  }
}
