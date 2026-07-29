// Filament interiors — the directional structure that replaces glowing blobs.
//
// The ecology (organism-ecology.ts) stays the structural source of truth: it
// says WHERE intelligence gathers (attractors, density, quiet space). This
// module says how that intelligence MOVES through those regions.
//
// Technique: 3D curl noise, per the particle-system skill. Curl of a vector
// potential is divergence-free — no sources, no sinks — so integrated paths
// circulate and fold like fluid instead of radiating from a point. That
// property is exactly what prevents the sunburst/pinwheel read from returning:
// a divergence-free field cannot produce radial spokes.
//
// Three legibility tiers (only selected structure is fully readable):
//   principal  — a few long macro circulation paths, tapered, fully legible
//   supporting — filaments threading attractor regions, partly legible
//   micro      — short recessive strands, perceived through accumulated light
//
// Pure and deterministic (seeded PRNG, no Math.random), unit-testable in node.

import type { EcologyCluster, Vec3 } from './organism-ecology';

export type FilamentTier = 'principal' | 'supporting' | 'micro';

export interface Filament {
  points: Vec3[];
  tier: FilamentTier;
  /** 0..1 legibility — drives width and opacity */
  weight: number;
  family: 'gold' | 'lavender';
  /** attractor this filament threads (-1 if it spans the volume) */
  cluster: number;
  /** deterministic phase so motion never needs RNG at render time */
  phase: number;
  /** true when the filament approaches or crosses the membrane */
  breachesMembrane: boolean;
}

export interface FilamentFlowOptions {
  seed: number;
  principalCount: number;
  supportingPerCluster: number;
  microPerCluster: number;
  principalSteps: number;
  supportingSteps: number;
  microSteps: number;
  stepLength: number;
  /** curl-noise spatial frequency — lower is smoother, longer folds */
  noiseScale: number;
  /** how strongly attractors bend the flow toward themselves */
  attractorPull: number;
  membraneRadius: number;
}

export const FILAMENT_FLOW_OPTIONS: FilamentFlowOptions = {
  seed: 71324,
  principalCount: 5,
  supportingPerCluster: 4,
  microPerCluster: 7,
  principalSteps: 110,
  supportingSteps: 26,
  microSteps: 16,
  stepLength: 0.036,
  noiseScale: 1.35,
  attractorPull: 0.95,
  membraneRadius: 1.02,
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- deterministic value noise, 3D ------------------------------------------
function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const zf = smooth(z - zi);
  let n = 0;
  for (let dz = 0; dz <= 1; dz += 1) {
    for (let dy = 0; dy <= 1; dy += 1) {
      for (let dx = 0; dx <= 1; dx += 1) {
        const w =
          (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf);
        n += w * hash3(xi + dx, yi + dy, zi + dz);
      }
    }
  }
  return n * 2 - 1; // -1..1
}

/**
 * Curl of a 3D vector potential, by central differences. Divergence-free by
 * construction, so the resulting field has no sources or sinks — filaments
 * circulate rather than radiate.
 */
export function curlNoise3(p: Vec3, scale: number, offset = 0): Vec3 {
  const e = 1e-2;
  const s = scale;
  const P = (x: number, y: number, z: number, o: number): number =>
    valueNoise(x * s + o, y * s + o * 1.7, z * s + o * 0.3);

  const [x, y, z] = p;
  // three independent potential components
  const dP3dy = (P(x, y + e, z, offset + 31) - P(x, y - e, z, offset + 31)) / (2 * e);
  const dP2dz = (P(x, y, z + e, offset + 17) - P(x, y, z - e, offset + 17)) / (2 * e);
  const dP1dz = (P(x, y, z + e, offset) - P(x, y, z - e, offset)) / (2 * e);
  const dP3dx = (P(x + e, y, z, offset + 31) - P(x - e, y, z, offset + 31)) / (2 * e);
  const dP2dx = (P(x + e, y, z, offset + 17) - P(x - e, y, z, offset + 17)) / (2 * e);
  const dP1dy = (P(x, y + e, z, offset) - P(x, y - e, z, offset)) / (2 * e);

  const v: Vec3 = [dP3dy - dP2dz, dP1dz - dP3dx, dP2dx - dP1dy];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function nearestCluster(p: Vec3, clusters: readonly EcologyCluster[]): number {
  let best = 0;
  let bestD = Infinity;
  clusters.forEach((c, i) => {
    const d = Math.hypot(p[0] - c.center[0], p[1] - c.center[1], p[2] - c.center[2]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * Integrate one filament through the curl field, bent toward a target
 * attractor so filaments thread the ecology's regions rather than wandering
 * off. Paths are contained softly — a hard clamp would flatten them onto a
 * shell, the failure this whole model exists to avoid.
 */
function traceFilament(
  start: Vec3,
  steps: number,
  options: FilamentFlowOptions,
  clusters: readonly EcologyCluster[],
  target: EcologyCluster | null,
  noiseOffset: number,
): { points: Vec3[]; breaches: boolean } {
  const points: Vec3[] = [];
  const limit0 = options.membraneRadius * 1.06;
  const r0 = Math.hypot(start[0], start[1], start[2]);
  // the seed point is contained too — an uncontained start can sit outside the
  // membrane before the first integration step ever runs
  let p: Vec3 =
    r0 > limit0
      ? [(start[0] / r0) * limit0 * 0.985, (start[1] / r0) * limit0 * 0.985, (start[2] / r0) * limit0 * 0.985]
      : start;
  let breaches = false;

  for (let i = 0; i < steps; i += 1) {
    points.push(p);
    const flow = curlNoise3(p, options.noiseScale, noiseOffset);

    let dx = flow[0];
    let dy = flow[1];
    let dz = flow[2];

    // bend toward the attractor so the filament circulates THROUGH the region
    if (target) {
      const tx = target.center[0] - p[0];
      const ty = target.center[1] - p[1];
      const tz = target.center[2] - p[2];
      const td = Math.hypot(tx, ty, tz) || 1;
      // pull is strongest when far, so the filament orbits rather than collapses
      const pull = options.attractorPull * Math.min(1, td / (target.radius * 2));
      dx += (tx / td) * pull;
      dy += (ty / td) * pull;
      dz += (tz / td) * pull;
    }

    const dl = Math.hypot(dx, dy, dz) || 1;
    let next: Vec3 = [
      p[0] + (dx / dl) * options.stepLength,
      p[1] + (dy / dl) * options.stepLength,
      p[2] + (dz / dl) * options.stepLength,
    ];

    // soft containment: filaments may approach and occasionally graze the
    // membrane, but are eased back rather than snapped to it.
    const r = Math.hypot(next[0], next[1], next[2]);
    const limit = options.membraneRadius * 1.06;
    if (r > options.membraneRadius * 0.97) breaches = true;
    if (r > limit) {
      const k = (limit / r) * 0.985;
      next = [next[0] * k, next[1] * k, next[2] * k];
    }
    p = next;
  }

  return { points, breaches };
}

export interface FilamentFlowResult {
  filaments: Filament[];
}

export function organismFilamentFlow(
  clusters: readonly EcologyCluster[],
  options: FilamentFlowOptions = FILAMENT_FLOW_OPTIONS,
): FilamentFlowResult {
  const rng = mulberry32(options.seed);
  const filaments: Filament[] = [];
  const lit = clusters.filter((c) => !c.dormant);

  // --- principal: a few long circulation paths, fully legible ---------------
  for (let i = 0; i < options.principalCount; i += 1) {
    // start near one attractor, aim at another → readable circulation between
    // regions rather than a loop that goes nowhere
    const from = lit[i % lit.length];
    const to = lit[(i + 2) % lit.length];
    const start: Vec3 = [
      from.center[0] + (rng() - 0.5) * from.radius,
      from.center[1] + (rng() - 0.5) * from.radius,
      from.center[2] + (rng() - 0.5) * from.radius,
    ];
    const { points, breaches } = traceFilament(
      start,
      options.principalSteps,
      options,
      clusters,
      to,
      i * 13.7,
    );
    filaments.push({
      points,
      tier: 'principal',
      weight: 0.78 + rng() * 0.22,
      family: from.family === 'lavender' || to.family === 'lavender' ? 'lavender' : 'gold',
      cluster: -1,
      phase: rng(),
      breachesMembrane: breaches,
    });
  }

  // --- supporting + micro: thread each attractor's own region ---------------
  clusters.forEach((cluster, ci) => {
    const supporting = cluster.dormant
      ? options.supportingPerCluster
      : options.supportingPerCluster;
    for (let i = 0; i < supporting; i += 1) {
      const start: Vec3 = [
        cluster.center[0] + (rng() - 0.5) * cluster.radius * 1.0,
        cluster.center[1] + (rng() - 0.5) * cluster.radius * 1.0,
        cluster.center[2] + (rng() - 0.5) * cluster.radius * 1.0,
      ];
      const { points, breaches } = traceFilament(
        start,
        options.supportingSteps,
        options,
        clusters,
        cluster,
        100 + ci * 7.3 + i * 2.1,
      );
      filaments.push({
        points,
        tier: 'supporting',
        weight: 0.34 + rng() * 0.26,
        family: cluster.family,
        cluster: ci,
        phase: rng(),
        breachesMembrane: breaches,
      });
    }

    for (let i = 0; i < options.microPerCluster; i += 1) {
      const start: Vec3 = [
        cluster.center[0] + (rng() - 0.5) * cluster.radius * 1.3,
        cluster.center[1] + (rng() - 0.5) * cluster.radius * 1.3,
        cluster.center[2] + (rng() - 0.5) * cluster.radius * 1.3,
      ];
      const { points, breaches } = traceFilament(
        start,
        options.microSteps,
        options,
        clusters,
        cluster,
        500 + ci * 11.9 + i * 3.7,
      );
      filaments.push({
        points,
        tier: 'micro',
        weight: 0.1 + rng() * 0.16,
        family: cluster.family,
        cluster: ci,
        phase: rng(),
        breachesMembrane: breaches,
      });
    }
  });

  return { filaments };
}
