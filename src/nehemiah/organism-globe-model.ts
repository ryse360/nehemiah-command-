// Pure, render-agnostic model for the network globe's node classification.
//
// Extracted out of the engine (which pulls in R3F/three and can't be unit
// tested in node) so the size-class logic — the pixel bucket, the colour role,
// and the priority — is testable and, critically, driven by ONE comparator.
// An earlier split had the bucket use `< max` while colour/priority used
// `> 0.75`, so a node at exactly size 0.75 landed in the hub bucket but got
// mid colour + mid priority. GLOBE_HUB / GLOBE_MID are now the single source.

export const GLOBE_HUB = 0.75;
export const GLOBE_MID = 0.4;

export interface GlobeBucket {
  min: number;
  max: number;
  /** target sprite size in pixels */
  px: number;
}

// Ordered fine → hub. `min` inclusive, `max` exclusive; the last bucket's
// max is Infinity so every size in [0, ∞) lands in exactly one bucket.
export const GLOBE_BUCKETS: readonly GlobeBucket[] = [
  { min: 0, max: GLOBE_MID, px: 7 },
  { min: GLOBE_MID, max: GLOBE_HUB, px: 12 },
  { min: GLOBE_HUB, max: Infinity, px: 19 },
] as const;

export function globeBucketIndex(size: number): number {
  return GLOBE_BUCKETS.findIndex((b) => size >= b.min && size < b.max);
}

export type GlobeColorRole = 'gold-fine' | 'gold-mid' | 'gold-hot' | 'lavender';

export function globeColorRole(node: {
  size: number;
  family: 'gold' | 'lavender';
}): GlobeColorRole {
  if (node.family === 'lavender') return 'lavender';
  if (node.size >= GLOBE_HUB) return 'gold-hot';
  if (node.size >= GLOBE_MID) return 'gold-mid';
  return 'gold-fine';
}

export function globeNodePriority(size: number): number {
  return size >= GLOBE_HUB ? 1 : size >= GLOBE_MID ? 0.35 : 0;
}

/** Deterministic per-node twinkle phase from position — no RNG, always [0,1). */
export function globeTwinklePhase(position: readonly [number, number, number]): number {
  return (Math.sin(position[0] * 91.7 + position[1] * 47.3) + 1) / 2;
}
