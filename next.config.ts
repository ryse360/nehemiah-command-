import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV !== 'production';

const APPROVED_LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/**
 * The Founder's local Voicebox origin, or '' when voice is off / misconfigured.
 *
 * FAIL-CLOSED: only an approved loopback origin is ever admitted to the CSP.
 * A non-loopback URL is ignored rather than widening the policy, mirroring
 * resolveVoiceConfig() in src/platform/speech/config.ts.
 */
function voiceboxOrigin(): string {
  if (process.env.NEXT_PUBLIC_VOICEBOX_ENABLED !== 'true') return '';
  const raw = process.env.NEXT_PUBLIC_VOICEBOX_URL ?? 'http://127.0.0.1:17493';
  try {
    const url = new URL(raw);
    if (!APPROVED_LOOPBACK_HOSTS.has(url.hostname)) return '';
    return url.origin;
  } catch {
    return '';
  }
}

const voicebox = voiceboxOrigin();

// React's development tooling (Turbopack HMR, callstack reconstruction) needs
// eval(). Production never does, so the relaxation is strictly dev-only.
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : [])];

// Voice output calls the Founder's LOCAL Voicebox — a different origin — for
// generation, the SSE status stream, and the audio bytes. Without it here,
// every voice request is blocked by the browser before it leaves the page.
const connectSrc = ["'self'", ...(voicebox ? [voicebox] : [])];

// Synthesised speech is played from a client-created blob: URL.
const mediaSrc = ["'self'", 'blob:'];

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(' ')}`,
  `media-src ${mediaSrc.join(' ')}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
