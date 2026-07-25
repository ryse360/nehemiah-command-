export type Vec3 = [number, number, number];

// Three density zones give the graph real logic instead of an even blanket:
// a dense warm cognition core, a cooler and slightly more ordered secondary
// reasoning pole, and a sparse atmospheric periphery.
export type FieldZone = 'core' | 'secondary' | 'peripheral';

export interface FieldNode {
  position: Vec3;
  family: 'gold' | 'lavender';
  zone: FieldZone;
  /** 0..1 — how connected this node is; drives brightness and edge odds. */
  centrality: number;
}

// A macro loop is one of the organism's few readable circulation paths — the
// anatomy the eye can actually follow. Every loop must be doing a job;
// decorative swirls are noise and do not belong here.
export type LoopJob = 'gathering' | 'circulating' | 'focusing' | 'releasing';

export interface MacroLoop {
  controlPoints: Vec3[];
  job: LoopJob;
  /** Larger loops read as the primary circulation; smaller ones support. */
  weight: number;
}

export interface FieldConnection {
  a: number;
  b: number;
}

// Visibility hierarchy. Complexity should be enormous while only a fraction
// is ever fully legible: a handful of hero strands the eye consciously
// follows, a supporting field that binds the organism, and a recessive mass
// that is sensed more than read.
export type FilamentClass = 'hero' | 'support' | 'recessive';

export interface MajorFilament {
  controlPoints: Vec3[];
  depth: 'rear' | 'middle' | 'front';
  family: 'gold' | 'lavender';
  brightness: number;
  reach: 'radial' | 'inner' | 'membrane' | 'orbital';
  filamentClass: FilamentClass;
}

export interface OrbitalArc {
  radius: number;
  tilt: Vec3;
  direction: 1 | -1;
  periodSeconds: number;
}

export interface NodalFlare {
  position: Vec3;
  family: 'gold' | 'lavender';
  scale: number;
  pulseSeconds: number;
  phase: number;
}

export interface MicroFilament {
  controlPoints: Vec3[];
  family: 'gold' | 'lavender';
  opacity: number;
}

export interface FieldOptions {
  seed: number;
  nodeCount: number;
  connectionRadius: number;
  majorFilamentCount: number;
  microFilamentCount: number;
  arcCount: number;
  flareCount: number;
  macroLoopCount: number;
}

// The single source of truth for the shipped field. The engine imports this
// rather than declaring its own copy, so the specs below are exercised
// against exactly what renders — a divergent copy meant the reach, depth and
// brightness rules were being proven against a field nobody ever saw.
export const ORGANISM_FIELD_OPTIONS: FieldOptions = {
  seed: 11,
  nodeCount: 420,
  connectionRadius: 0.22,
  majorFilamentCount: 190,
  microFilamentCount: 900,
  arcCount: 8,
  flareCount: 8,
  macroLoopCount: 4,
};

export interface OrganismFieldResult {
  macroLoops: MacroLoop[];
  nodes: FieldNode[];
  connections: FieldConnection[];
  filaments: MajorFilament[];
  microFilaments: MicroFilament[];
  arcs: OrbitalArc[];
  flares: NodalFlare[];
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

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function length(p: Vec3): number {
  return Math.hypot(p[0], p[1], p[2]);
}

function normalize(p: Vec3): Vec3 {
  const l = length(p) || 1;
  return [p[0] / l, p[1] / l, p[2] / l];
}

// Three to five macro circulation paths — never ten, never twenty. Each is
// asymmetrical, wraps through a different depth plane, folds in front of and
// behind the core, and approaches the membrane before turning away. They are
// stable attractors: the meso filaments inherit direction and density from
// whichever loop is nearest, so the weave reads as one coherent flow ecology
// rather than unrelated curves placed in a ball.
const LOOP_JOBS: LoopJob[] = ['gathering', 'circulating', 'focusing', 'releasing'];

function buildMacroLoops(seed: number, count: number): MacroLoop[] {
  const rng = mulberry32(seed ^ 0x27d4eb2f);
  const loops: MacroLoop[] = [];

  for (let index = 0; index < count; index += 1) {
    // each loop lives on its own tilted plane at its own depth
    const tiltA = rng() * Math.PI;
    const tiltB = rng() * Math.PI * 2;
    const depthOffset = (rng() * 2 - 1) * 0.42;
    const majorRadius = 0.52 + rng() * 0.4;
    const squash = 0.45 + rng() * 0.5;
    const steps = 48;

    const controlPoints: Vec3[] = [];
    for (let step = 0; step < steps; step += 1) {
      const t = (step / steps) * Math.PI * 2;
      // asymmetry: the loop compresses on one side and opens on the other,
      // creating zones of compression and opening rather than a plain ring
      const breathe = 1 + 0.34 * Math.sin(t + tiltB) + 0.16 * Math.sin(t * 2 - tiltA);
      const r = majorRadius * breathe;

      const x = Math.cos(t) * r;
      const y = Math.sin(t) * r * squash;
      const z = depthOffset + Math.sin(t * 2 + tiltB) * 0.3;

      // rotate the plane so loops wrap through different orientations
      const cosA = Math.cos(tiltA);
      const sinA = Math.sin(tiltA);
      const cosB = Math.cos(tiltB);
      const sinB = Math.sin(tiltB);

      const y1 = y * cosA - z * sinA;
      const z1 = y * sinA + z * cosA;
      const x1 = x * cosB - z1 * sinB;
      const z2 = x * sinB + z1 * cosB;

      controlPoints.push([x1, y1, z2]);
    }

    loops.push({
      controlPoints,
      job: LOOP_JOBS[index % LOOP_JOBS.length],
      weight: 0.6 + rng() * 0.4,
    });
  }

  return loops;
}

// Direction of the nearest macro loop at a point, so filaments align with the
// organism's circulation instead of being generated independently.
function nearestLoopFlow(
  loops: MacroLoop[],
  point: Vec3,
): { direction: Vec3; distance: number } | null {
  if (loops.length === 0) {
    return null;
  }

  let best = { direction: [0, 0, 0] as Vec3, distance: Infinity };

  for (const loop of loops) {
    const points = loop.controlPoints;
    for (let i = 0; i < points.length; i += 1) {
      const d = distance(points[i], point);
      if (d < best.distance) {
        const next = points[(i + 1) % points.length];
        best = {
          direction: normalize([
            next[0] - points[i][0],
            next[1] - points[i][1],
            next[2] - points[i][2],
          ]),
          distance: d,
        };
      }
    }
  }

  return best;
}

// The volumetric generative filament field. Everything is deterministic per
// seed so the organism is the same being on every visit — only its motion
// lives in time. Geometry follows the Founder's Orbital Filament System
// specification: nodes fill the volume with lavender leaning right but
// interwoven; strands originate at interior nodes (never the exact center),
// wander outward through smooth control points, and split into inner /
// membrane-touching / orbital reach classes.
export function organismField(options: FieldOptions): OrganismFieldResult {
  const rng = mulberry32(options.seed);

  const macroLoops = buildMacroLoops(options.seed, options.macroLoopCount);

  // The two cognition poles. Node density and warmth cluster around them
  // instead of blanketing the volume evenly.
  const GOLD_POLE: Vec3 = [-0.08, 0.02, 0.05];
  const LAVENDER_POLE: Vec3 = [0.52, 0.1, 0.15];

  const nodes: FieldNode[] = [];
  for (let index = 0; index < options.nodeCount; index += 1) {
    const theta = rng() * Math.PI * 2;
    const cosPhi = rng() * 2 - 1;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    // Bias the sample toward the interior so intelligence gathers where the
    // poles are, leaving the periphery atmospheric.
    const radius = Math.pow(rng(), 0.62);
    const position: Vec3 = [
      Math.cos(theta) * sinPhi * radius,
      cosPhi * radius,
      Math.sin(theta) * sinPhi * radius,
    ];

    const toGold = distance(position, GOLD_POLE);
    const toLavender = distance(position, LAVENDER_POLE);

    const zone: FieldZone =
      toGold < 0.44 ? 'core' : toLavender < 0.56 ? 'secondary' : 'peripheral';

    // Lavender leans right, but small traces flow into and across the
    // center so the split never reads as two clean halves.
    const family: FieldNode['family'] =
      zone === 'secondary' || position[0] > 0.15 + 0.35 * rng() || rng() < 0.07
        ? 'lavender'
        : 'gold';

    // Centrality falls off from whichever pole owns this node; it drives both
    // edge probability and brightness, so connectivity concentrates.
    const poleDistance = Math.min(toGold, toLavender);
    const centrality = Math.max(0, 1 - poleDistance / 1.05);

    nodes.push({ position, family, zone, centrality });
  }

  // Clustered, weighted, direction-biased connectivity — NOT uniform
  // neighbour-linking. Even proximity linking is what produces an exposed
  // triangulated cage; the graph should read as latent connective tissue.
  // Local edges dominate inside a zone, a handful of long spans bridge
  // clusters to imply higher-order connection, and the periphery stays sparse.
  const zoneEdgeOdds: Record<FieldZone, number> = {
    core: 0.92,
    secondary: 0.85,
    peripheral: 0.18,
  };

  const connections: FieldConnection[] = [];
  const degree = new Array<number>(nodes.length).fill(0);
  const MAX_DEGREE = 6;

  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      if (degree[a] >= MAX_DEGREE || degree[b] >= MAX_DEGREE) {
        continue;
      }
      const span = distance(nodes[a].position, nodes[b].position);
      if (span >= options.connectionRadius) {
        continue;
      }
      // same-zone links are the norm; cross-zone links are rare bridges
      const sameZone = nodes[a].zone === nodes[b].zone;
      const odds =
        (zoneEdgeOdds[nodes[a].zone] + zoneEdgeOdds[nodes[b].zone]) / 2 *
        (sameZone ? 1 : 0.22) *
        // shorter links are far likelier, so no long straight girders appear
        (1 - span / options.connectionRadius) *
        (0.45 + 0.55 * ((nodes[a].centrality + nodes[b].centrality) / 2));

      if (rng() < odds) {
        connections.push({ a, b });
        degree[a] += 1;
        degree[b] += 1;
      }
    }
  }

  const filaments: MajorFilament[] = [];
  const depthCycle: MajorFilament['depth'][] = [
    'rear', 'middle', 'front', 'middle', 'rear', 'front', 'middle', 'front', 'rear', 'middle',
  ];
  // Enormous complexity, only a fraction legible. Hero strands are the few
  // the eye consciously follows; support binds the field; recessive is sensed
  // more than read.
  const heroCount = Math.max(8, Math.round(options.majorFilamentCount * 0.06));
  const supportCount = Math.max(25, Math.round(options.majorFilamentCount * 0.2));

  for (let index = 0; index < options.majorFilamentCount; index += 1) {
    const t = index / options.majorFilamentCount;
    const filamentClass: FilamentClass =
      index < heroCount
        ? 'hero'
        : index < heroCount + supportCount
          ? 'support'
          : 'recessive';
    // 'radial' strands are the reference's signature starburst: they begin AT
    // the luminous core and sweep outward. The remaining classes still begin
    // out in the volume, so the organism never reads as a sun with rays.
    const reach: MajorFilament['reach'] =
      t < 0.45 ? 'radial' : t < 0.72 ? 'inner' : t < 0.9 ? 'membrane' : 'orbital';

    const originNode = nodes[Math.floor(rng() * nodes.length)];
    let origin: Vec3;

    if (reach === 'radial') {
      const dir = normalize([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]);
      const coreRadius = 0.06 + rng() * 0.04;
      origin = [dir[0] * coreRadius, dir[1] * coreRadius, dir[2] * coreRadius];
    } else {
      const originScale = 0.3 + rng() * 0.55;
      origin = [
        originNode.position[0] * originScale,
        originNode.position[1] * originScale,
        originNode.position[2] * originScale,
      ];
      if (length(origin) < 0.14) {
        const dir = normalize([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]);
        origin = [dir[0] * 0.18, dir[1] * 0.18, dir[2] * 0.18];
      }
    }

    const endRadius =
      reach === 'radial'
        ? 0.72 + rng() * 0.26
        : reach === 'inner'
          ? 0.6 + rng() * 0.35
          : reach === 'membrane'
            ? 1.0 + rng() * 0.12
            : 1.14 + rng() * 0.1;

    // Launch mostly tangentially so strands sweep and arc across the
    // volume (like the reference weave) instead of shooting straight out.
    const outward = normalize(origin);
    const randomAxis = normalize([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]);
    const tangential = normalize([
      outward[1] * randomAxis[2] - outward[2] * randomAxis[1],
      outward[2] * randomAxis[0] - outward[0] * randomAxis[2],
      outward[0] * randomAxis[1] - outward[1] * randomAxis[0],
    ]);
    // Radial strands drive almost straight out from the core (a starburst);
    // the rest keep the tangential sweep that fills the volume.
    const outwardWeight = reach === 'radial' ? 0.92 : 0.4;
    const tangentialWeight = reach === 'radial' ? 0.12 : 0.6;
    const jitter = reach === 'radial' ? 0.05 : 0.15;

    // Flow governance: strands inherit direction from the nearest macro loop,
    // strongly for hero strands and progressively less for the rest. This is
    // what makes the weave one coherent circulation ecology instead of many
    // independent curves. Nothing is generated in isolation.
    const flow = nearestLoopFlow(macroLoops, origin);
    const flowWeight =
      flow === null
        ? 0
        : (filamentClass === 'hero' ? 1.15 : filamentClass === 'support' ? 0.55 : 0.28) *
          Math.max(0, 1 - flow.distance / 0.9);
    const flowDir = flow?.direction ?? ([0, 0, 0] as Vec3);

    const heading = normalize([
      tangential[0] * tangentialWeight + outward[0] * outwardWeight +
        flowDir[0] * flowWeight + (rng() * 2 - 1) * jitter,
      tangential[1] * tangentialWeight + outward[1] * outwardWeight +
        flowDir[1] * flowWeight + (rng() * 2 - 1) * jitter,
      tangential[2] * tangentialWeight + outward[2] * outwardWeight +
        flowDir[2] * flowWeight + (rng() * 2 - 1) * jitter,
    ]);

    // Smooth organic drift: the heading itself wanders a little each step
    // (instead of re-randomizing), so strands curve continuously without
    // kinks — sketch geometry refined toward the reference's flowing weave.
    const pointCount = 7 + Math.floor(rng() * 3);
    const controlPoints: Vec3[] = [origin];
    let drift: Vec3 = heading;
    for (let step = 1; step < pointCount; step += 1) {
      const progress = step / (pointCount - 1);
      const radius = length(origin) + (endRadius - length(origin)) * progress;
      const wander =
        (reach === 'radial' ? 0.07 : 0.16) * Math.sin(progress * Math.PI);
      drift = normalize([
        drift[0] + (rng() * 2 - 1) * wander,
        drift[1] + (rng() * 2 - 1) * wander,
        drift[2] + (rng() * 2 - 1) * wander,
      ]);
      controlPoints.push([drift[0] * radius, drift[1] * radius, drift[2] * radius]);
    }

    // pin the endpoint radius so reach classes hold exactly
    const last = controlPoints[controlPoints.length - 1];
    const lastDir = normalize(last);
    controlPoints[controlPoints.length - 1] = [
      lastDir[0] * endRadius,
      lastDir[1] * endRadius,
      lastDir[2] * endRadius,
    ];

    const family: MajorFilament['family'] =
      rng() < 0.2
        ? originNode.family === 'gold' ? 'lavender' : 'gold'
        : originNode.family;

    filaments.push({
      controlPoints,
      depth: depthCycle[index % depthCycle.length],
      family,
      // Only heroes reach full brilliance; recessive strands are sensed
      // more than read. This is the "increase complexity, decrease explicit
      // visibility" principle expressed in the data.
      brightness:
        filamentClass === 'hero'
          ? 0.82 + rng() * 0.18
          : filamentClass === 'support'
            ? 0.42 + rng() * 0.3
            : 0.14 + rng() * 0.2,
      reach,
      filamentClass,
    });
  }

  // Most arcs hug the organism; the last few reach restrained orbits well
  // beyond it, so the field extends past the shell without shouting.
  // Own RNG stream: tuning filament counts must never re-roll the arcs.
  const arcRng = mulberry32(options.seed ^ 0x85ebca6b);
  const arcs: OrbitalArc[] = [];
  for (let index = 0; index < options.arcCount; index += 1) {
    const far = index >= options.arcCount - 3;
    arcs.push({
      radius: far ? 1.6 + arcRng() * 0.35 : 1.25 + arcRng() * 0.3,
      tilt: [arcRng() * Math.PI, arcRng() * Math.PI, arcRng() * Math.PI],
      direction: index % 2 === 0 ? 1 : -1,
      periodSeconds: 16 + arcRng() * 16,
    });
  }

  const brightestFirst = [...filaments].sort((a, b) => b.brightness - a.brightness);
  // Own RNG stream, for the same reason as the arcs.
  const flareRng = mulberry32(options.seed ^ 0xc2b2ae35);
  const flares: NodalFlare[] = [];
  for (let index = 0; index < options.flareCount; index += 1) {
    const filament = brightestFirst[index % brightestFirst.length];
    const anchor =
      index % 2 === 0
        ? filament.controlPoints[0]
        : filament.controlPoints[Math.floor(filament.controlPoints.length / 2)];
    flares.push({
      position: anchor,
      family: filament.family,
      scale: 0.03 + flareRng() * 0.04,
      pulseSeconds: 1.8 + flareRng() * 3,
      phase: flareRng() * Math.PI * 2,
    });
  }

  // Secondary micro-weave: numerous, extremely fine, mostly receding strands
  // that interlace the volume beneath the major filaments. A SEPARATE rng
  // stream keeps the major structure bit-identical whatever this count is.
  // Anchored on constellation nodes (concentration where the intelligence
  // lives), pulled slightly inward, dissolving before the membrane.
  const microRng = mulberry32(options.seed ^ 0x9e3779b9);
  const microFilaments: MicroFilament[] = [];
  for (let index = 0; index < options.microFilamentCount; index += 1) {
    // Natural falloff toward the membrane: outer nodes host fewer strands.
    let anchorNode = nodes[Math.floor(microRng() * nodes.length)];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (length(anchorNode.position) <= 0.68 || microRng() < 0.15) {
        break;
      }
      anchorNode = nodes[Math.floor(microRng() * nodes.length)];
    }
    // Pull the anchor inward, and hard-clamp it so the weave always begins
    // well inside the membrane regardless of where its node sits.
    const inward = 0.86 + microRng() * 0.12;
    const anchorRadius = Math.min(0.88, length(anchorNode.position) * inward);
    const anchorDir = normalize(anchorNode.position);
    const anchor: Vec3 = [
      anchorDir[0] * anchorRadius,
      anchorDir[1] * anchorRadius,
      anchorDir[2] * anchorRadius,
    ];

    const axis = normalize([microRng() * 2 - 1, microRng() * 2 - 1, microRng() * 2 - 1]);
    const reachLength = 0.18 + microRng() * 0.3;
    const pointCount = 4 + Math.floor(microRng() * 2);

    const controlPoints: Vec3[] = [anchor];
    let drift = axis;
    for (let step = 1; step < pointCount; step += 1) {
      const progress = step / (pointCount - 1);
      drift = normalize([
        drift[0] + (microRng() * 2 - 1) * 0.35,
        drift[1] + (microRng() * 2 - 1) * 0.35,
        drift[2] + (microRng() * 2 - 1) * 0.35,
      ]);
      const previous = controlPoints[step - 1];
      let next: Vec3 = [
        previous[0] + drift[0] * reachLength * progress * 0.6,
        previous[1] + drift[1] * reachLength * progress * 0.6,
        previous[2] + drift[2] * reachLength * progress * 0.6,
      ];
      // dissolve before the membrane: fold back any point drifting outward
      const radius = length(next);
      if (radius > 0.94) {
        const dir = normalize(next);
        const folded = 0.94 - (radius - 0.94) * 0.5;
        next = [dir[0] * folded, dir[1] * folded, dir[2] * folded];
      }
      controlPoints.push(next);
    }

    microFilaments.push({
      controlPoints,
      family: anchorNode.family,
      opacity: 0.03 + microRng() * 0.07,
    });
  }

  return { macroLoops, nodes, connections, filaments, microFilaments, arcs, flares };
}
