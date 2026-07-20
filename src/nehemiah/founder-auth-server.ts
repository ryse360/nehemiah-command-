import { cookies } from 'next/headers';
import { founderAuthConfigFromEnv, FOUNDER_SESSION_COOKIE, verifySessionToken } from './founder-auth';
import { securityStoreFromEnv } from './security-store';

export async function getFounderSession() {
  const config = founderAuthConfigFromEnv();
  if (!config) return null;
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(FOUNDER_SESSION_COOKIE)?.value, config);
  if (!session) return null;
  try {
    if (await securityStoreFromEnv().isSessionRevoked(session.founderId, session.sessionId)) return null;
  } catch {
    if (process.env.NODE_ENV === 'production') return null;
  }
  return session;
}
