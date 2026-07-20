import { NextResponse } from 'next/server';
import { createSessionToken, founderAuthConfigFromEnv, FOUNDER_SESSION_COOKIE, verifyFounderPassword } from '@/nehemiah/founder-auth';
import { consumeLoginAttempt, recordSecurityEvent, resetLoginAttempts, securityEventForRequest } from '@/nehemiah/security-runtime';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const config = founderAuthConfigFromEnv();
  if (!config) return NextResponse.json({ error: 'Founder authentication is not configured.' }, { status: 503 });

  const rate = consumeLoginAttempt(request);
  if (!rate.allowed) {
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'anonymous', actorId: 'unknown', eventType: 'auth.login.rate_limited', outcome: 'denied',
      metadata: { retryAfterMs: rate.retryAfterMs },
    }), config.founderId);
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) },
    });
  }

  const body = await request.json().catch(() => ({})) as { password?: string };
  if (!body.password || !verifyFounderPassword(body.password, config)) {
    await recordSecurityEvent(securityEventForRequest(request, {
      actorType: 'anonymous', actorId: 'unknown', eventType: 'auth.login.failed', outcome: 'denied',
      metadata: { reason: 'invalid_credentials' },
    }), config.founderId);
    return NextResponse.json({ error: 'The credentials could not be verified.' }, { status: 401 });
  }

  resetLoginAttempts(request);
  const token = createSessionToken(config);
  const response = NextResponse.json({ founderId: config.founderId });
  response.cookies.set(FOUNDER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionTtlSeconds,
  });
  await recordSecurityEvent(securityEventForRequest(request, {
    actorType: 'founder', actorId: config.founderId, eventType: 'auth.login.succeeded', outcome: 'allowed',
  }), config.founderId);
  return response;
}
