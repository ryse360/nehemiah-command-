import { NextRequest } from 'next/server';
import { normalizeCalendarSignal, type CalendarEventInput } from '@/nehemiah/calendar-gmail-integration';
import { ingestNormalizedSignal } from '@/nehemiah/integration-route-helpers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return ingestNormalizedSignal(request, 'google-calendar', (value) => normalizeCalendarSignal(value as CalendarEventInput));
}
