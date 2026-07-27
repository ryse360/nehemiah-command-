// Voice capability configuration — the one place NEXT_PUBLIC_VOICEBOX_* is read.
//
// Two distinct concerns:
//   - the CAPABILITY FLAG (deployment): whether voice is built/available at all
//   - the loopback ORIGIN: which local Voicebox the browser may call
//
// The loopback restriction is a genuine FAIL-CLOSED boundary (Leonidas): an
// arbitrary URL is refused in a production build. The Founder's per-session
// preference (autoSpeak, volume, quiet) is NOT here — that is runtime UI state,
// not deployment config.
//
// PURE. No DOM, no network.

import type { SpeechLocale, VoiceboxConfig } from './types.ts';

const DEFAULT_BASE_URL = 'http://127.0.0.1:17493';
const APPROVED_LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export const DEFAULT_LOCALE: SpeechLocale = 'en-US';

/** True only for an approved loopback origin. Anything else is refused. */
export function isApprovedLoopbackUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname;
  return APPROVED_LOOPBACK_HOSTS.has(host);
}

export interface ReadConfigInput {
  enabled?: string;
  baseUrl?: string;
  profileId?: string;
  profileVersion?: string;
  /** When true (production Founder build), an unapproved URL throws instead of falling back. */
  strict?: boolean;
}

/**
 * Resolve validated configuration. In strict (production) mode an unapproved
 * baseUrl is a fail-closed error; in dev it falls back to the default loopback
 * URL. Reading from `process.env` is the caller's job — this stays pure/testable.
 */
export function resolveVoiceConfig(input: ReadConfigInput = {}): VoiceboxConfig {
  const enabled = input.enabled === 'true';
  const requested = (input.baseUrl ?? '').trim() || DEFAULT_BASE_URL;

  let baseUrl = requested;
  if (!isApprovedLoopbackUrl(requested)) {
    if (input.strict) {
      throw new Error(
        `Refusing non-loopback Voicebox URL in production: ${requested}. ` +
          `Approved hosts: 127.0.0.1, localhost, [::1].`,
      );
    }
    baseUrl = DEFAULT_BASE_URL;
  }

  return {
    enabled,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    profileId: input.profileId?.trim() || undefined,
    profileVersion: input.profileVersion?.trim() || undefined,
  };
}
