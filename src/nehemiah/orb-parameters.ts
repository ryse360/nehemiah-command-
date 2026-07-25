// Step 3 — pure map from the sanitized OrbStateDTO to the approved organism's
// render parameters. This is the ONLY thing that translates production state
// into visuals, and it is deliberately dull: it starts from the SAME
// resolveStateParameters() the lab uses (so the design is identical) and applies
// only small, bounded modulations from the DTO's derived numbers. The approved
// geometry, palette, and motion are untouched — Step 3 changes the orb's inputs
// and state transitions, not its design.

import type { OrganismParameters } from './organism-parameters';
import { resolveStateParameters } from './organism-parameters';
import type { OrbStateDTO } from './orb-state';

const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

// The base is a fixed 160-particle field. Memory weight nudges it within a
// tight band so a full memory reads a touch denser without becoming a
// starfield, and an empty memory reads a touch sparser without going bare.
const PARTICLE_BASE = 160;
const PARTICLE_MIN = 144;
const PARTICLE_MAX = 240;
const NODE_SATURATION = 220; // matches OrbState's MAX_SURFACED_NODES

/**
 * Derive render parameters from a sanitized DTO. Pure and deterministic; reads
 * only numeric/enum DTO fields (there are no others to read).
 */
export function orbParametersFromState(dto: OrbStateDTO): OrganismParameters {
  const base = resolveStateParameters(dto.operatingState);

  const nodeFraction = clamp(dto.nodeCount / NODE_SATURATION, 0, 1);
  const particleCount = Math.round(
    clamp(PARTICLE_BASE * (0.9 + 0.6 * nodeFraction), PARTICLE_MIN, PARTICLE_MAX),
  );

  // Energy lifts gold slightly around its state value; convergence and open
  // loops firm up the indigo reasoning field. All bounded near the approved
  // baseline so the silhouette the Founder approved never changes shape.
  const intensity = clamp(dto.intensity, 0, 1);
  const goldIntensity = clamp(base.goldIntensity * (0.9 + 0.25 * intensity), 0, 2);
  const indigoConvergence = clamp(
    Math.max(base.indigoConvergence, dto.convergence),
    0,
    1,
  );
  const indigoIntensity = clamp(
    base.indigoIntensity * (1 + 0.08 * dto.openLoops),
    0,
    1.5,
  );

  return {
    ...base,
    particleCount,
    goldIntensity,
    indigoConvergence,
    indigoIntensity,
  };
}
