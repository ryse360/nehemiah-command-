import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { founderAuthConfigFromEnv, FOUNDER_SESSION_COOKIE, verifySessionToken } from '@/nehemiah/founder-auth';
import { recordSecurityEvent, securityEventForRequest } from '@/nehemiah/security-runtime';
import { securityStoreFromEnv } from '@/nehemiah/security-store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const config = founderAuthConfigFromEnv();
  const cookieStore = await cookies();
  const session = config ? verifySessionToken(cookieStore.get(FOUNDER_SESSION_COOKIE)?.value, config) : null;
  if (session) {
    await securityStoreFromEnv().revokeSession(session.founderId, session.sessionId, new Date(session.expiresAt));
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'founder', actorId: session.founderId, eventType: 'auth.logout', outcome: 'allowed',
      metadata: { sessionId: session.sessionId },
    }), session.founderId);
  }
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(FOUNDER_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
