import { NextRequest, NextResponse } from 'next/server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { aiProviderFromEnv, type AIModelProvider } from '@/nehemiah/ai-orchestration';
import { converseWithFounder } from '@/nehemiah/founder-conversation';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  requireAuthorization({
    principal: createFounderPrincipal(session.founderId),
    domain: 'founder-private',
    action: 'read',
  });

  let utterance = '';
  let decisionsInMemory = 0;
  let openJourney = false;
  try {
    const body = (await request.json()) as {
      utterance?: unknown;
      decisionsInMemory?: unknown;
      openJourney?: unknown;
    };
    utterance = typeof body.utterance === 'string' ? body.utterance : '';
    decisionsInMemory =
      typeof body.decisionsInMemory === 'number' && Number.isFinite(body.decisionsInMemory)
        ? Math.max(0, Math.floor(body.decisionsInMemory))
        : 0;
    openJourney = body.openJourney === true;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!utterance.trim()) {
    return NextResponse.json({ error: 'utterance is required.' }, { status: 400 });
  }

  // Provider is optional by design: without one the loop still closes via the
  // deterministic local reply. With one, every call passes the governed path
  // (per-call + durable daily ceilings, cache, telemetry).
  let provider: AIModelProvider | null = null;
  try {
    provider = aiProviderFromEnv();
  } catch {
    provider = null;
  }

  const result = await converseWithFounder(utterance, { decisionsInMemory, openJourney }, provider);
  return NextResponse.json(result);
}
