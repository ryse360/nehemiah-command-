// Speech-only pronunciation transforms.
//
// The roster contains names a TTS engine may mispronounce. This layer rewrites
// SPOKEN output only. It MUST NOT alter displayed text, authoritative records,
// or citations — it is applied to the utterance text on its way to synthesis,
// never to anything the Founder reads or that is persisted.
//
// PURE. Governed by Anakin (experience) with Miller (clarity).

export interface PronunciationEntry {
  /** The token as written in records/roster. */
  written: string;
  /** How it should be voiced. */
  spoken: string;
}

// Whole-word, case-insensitive replacements. Keep this list small and reviewed;
// it is a governance artifact, not an open dumping ground.
export const PRONUNCIATION_DICTIONARY: readonly PronunciationEntry[] = [
  { written: 'MiP', spoken: 'M I P' },
  { written: 'Nehemiah', spoken: 'Neh-uh-MY-uh' },
  { written: 'Anakin', spoken: 'AN-uh-kin' },
  { written: 'Mercado', spoken: 'mer-KAH-doh' },
  { written: 'Fei-Fei', spoken: 'Fay Fay' },
  { written: 'Voss', spoken: 'Voss' },
  { written: 'Jony', spoken: 'JOH-nee' },
  { written: 'Sun Tzu', spoken: 'Sun Zoo' },
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply the dictionary to a SPOKEN string. Longer written forms are applied
 * first so multi-word entries (e.g. "Sun Tzu") win over any single-word overlap.
 * Returns a new string; the caller's display text is untouched.
 */
export function applyPronunciation(
  spokenText: string,
  dictionary: readonly PronunciationEntry[] = PRONUNCIATION_DICTIONARY,
): string {
  const ordered = [...dictionary].sort((a, b) => b.written.length - a.written.length);
  let result = spokenText;
  for (const { written, spoken } of ordered) {
    // \b won't hug a hyphen the way we need for "Fei-Fei", so guard with
    // non-word-ish lookarounds that still treat hyphens inside a term as part
    // of the term.
    const pattern = new RegExp(`(?<![\\w-])${escapeRegExp(written)}(?![\\w-])`, 'gi');
    result = result.replace(pattern, spoken);
  }
  return result;
}
