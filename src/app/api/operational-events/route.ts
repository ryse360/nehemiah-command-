import { NextRequest, NextResponse } from 'next/server';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { appendOperationalEvent, createOperationalEvent, listOperationalEvents, summarizeOperationalEvents, type OperationalLevel } from '@/nehemiah/observability';

export async function GET(request: NextRequest) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const events = listOperationalEvents();
  return NextResponse.json({ events, summary: summarizeOperationalEvents(events) });
}

export async function POST(request: NextRequest) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { name?: string; level?: OperationalLevel; context?: Record<string, unknown> };
    if (!body.name || !body.level || !['info','warning','error','fatal'].includes(body.level)) {
      return NextResponse.json({ error: 'Invalid operational event.' }, { status: 400 });
    }
    const event = createOperationalEvent(body.name, body.level, body.context ?? {});
    appendOperationalEvent(event);
    return NextResponse.json({ event }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid operational event.' }, { status: 400 });
  }
}
