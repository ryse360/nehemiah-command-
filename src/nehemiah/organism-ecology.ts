// The intelligence ecology — the approved primary structure.
//
// This REPLACES the geodesic network globe. That model placed nodes evenly on
// the sphere's shell (Fibonacci) and joined nearest neighbours, which
// mathematically guarantees uniform tessellation, repeated polygons, geodesic
// wrapping, and equally-prominent nodes — the exact failure modes the Founder
// rejected. No shader tuning can fix a generator whose output is uniform by
// construction.
//
// What this builds instead: a VOLUMETRIC, CLUSTERED ecology.
//   - Attractors (clusters) sit at varying depth with varying weight, so
//     density is organised: dense regions, quiet regions, preserved negative
//     space.
//   - Nodes fill the VOLUME around their attractor (not a shell), so depth is
//     real and most micro-structure is naturally obscured or depth-faded.
//   - Brightness follows a power law: a few luminous, most faint. Nodes are
//     deliberately NOT equally prominent.
//   - Micro-links exist only WITHIN a cluster and only between near
//     neighbours, capped and weak, so they read as implied tissue rather than
//     an exposed wireframe.
//   - A few macro circulation paths sweep THROUGH the volume — the readable
//     flow. Supporting filaments inherit that flow without becoming ribbons.
//   - Bridges connect only SELECTED attractor pairs, never all of them.
//
// Pure and deterministic (seeded PRNG, no Math.random), so it is unit-testable
// in node and identical on every render.

export type Vec3 = readonly [number, number, number];

export type EcologyFamily = 'gold' | 'lavender';

export interface EcologyCluster {
  center: Vec3;
  /** volumetric extent of the attractor */
  radius: number;
  /** 0..1 prominence — drives how much of the population it claims */
  weight: number;
  family: EcologyFamily;
  /** a dormant cluster is unlit until `surfacing` awakens it */
  dormant: boolean;
}

export interface EcologyNode {
  position: Vec3;
  cluster: number;
  /** normalised depth, -1 (rear) .. 1 (front) */
  depth: number;
  /** 0..1, power-law distributed — a few bright, most faint */
  brightness: number;
  /** relative sprite size class 0..1 */
  size: number;
  family: EcologyFamily;
  /** deterministic 0..1 phase so twinkle never needs RNG at render time */
  phase: number;
}

/** A weak, intra-cluster connection. Never spans the whole shell. */
export interface EcologyLink {
  a: number;
  b: number;
  /** 0..1 — deliberately low; these are implied, not drawn as structure */
  strength: number;
}

/** A readable macro circulation path sweeping through the volume. */
export interface EcologyPath {
  points: Vec3[];
  weight: number;
  family: EcologyFamily;
}

export interface EcologyOptions {
  seed: number;
  nodeCount: number;
  clusterCount: number;
  /** overall containment radius of the ecology */
  extent: number;
  /** how many macro circulation paths stay readable */
  pathCount: number;
  /** samples per macro path */
  pathResolution: number;
  /** max intra-cluster links per node */
  maxLinksPerNode: number;
  /** how many selected attractor pairs are bridged */
  bridgeCount: number;
}

export const ECOLOGY_OPTIONS: EcologyOptions = {
  seed: 20260729,
  nodeCount: 620,
  clusterCount: 7,
  extent: 1.02,
  pathCount: 4,
  pathResolution: 96,
  maxLinksPerNode: 2,
  bridgeCount: 3,
};

export interface EcologyResult {
  clusters: EcologyCluster[];
  nodes: EcologyNode[];
  links: EcologyLink[];
  paths: EcologyPath[];
  bridges: { a: number; b: number }[];
}

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

/** Box-Muller-ish centred sample in [-1,1], denser toward 0 → volumetric falloff. */
function centredSample(rng: () => number): number {
  return (rng() + rng() + rng() - 1.5) / 1.5;
}

function len(p: Vec3): number {
  return Math.hypot(p[0], p[1], p[2]);
}

/**
 * Attractor layout. Deliberately ASYMMETRIC and uneven: weights vary widely,
 * one cluster is dormant (so `surfacing` has something real to awaken), and the
 * lavender reasoning attractors sit to one side, matching the approved
 * reference's warm-left / cool-right composition. Quiet space is what is left
 * where no attractor reaches.
 */
function buildClusters(rng: () => number, options: EcologyOptions): EcologyCluster[] {
  // Hand-placed anchors keep the composition intentional rather than random;
  // the jitter below keeps it from looking mechanical.
  const anchors: Array<{ c: Vec3; r: number; w: number; f: EcologyFamily; d?: boolean }> = [
    // dominant warm cognition core, slightly left and forward
    { c: [-0.20, 0.05, 0.24], r: 0.42, w: 1.0, f: 'gold' },
    // secondary warm mass, lower left, receding
    { c: [-0.42, -0.26, -0.20], r: 0.34, w: 0.62, f: 'gold' },
    // upper warm satellite, small and bright
    { c: [-0.05, 0.44, -0.05], r: 0.24, w: 0.40, f: 'gold' },
    // the cool reasoning volume, right side
    { c: [0.40, 0.06, 0.05], r: 0.36, w: 0.72, f: 'lavender' },
    // deep cool satellite, rear right
    { c: [0.30, -0.30, -0.34], r: 0.26, w: 0.34, f: 'lavender' },
    // sparse connective drift, front centre — keeps the middle from emptying
    { c: [0.06, -0.10, 0.40], r: 0.30, w: 0.28, f: 'gold' },
    // DORMANT cluster: unlit until surfacing wakes it
    { c: [-0.34, 0.30, -0.42], r: 0.26, w: 0.44, f: 'gold', d: true },
  ];

  // Spread: the ecology must FILL the membrane. A small mass inside a large
  // empty sphere reads as "an object in a ball", not as one organism.
  const S = 1.42;
  return anchors.slice(0, options.clusterCount).map((a) => ({
    center: [
      a.c[0] * S + (rng() - 0.5) * 0.04,
      a.c[1] * S + (rng() - 0.5) * 0.04,
      a.c[2] * S + (rng() - 0.5) * 0.04,
    ] as Vec3,
    radius: a.r * 1.18,
    weight: a.w,
    family: a.f,
    dormant: a.d === true,
  }));
}

/** Weighted attractor choice — this is what creates organised density. */
function pickCluster(rng: () => number, clusters: EcologyCluster[]): number {
  const total = clusters.reduce((s, c) => s + c.weight, 0);
  let r = rng() * total;
  for (let i = 0; i < clusters.length; i += 1) {
    r -= clusters[i].weight;
    if (r <= 0) return i;
  }
  return clusters.length - 1;
}

/**
 * Build the ecology. Deterministic for a given options.seed.
 */
export function organismEcology(options: EcologyOptions = ECOLOGY_OPTIONS): EcologyResult {
  const rng = mulberry32(options.seed);
  const clusters = buildClusters(rng, options);

  // --- nodes: fill each attractor's VOLUME, not a shell --------------------
  const nodes: EcologyNode[] = [];
  for (let i = 0; i < options.nodeCount; i += 1) {
    const ci = pickCluster(rng, clusters);
    const cluster = clusters[ci];

    // centred samples cluster density toward the attractor core and thin it
    // outward, so regions blend into quiet space instead of ending at an edge.
    let position: Vec3 = [
      cluster.center[0] + centredSample(rng) * cluster.radius,
      cluster.center[1] + centredSample(rng) * cluster.radius,
      cluster.center[2] + centredSample(rng) * cluster.radius,
    ];

    // Contain the ecology with SMOOTH compression, never a hard clamp. A clamp
    // piles every outlying node at exactly `extent`, which rebuilds the shell
    // wrapping this model exists to avoid. tanh approaches the boundary
    // asymptotically and leaves inner nodes (where tanh(x)≈x) untouched.
    const l = len(position) || 1e-6;
    const k = (options.extent * Math.tanh(l / options.extent)) / l;
    position = [position[0] * k, position[1] * k, position[2] * k];

    // power law → a few luminous, most faint. NOT equally prominent. The
    // exponent is steep on purpose: it is what produces chiaroscuro instead of
    // an evenly-lit field of dots.
    const u = rng();
    const brightness = Math.pow(u, 3.4);
    // size tracks brightness but is quantised softly so hubs read as hubs
    const size = Math.min(1, Math.pow(u, 2.6) * 1.15);

    nodes.push({
      position,
      cluster: ci,
      depth: Math.max(-1, Math.min(1, position[2] / options.extent)),
      brightness,
      size,
      family: cluster.family,
      phase: rng(),
    });
  }

  // --- micro links: intra-cluster only, near neighbours only, capped -------
  const links: EcologyLink[] = [];
  const linkCount = new Array<number>(nodes.length).fill(0);
  const byCluster = new Map<number, number[]>();
  nodes.forEach((n, i) => {
    const list = byCluster.get(n.cluster);
    if (list) list.push(i);
    else byCluster.set(n.cluster, [i]);
  });

  for (const [, members] of byCluster) {
    for (let x = 0; x < members.length; x += 1) {
      const i = members[x];
      if (linkCount[i] >= options.maxLinksPerNode) continue;
      // nearest few within the same attractor
      let best = -1;
      let bestD = Infinity;
      for (let y = 0; y < members.length; y += 1) {
        const j = members[y];
        if (i === j || linkCount[j] >= options.maxLinksPerNode) continue;
        const a = nodes[i].position;
        const b = nodes[j].position;
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      // only genuinely close pairs link, so the tissue stays sparse and local
      if (best >= 0 && bestD < 0.14) {
        links.push({
          a: i,
          b: best,
          // weak, and weaker still as it recedes — implied, never structural
          strength: Math.max(0.08, 0.34 * (1 - bestD / 0.14)),
        });
        linkCount[i] += 1;
        linkCount[best] += 1;
      }
    }
  }

  // --- macro circulation: a few readable sweeping paths --------------------
  // Each path arcs through the volume between attractors, bowed off-axis so it
  // reads as circulation rather than a straight spoke (no radial sunburst).
  const paths: EcologyPath[] = [];
  const routes: Array<[number, number, EcologyFamily]> = [
    [0, 3, 'gold'],
    [1, 0, 'gold'],
    [2, 4, 'lavender'],
    [5, 1, 'gold'],
  ];
  for (let p = 0; p < Math.min(options.pathCount, routes.length); p += 1) {
    const [ai, bi, family] = routes[p];
    const a = clusters[ai % clusters.length].center;
    const b = clusters[bi % clusters.length].center;
    // control point pushed perpendicular-ish so the path bows
    const mid: Vec3 = [
      (a[0] + b[0]) / 2 + (rng() - 0.5) * 0.9,
      (a[1] + b[1]) / 2 + (rng() - 0.5) * 0.9,
      (a[2] + b[2]) / 2 + (rng() - 0.5) * 0.7,
    ];
    const points: Vec3[] = [];
    for (let s = 0; s < options.pathResolution; s += 1) {
      const t = s / (options.pathResolution - 1);
      const it = 1 - t;
      // quadratic bezier → smooth, no polygonal kinks
      points.push([
        it * it * a[0] + 2 * it * t * mid[0] + t * t * b[0],
        it * it * a[1] + 2 * it * t * mid[1] + t * t * b[1],
        it * it * a[2] + 2 * it * t * mid[2] + t * t * b[2],
      ]);
    }
    paths.push({ points, weight: 0.55 + rng() * 0.45, family });
  }

  // --- bridges: SELECTED attractor pairs only ------------------------------
  const bridgePairs: Array<{ a: number; b: number }> = [
    { a: 0, b: 1 },
    { a: 0, b: 3 },
    { a: 3, b: 4 },
  ];
  const bridges = bridgePairs
    .slice(0, options.bridgeCount)
    .filter((p) => p.a < clusters.length && p.b < clusters.length);

  return { clusters, nodes, links, paths, bridges };
}

// --- per-state reorganisation ----------------------------------------------
// The SAME ecology reorganises; it is never rebuilt. Each state changes how
// influence is distributed across the existing attractors.

export type EcologyState = 'breathing' | 'attending' | 'surfacing' | 'weighing';

export interface EcologyModulation {
  /** per-cluster multiplier on prominence, index-aligned with clusters */
  clusterGain: number[];
  /** 0..1 — how far nodes migrate toward their attractor centre */
  concentration: number;
  /** 0..1 — visibility of the macro circulation paths */
  flow: number;
  /** 0..1 — membrane tension / spacing regulation */
  tension: number;
}

/**
 * How each state reorganises the ecology.
 *   attending  — concentrates and orients toward the dominant attractor
 *   surfacing  — awakens the dormant cluster and propagates outward
 *   weighing   — redistributes influence between two competing attractors
 *   breathing  — regulates spacing, flow and tension; nothing dominates
 */
export function ecologyModulation(
  state: EcologyState,
  clusters: readonly EcologyCluster[],
  /** 0..1 progress used by surfacing/weighing to animate the reorganisation */
  progress = 1,
): EcologyModulation {
  const gain = clusters.map(() => 1);

  switch (state) {
    case 'attending': {
      // influence concentrates on the primary cognition attractor; the rest
      // recede but never go dark.
      clusters.forEach((c, i) => {
        gain[i] = c.dormant ? 0.12 : i === 0 ? 1.45 : 0.7;
      });
      return { clusterGain: gain, concentration: 0.55, flow: 0.45, tension: 0.7 };
    }
    case 'surfacing': {
      // the dormant cluster wakes and propagates; neighbours brighten as the
      // retrieval spreads.
      clusters.forEach((c, i) => {
        if (c.dormant) gain[i] = 0.12 + 1.5 * progress;
        else gain[i] = 0.85 + 0.25 * progress * (i === 2 ? 1 : 0.4);
      });
      return { clusterGain: gain, concentration: 0.3, flow: 0.75, tension: 0.5 };
    }
    case 'weighing': {
      // two attractors compete: warm cognition vs cool reasoning. Influence
      // oscillates between them rather than settling.
      const swing = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
      clusters.forEach((c, i) => {
        if (c.dormant) gain[i] = 0.2;
        else if (i === 0) gain[i] = 0.75 + 0.7 * swing;
        else if (i === 3) gain[i] = 0.75 + 0.7 * (1 - swing);
        else gain[i] = 0.6;
      });
      return { clusterGain: gain, concentration: 0.42, flow: 0.6, tension: 0.85 };
    }
    case 'breathing':
    default: {
      clusters.forEach((c, i) => {
        gain[i] = c.dormant ? 0.1 : 0.9;
      });
      return { clusterGain: gain, concentration: 0.18, flow: 0.35, tension: 0.4 };
    }
  }
}

/** Map the lifecycle state name onto the ecology's four behaviours. */
export function ecologyStateFor(lifecycle: string): EcologyState {
  switch (lifecycle) {
    case 'listening':
      return 'attending';
    case 'focus-surfaced':
      return 'surfacing';
    case 'decision-required':
      return 'weighing';
    case 'action-underway':
      return 'surfacing';
    case 'proof-created':
      return 'attending';
    case 'resting':
    default:
      return 'breathing';
  }
}
