import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { verifyPasswordHash } from './security-hardening';

export const FOUNDER_SESSION_COOKIE = 'nehemiah_founder_session';

export type FounderAuthConfig = {
  founderId: string;
  passwordHash: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  authVersion: number;
};

export type FounderSession = {
  founderId: string;
  issuedAt: string;
  expiresAt: string;
  sessionId: string;
  authVersion: number;
};

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function founderAuthConfigFromEnv(): FounderAuthConfig | null {
  const passwordHash = process.env.NEHEMIAH_FOUNDER_PASSWORD_HASH;
  const sessionSecret = process.env.NEHEMIAH_SESSION_SECRET;
  if (!passwordHash || !sessionSecret) return null;
  return {
    founderId: process.env.NEHEMIAH_FOUNDER_ID ?? 'primary-founder',
    passwordHash,
    sessionSecret,
    sessionTtlSeconds: Number(process.env.NEHEMIAH_SESSION_TTL_SECONDS ?? 60 * 60 * 12),
    authVersion: Number(process.env.NEHEMIAH_AUTH_VERSION ?? 1),
  };
}

export function verifyFounderPassword(candidate: string, config: FounderAuthConfig): boolean {
  return verifyPasswordHash(candidate, config.passwordHash);
}

export function createSessionToken(config: FounderAuthConfig, now = new Date(), sessionId: string = randomUUID()): string {
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + config.sessionTtlSeconds * 1000).toISOString();
  const payload = encode(JSON.stringify({ founderId: config.founderId, issuedAt, expiresAt, sessionId, authVersion: config.authVersion } satisfies FounderSession));
  return `${payload}.${sign(payload, config.sessionSecret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  config: FounderAuthConfig,
  now = new Date(),
): FounderSession | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  if (!safeEqual(signature, sign(payload, config.sessionSecret))) return null;
  try {
    const session = JSON.parse(decode(payload)) as FounderSession;
    if (session.founderId !== config.founderId) return null;
    if (!session.sessionId || session.authVersion !== config.authVersion) return null;
    if (Date.parse(session.expiresAt) <= now.getTime()) return null;
    return session;
  } catch {
    return null;
  }
}
