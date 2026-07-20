import { NextResponse } from 'next/server';
import { createSessionToken, founderAuthConfigFromEnv, FOUNDER_SESSION_COOKIE, verifyFounderPassword } from '@/nehemiah/founder-auth';

export async function POST(request: Request) {
  const config = founderAuthConfigFromEnv();
  if (!config) return NextResponse.json({ error: 'Founder authentication is not configured.' }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { password?: string };
  if (!body.password || !verifyFounderPassword(body.password, config)) {
    return NextResponse.json({ error: 'The credentials could not be verified.' }, { status: 401 });
  }
  const response = NextResponse.json({ founderId: config.founderId });
  response.cookies.set(FOUNDER_SESSION_COOKIE, createSessionToken(config), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionTtlSeconds,
  });
  return response;
}
