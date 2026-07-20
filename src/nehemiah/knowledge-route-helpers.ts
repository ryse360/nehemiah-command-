import { NextRequest, NextResponse } from 'next/server';
import { requireAuthorization } from './authorization';
import type { IntegrationSignalInput } from './data-boundaries';
import { authenticateIntegrationHeaders } from './request-principal';
import { consumeIntegrationAttempt, recordSecurityEvent, securityEventForRequest } from './security-runtime';
import { PostgresBoundedDataStore } from './postgres-bounded-data-store';
import type { KnowledgeRecord } from './drive-obsidian-knowledge';

export async function ingestKnowledge(
  request: NextRequest,
  expectedIntegrationId: 'google-drive' | 'obsidian',
  normalize: (value: unknown) => IntegrationSignalInput,
): Promise<NextResponse> {
  const integrationId = request.headers.get('x-nehemiah-integration-id') ?? '';
  const rate = await consumeIntegrationAttempt(request, integrationId);
  if (!rate.allowed) return NextResponse.json({ error: 'Integration rate limit exceeded.' }, { status: 429 });
  if (integrationId !== expectedIntegrationId) return NextResponse.json({ error: `Expected integration identity ${expectedIntegrationId}.` }, { status: 403 });
  const principal = authenticateIntegrationHeaders({ integrationId, integrationKey: request.headers.get('x-nehemiah-integration-key') });
  if (!principal) return NextResponse.json({ error: 'Unauthorized integration.' }, { status: 401 });
  requireAuthorization({ principal, domain: 'integration', action: 'append', integrationId });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  try {
    const signal = normalize(await request.json());
    const payload = signal.payload as KnowledgeRecord | undefined;
    if (!payload) throw new Error('Normalized knowledge payload is missing.');
    const founderId = process.env.NEHEMIAH_FOUNDER_ID ?? 'primary-founder';
    const record = await new PostgresBoundedDataStore(connectionString).upsertKnowledgeRecord(founderId, payload);
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'integration', actorId: integrationId, eventType: 'knowledge.source.synchronized', outcome: 'allowed',
      metadata: { sourceKind: record.sourceKind, externalId: record.id, visibility: record.visibility },
    }), founderId);
    return NextResponse.json(record, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Knowledge source rejected.' }, { status: 400 });
  }
}
