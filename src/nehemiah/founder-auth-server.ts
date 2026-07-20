import { cookies } from 'next/headers';
import { founderAuthConfigFromEnv, FOUNDER_SESSION_COOKIE, verifySessionToken } from './founder-auth';

export async function getFounderSession() {
  const config = founderAuthConfigFromEnv();
  if (!config) return null;
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(FOUNDER_SESSION_COOKIE)?.value, config);
}
