import { NextRequest } from 'next/server';
import { normalizeGmailSignal, type GmailMessageInput } from '@/nehemiah/calendar-gmail-integration';
import { ingestNormalizedSignal } from '@/nehemiah/integration-route-helpers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return ingestNormalizedSignal(request, 'gmail', (value) => normalizeGmailSignal(value as GmailMessageInput));
}
