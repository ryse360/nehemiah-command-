import { NextResponse } from 'next/server';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { createFounderPrincipal, requireAuthorization } from '@/nehemiah/authorization';
import {
  AIOrchestrationError,
  aiProviderFromEnv,
  orchestrateDecisionPreparation,
  validateAIRequest,
} from '@/nehemiah/ai-orchestration';
import { recordSecurityEvent, securityEventForRequest } from '@/nehemiah/security-runtime';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    requireAuthorization({
      principal: createFounderPrincipal(session.founderId),
      domain: 'founder-private',
      action: 'read',
    });

    const input = validateAIRequest(await request.json());
    const result = await orchestrateDecisionPreparation(input, aiProviderFromEnv(), {
      maxAttempts: 2,
      timeoutMs: 30000,
    });

    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'founder',
      actorId: session.founderId,
      eventType: 'ai.decision_preparation.succeeded',
      outcome: 'allowed',
      metadata: {
        orchestrationId: result.audit.orchestrationId,
        model: result.audit.model,
        attempts: result.audit.attempts,
        policyVersion: result.audit.policyVersion,
        requestedTools: result.audit.requestedTools,
        toolsExecuted: result.audit.toolsExecuted,
      },
    }), session.founderId);

    return NextResponse.json(result);
  } catch (error) {
    const orchestrationError = error instanceof AIOrchestrationError ? error : null;
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'founder',
      actorId: session.founderId,
      eventType: 'ai.decision_preparation.failed',
      outcome: 'denied',
      metadata: { code: orchestrationError?.code ?? 'unknown' },
    }), session.founderId);

    if (orchestrationError?.code === 'invalid_request') {
      return NextResponse.json({ error: orchestrationError.message }, { status: 400 });
    }
    if (orchestrationError?.code === 'not_configured') {
      return NextResponse.json({ error: orchestrationError.message }, { status: 503 });
    }
    if (orchestrationError?.code === 'provider_timeout') {
      return NextResponse.json({ error: orchestrationError.message }, { status: 504 });
    }
    return NextResponse.json({ error: orchestrationError?.message ?? 'AI orchestration unavailable.' }, { status: 502 });
  }
}
