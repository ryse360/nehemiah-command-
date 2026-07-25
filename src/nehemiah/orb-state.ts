// Step 3 — the sanitized boundary between Founder data and the living orb.
//
// TWO boundaries, in strict order, so raw content is stripped BEFORE the
// salience math ever sees it:
//
//   Founder memory
//     → deriveMemorySignals()   ← the ONLY function that touches raw records
//     → OrbSignals              ← numbers + a generic enum; no content field
//     → computeOrbState()       ← salience math, sees ONLY OrbSignals
//     → OrbStateDTO             ← derived values only
//     → the approved organism
//
// computeOrbState() is TYPED to accept only OrbSignals. It is a compile error
// to hand it a FounderMemory record, a title, a note, a name, or an id — the
// types make the leak impossible, not merely discouraged. deriveMemorySignals()
// reads timestamps to compute ages and reads nothing else off a record.
//
// If you are ever tempted to add a string field to OrbSignals or OrbStateDTO to
// "label" a node, stop — that is exactly the leak these boundaries prevent.

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

/**
 * The content-free intermediate. EVERY field is a number, a number array, or a
 * closed enum. There is deliberately no string field beyond the generic
 * operating-state enum — no title, note, name, id, tag, or project can be
 * represented here, so nothing content-bearing can be carried past this type.
 */
export interface OrbSignals {
  /** Generic lifecycle enum — UI state, not memory content. */
  operatingState: NehemiahState;
  /**
   * Relative age in ms of each decision's most-recent marker. Numbers only.
   * An undated decision is represented as +Infinity (treated as oldest).
   */
  decisionAgesMs: readonly number[];
}

function ageMsOf(record: { decidedAt?: string; proofRecordedAt?: string }, nowMs: number): number {
  // The ONLY place a raw record is read. Only its timestamps are touched, and
  // only to produce a numeric age; the age is the only thing that leaves. An
  // undated record becomes +Infinity so it sorts as oldest and never affects
  // recency.
  const stamps = [record.decidedAt, record.proofRecordedAt]
    .map((iso) => (iso ? Date.parse(iso) : NaN))
    .filter((ms) => Number.isFinite(ms)) as number[];
  if (!stamps.length) return Number.POSITIVE_INFINITY;
  const newest = Math.max(...stamps);
  return Math.max(0, nowMs - newest);
}

/**
 * BOUNDARY: raw Founder memory → content-free OrbSignals. This is the single
 * function permitted to read Founder records, and it reads only timestamps.
 * Nothing content-bearing is copied into its output. Deterministic given
 * (memory, operatingState, nowMs).
 */
export function deriveMemorySignals(
  memory: FounderMemory,
  operatingState: NehemiahState,
  nowMs: number,
): OrbSignals {
  const decisionAgesMs = (memory.decisions ?? []).map((record) => ageMsOf(record, nowMs));
  return { operatingState, decisionAgesMs };
}

/**
 * Salience math. Sees ONLY OrbSignals — never a Founder record. Deterministic
 * and pure; server-capable (no DOM/React). This is where node counts, priority
 * bands, recency, intensity, and convergence are calculated.
 */
export function computeOrbState(signals: OrbSignals): OrbStateDTO {
  const { operatingState, decisionAgesMs } = signals;
  const bands: Record<OrbPriorityBand, number> = { high: 0, medium: 0, low: 0 };
  let newestAge = Number.POSITIVE_INFINITY;

  for (const age of decisionAgesMs) {
    if (!Number.isFinite(age)) {
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

  const count = decisionAgesMs.length;
  return {
    operatingState,
    nodeCount: Math.min(count, MAX_SURFACED_NODES),
    bands,
    recencyWeight,
    intensity,
    convergence: STATE_CONVERGENCE[operatingState],
    openLoops: OPEN_LOOP_STATES.has(operatingState) ? 1 : 0,
    settled: count,
  };
}

/**
 * Convenience for callers that hold raw memory — the client today, a server
 * once memory is server-authoritative. Runs the full two-boundary pipeline.
 */
export function orbStateFromMemory(
  memory: FounderMemory,
  operatingState: NehemiahState,
  nowMs: number,
): OrbStateDTO {
  return computeOrbState(deriveMemorySignals(memory, operatingState, nowMs));
}

/**
 * A calm resting DTO for first paint before any memory has loaded. Defined in
 * terms of computeOrbState over empty signals so it can never drift from the
 * real derivation.
 */
export function restingOrbState(): OrbStateDTO {
  return computeOrbState({ operatingState: 'resting', decisionAgesMs: [] });
}
