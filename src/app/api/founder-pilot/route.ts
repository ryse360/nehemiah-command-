import { NextResponse } from 'next/server';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { assessFounderPilot, validatePilotSession, type FounderPilotSession } from '@/nehemiah/founder-pilot';
import { PostgresFounderPilotStore } from '@/nehemiah/postgres-founder-pilot-store';

function store() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  return new PostgresFounderPilotStore(process.env.DATABASE_URL);
}

export async function GET() {
  const founder = await getFounderSession();
  if (!founder) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sessions = await store().list(founder.founderId);
    const founderApproved = process.env.NEHEMIAH_FOUNDER_RELEASE_APPROVED === 'true';
    return NextResponse.json({ sessions, assessment: assessFounderPilot(sessions, founderApproved) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pilot records unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const founder = await getFounderSession();
  if (!founder) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const session = await request.json() as FounderPilotSession;
    const validation = validatePilotSession(session);
    if (!validation.valid) return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 });
    return NextResponse.json({ session: await store().append(founder.founderId, session) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pilot record unavailable.' }, { status: 503 });
  }
}
