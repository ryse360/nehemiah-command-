import type { FounderAgenda } from './calendar-gmail-integration';

export async function loadFounderAgenda(): Promise<FounderAgenda> {
  const response = await fetch('/api/founder-agenda', { cache: 'no-store' });
  const body = await response.json() as FounderAgenda | { error?: string };
  if (!response.ok) throw new Error('error' in body && body.error ? body.error : 'Founder agenda unavailable.');
  return body as FounderAgenda;
}
