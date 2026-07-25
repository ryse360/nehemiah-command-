// Memory-write threshold — the salience gate. Not everything a Founder says or
// an agent produces deserves to become a durable memory: memorializing chatter
// bloats the store, poisons retrieval, and pays embedding + write costs for
// noise. This scores a candidate and decides whether it clears the bar.
//
// SERVER-ONLY. Pure scoring — no I/O, no clock, no secrets.

export type MemoryKind =
  | 'decision' // a choice of record — highest value
  | 'preference' // a durable "I always/never…" signal
  | 'fact' // a stable fact about the Founder or business
  | 'task' // an actionable item
  | 'chatter' // conversational filler
  | 'transient'; // ephemeral status, greetings, acks

export interface MemoryCandidate {
  text: string;
  kind: MemoryKind;
  /** Explicit 0..1 importance override from the caller, if any. */
  importance?: number;
  source?: string;
}

export interface SalienceConfig {
  /** Below this character count a memory is treated as trivially thin. */
  minChars: number;
  /** importance ≥ this always writes, regardless of kind or length. */
  importanceFloor: number;
  /** score ≥ this is salient. */
  threshold: number;
}

export const DEFAULT_SALIENCE: SalienceConfig = {
  minChars: 24,
  importanceFloor: 0.8,
  threshold: 0.5,
};

// Base worth per kind. Decisions and preferences are the memories worth
// keeping for years; chatter and transient acks almost never are.
const KIND_BASE: Record<MemoryKind, number> = {
  decision: 0.9,
  preference: 0.82,
  fact: 0.62,
  task: 0.6,
  chatter: 0.15,
  transient: 0.05,
};

export interface SalienceDecision {
  salient: boolean;
  score: number;
  reason: string;
}

export function scoreSalience(
  candidate: MemoryCandidate,
  config: SalienceConfig = DEFAULT_SALIENCE,
): SalienceDecision {
  const chars = candidate.text.trim().length;
  const importance = candidate.importance ?? 0;

  // Explicit importance is an override in BOTH directions of the bar: a caller
  // that marks something critical gets it written even if short.
  if (importance >= config.importanceFloor) {
    return {
      salient: true,
      score: Math.max(importance, KIND_BASE[candidate.kind]),
      reason: `importance ${importance.toFixed(2)} ≥ floor ${config.importanceFloor}`,
    };
  }

  if (chars < config.minChars) {
    return {
      salient: false,
      score: 0,
      reason: `too thin (${chars} < ${config.minChars} chars)`,
    };
  }

  // Length factor: a candidate that already cleared the minChars gate is a
  // real sentence, so it starts near full worth (0.85) and saturates — this
  // is a substance nudge, not a second length bar. An earlier 0.6 floor let a
  // valid one-line fact ("churn dropped to 2.1%") score just under threshold.
  const lengthFactor = Math.min(1, 0.85 + chars / 800);
  const score = Math.min(1, KIND_BASE[candidate.kind] * lengthFactor + importance * 0.3);
  const salient = score >= config.threshold;
  return {
    salient,
    score,
    reason: `${candidate.kind} score ${score.toFixed(2)} vs threshold ${config.threshold}`,
  };
}
