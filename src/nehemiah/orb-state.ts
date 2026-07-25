// Step 3 — the sanitized boundary between Founder data and the living orb.
//
// The server (not the browser) calculates salience: computeOrbState() reads the
// raw Founder memory and emits an OrbStateDTO of PURELY DERIVED values — counts,
// priority bands, recency weights, intensities, and the operating state. No
// titles, notes, commands, proofs, lessons, names, identifiers, timestamps, or
// any other Founder content is copied into the DTO. The DTO type itself is the
// boundary: it has no field that can carry Founder text, so raw data cannot
// cross into the client that renders the orb.
//
// If you are ever tempted to add a string field here to "label" a node, stop —
// that is exactly the leak this boundary exists to prevent.

import type { NehemiahState } from './state-machine';
import type { FounderMemory } from './founder-memory';

/** A derived priority band. Never a label — just how salient, in three steps. */
export type OrbPriorityBand = 'high' | 'medium' | 'low';

/**
 * Everything the orb is allowed to know. Every field is a number or a closed
 * enum. There is deliberately no free-form string field.
 */
export interface OrbStateDTO {
  /** Closed lifecycle enum; drives the approved base geometry. */
  operatingState: NehemiahState;
  /** How many memory nodes to surface (already clamped; not a raw count). */
  nodeCount: number;
  /** Count of salient nodes per derived priority band. */
  bands: Record<OrbPriorityBand, number>;
  /** 0..1 — how recent the most salient activity is (1 = just now). */
  recencyWeight: number;
  /** 0..1 — overall gold/energy the orb should read at. */
  intensity: number;
  /** 0..1 — how gathered the indigo reasoning field is. */
  convergence: number;
  /** Count of decisions still in flight (derived from the operating state). */
  openLoops: number;
  /** Count of settled decisions in memory. */
  settled: number;
}

// Node surfacing is capped so a large memory does not turn into a starfield;
// the orb reads weight, not literal inventory.
const MAX_SURFACED_NODES = 220;
// Recency decays over two weeks: a decision from today reads bright, one from a
// fortnight ago reads spent. Half-life ≈ 4.85 days.
const RECENCY_TAU_MS = 14 * 24 * 60 * 60 * 1000;
const HIGH_BAND_MS = 3 * 24 * 60 * 60 * 1000; // < 3 days = high salience
const MEDIUM_BAND_MS = 14 * 24 * 60 * 60 * 1000; // < 14 days = medium

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

// How gathered the reasoning field reads at each lifecycle state. Mirrors the
// lab's state accents so the dashboard orb and the lab orb share one design.
const STATE_CONVERGENCE: Record<NehemiahState, number> = {
  resting: 0,
  listening: 0.15,
  'focus-surfaced': 0.45,
  'decision-required': 1,
  'action-underway': 0.25,
  'proof-created': 0.05,
};

// Baseline energy per state before memory recency lifts it.
const STATE_INTENSITY: Record<NehemiahState, number> = {
  resting: 0.3,
  listening: 0.42,
  'focus-surfaced': 0.55,
  'decision-required': 0.7,
  'action-underway': 0.8,
  'proof-created': 0.95,
};

// A decision is "in flight" only while the operating state is mid-journey; a
// count derived from the enum, never from decision content.
const OPEN_LOOP_STATES: ReadonlySet<NehemiahState> = new Set([
  'listening',
  'focus-surfaced',
  'decision-required',
]);

function ageMsOf(record: { decidedAt?: string; proofRecordedAt?: string }, nowMs: number): number | null {
  // Only timestamps are read, and only to derive age — they never leave this
  // function. The most recent of the two markers governs recency.
  const stamps = [record.decidedAt, record.proofRecordedAt]
    .map((iso) => (iso ? Date.parse(iso) : NaN))
    .filter((ms) => Number.isFinite(ms)) as number[];
  if (!stamps.length) return null;
  const newest = Math.max(...stamps);
  return Math.max(0, nowMs - newest);
}

/**
 * SERVER-SIDE salience. Reads raw Founder memory, returns only derived numbers.
 * Deterministic given (memory, operatingState, nowMs) — nowMs is explicit so
 * recency is testable and the function stays pure.
 */
export function computeOrbState(
  memory: FounderMemory,
  operatingState: NehemiahState,
  nowMs: number,
): OrbStateDTO {
  const decisions = memory.decisions ?? [];
  const bands: Record<OrbPriorityBand, number> = { high: 0, medium: 0, low: 0 };
  let newestAge = Number.POSITIVE_INFINITY;

  for (const record of decisions) {
    const age = ageMsOf(record, nowMs);
    if (age === null) {
      bands.low += 1;
      continue;
    }
    if (age < newestAge) newestAge = age;
    if (age < HIGH_BAND_MS) bands.high += 1;
    else if (age < MEDIUM_BAND_MS) bands.medium += 1;
    else bands.low += 1;
  }

  const recencyWeight = Number.isFinite(newestAge)
    ? clamp01(Math.exp(-newestAge / RECENCY_TAU_MS))
    : 0;

  // Energy: the state's baseline, lifted by how much recent salient memory the
  // Founder is carrying. Bounded so no memory can blow past the design range.
  const salientPressure = clamp01((bands.high * 2 + bands.medium) / 8);
  const intensity = clamp01(
    STATE_INTENSITY[operatingState] * 0.7 + salientPressure * 0.2 + recencyWeight * 0.1,
  );

  return {
    operatingState,
    nodeCount: Math.min(decisions.length, MAX_SURFACED_NODES),
    bands,
    recencyWeight,
    intensity,
    convergence: STATE_CONVERGENCE[operatingState],
    openLoops: OPEN_LOOP_STATES.has(operatingState) ? 1 : 0,
    settled: decisions.length,
  };
}

/**
 * A calm resting DTO for first paint before any memory has loaded. Defined in
 * terms of computeOrbState over an empty memory so it can never drift from the
 * real derivation. nowMs is irrelevant with no decisions (recency is 0).
 */
export function restingOrbState(): OrbStateDTO {
  return computeOrbState({ version: 2, decisions: [] }, 'resting', 0);
}
