// Dedup BEFORE embed. Embedding is a paid call and a stored vector; embedding
// the same thing twice pays twice for a duplicate. This catches duplicates
// with FREE lexical signals (normalized exact match + shingled Jaccard) so a
// near-duplicate never reaches the embedding model at all.
//
// A real embedding-similarity check can be plugged in later for the harder
// semantic-paraphrase cases, but the cheap pre-filters here catch the common
// duplicates without spending anything.
//
// SERVER-ONLY. Pure functions + an in-memory index.

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word k-grams (shingles) of normalized text; k=2 suits short memory lines. */
export function shingles(text: string, k = 2): Set<string> {
  const words = normalize(text).split(' ').filter(Boolean);
  if (words.length < k) return new Set(words);
  const out = new Set<string>();
  for (let i = 0; i <= words.length - k; i += 1) {
    out.add(words.slice(i, i + k).join(' '));
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type DuplicateKind = 'exact' | 'near' | 'none';

export interface DedupResult {
  duplicate: boolean;
  kind: DuplicateKind;
  similarity: number;
  matchId?: string;
}

export interface DedupConfig {
  /** Jaccard ≥ this is a near-duplicate. */
  nearThreshold: number;
  shingleK: number;
}

export const DEFAULT_DEDUP: DedupConfig = { nearThreshold: 0.5, shingleK: 2 };

export class DedupIndex {
  private readonly byNorm = new Map<string, string>(); // normalized text -> id
  private readonly grams = new Map<string, Set<string>>(); // id -> shingles
  private readonly config: DedupConfig;

  constructor(config: DedupConfig = DEFAULT_DEDUP) {
    this.config = config;
  }

  check(text: string): DedupResult {
    const norm = normalize(text);
    const exactId = this.byNorm.get(norm);
    if (exactId) {
      return { duplicate: true, kind: 'exact', similarity: 1, matchId: exactId };
    }

    const g = shingles(text, this.config.shingleK);
    let best = 0;
    let bestId: string | undefined;
    for (const [id, other] of this.grams) {
      const sim = jaccard(g, other);
      if (sim > best) {
        best = sim;
        bestId = id;
      }
    }
    if (bestId && best >= this.config.nearThreshold) {
      return { duplicate: true, kind: 'near', similarity: best, matchId: bestId };
    }
    return { duplicate: false, kind: 'none', similarity: best, matchId: bestId };
  }

  add(id: string, text: string): void {
    this.byNorm.set(normalize(text), id);
    this.grams.set(id, shingles(text, this.config.shingleK));
  }

  get size(): number {
    return this.grams.size;
  }
}
