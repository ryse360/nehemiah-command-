import { NextRequest, NextResponse } from 'next/server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { PostgresBoundedDataStore } from '@/nehemiah/postgres-bounded-data-store';
import { searchKnowledge, type KnowledgeIndex } from '@/nehemiah/drive-obsidian-knowledge';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireAuthorization({ principal: createFounderPrincipal(session.founderId), domain: 'integration', action: 'read' });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  try {
    const records = await new PostgresBoundedDataStore(connectionString).listKnowledgeRecords(session.founderId, 300);
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    const index: KnowledgeIndex = { generatedAt: new Date().toISOString(), records };
    if (!query) return NextResponse.json(index);
    return NextResponse.json(searchKnowledge(index, query, { includeFounderPrivate: true, limit: 12 }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Founder knowledge unavailable.' }, { status: 503 });
  }
}
