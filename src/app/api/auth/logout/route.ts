import { NextResponse } from 'next/server';
import { FOUNDER_SESSION_COOKIE } from '@/nehemiah/founder-auth';

export async function POST() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(FOUNDER_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
