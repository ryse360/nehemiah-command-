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

// The surrounding constellation. Deliberately a field layer rather than an
// engine detail: its density is part of the composition and therefore has to be
// specified and tested like every other layer.
export interface FieldStar {
  position: Vec3;
  // relative brightness class, 0..1 — most stars are fine, a few carry weight
  size: number;
  opacity: number;
  family: 'gold' | 'lavender';
}

export interface FieldOptions {
  seed: number;
  starCount: number;
  nodeCount: number;
  connectionRadius: number;
  majorFilamentCount: number;
  microFilamentCount: number;
  arcCount: number;
  flareCount: number;
  macroLoopCount: number;
  dendriteTrunkCount: number;
}

// The single source of truth for the shipped field. The engine imports this
// rather than declaring its own copy, so the specs below are exercised
// against exactly what renders — a divergent copy meant the reach, depth and
// brightness rules were being proven against a field nobody ever saw.
export const ORGANISM_FIELD_OPTIONS: FieldOptions = {
  seed: 11,
  starCount: 760,
  nodeCount: 420,
  connectionRadius: 0.22,
  majorFilamentCount: 190,
  microFilamentCount: 900,
  arcCount: 8,
  flareCount: 8,
  macroLoopCount: 4,
  dendriteTrunkCount: 24,
};

export interface OrganismFieldResult {
  stars: FieldStar[];
  macroLoops: MacroLoop[];
  dendrites: Dendrite[];
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

// A single dendrite segment. Generation 0 is a trunk leaving the core, 1 a
// branch, 2 a twig — each finer and dimmer than its parent.
export interface Dendrite {
  points: Vec3[];
  generation: 0 | 1 | 2;
  family: 'gold' | 'lavender';
  brightness: number;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// Rotate `v` about `axis` by `angle` (Rodrigues). Used to deviate a child
// branch from its parent by a BOUNDED angle, which is what keeps a trunk's
// whole family inside one coherent petal instead of scattering.
function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const kdotv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  return [
    v[0] * c + kv[0] * s + k[0] * kdotv * (1 - c),
    v[1] * c + kv[1] * s + k[1] * kdotv * (1 - c),
    v[2] * c + kv[2] * s + k[2] * kdotv * (1 - c),
  ];
}

// One global swirl field, shared by every strand. This is what makes the
// anatomy HARMONIOUS: a strand's curl is a smooth function of where it grows,
// so neighbouring strands bend the same way and the whole body reads as one
// combed flow — streamlines of a single field — instead of a tangle of
// individually-random walks. Broad, low-frequency terms keep the coherence
// regions wide (many trunks share each sweep).
function swirlAt(direction: Vec3): number {
  return (
    0.3 * Math.sin(direction[0] * 1.7 + direction[1] * 2.3 + 0.6) +
    0.2 * Math.sin(direction[2] * 2.9 - direction[0] * 1.1 - 1.2)
  );
}

// Grow one smooth strand outward. Three properties make it read as elegant
// rather than scribbled:
//   1. radius increases on EVERY step, so a strand can never fold back and
//      cross its own family;
//   2. lateral drift comes from one slowly-rotating vector rather than fresh
//      randomness per step, so the curve is continuous, not jittery;
//   3. the rotation's direction and rate come from the global swirl field —
//      per-strand randomness is only a whisper on top.
function growStrand(
  origin: Vec3,
  direction: Vec3,
  startRadius: number,
  endRadius: number,
  curl: number,
  steps: number,
  rng: () => number,
): Vec3[] {
  const points: Vec3[] = [origin];
  const reference: Vec3 = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let lateral = normalize(cross(direction, reference));
  const spin = swirlAt(direction) + (rng() * 2 - 1) * 0.09;

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    // ease outward so strands open up as they travel, like a fan
    const radius = startRadius + (endRadius - startRadius) * Math.pow(t, 0.82);
    lateral = normalize(rotateAbout(lateral, direction, spin));
    const bow = Math.sin(t * Math.PI) * curl;
    const heading = normalize([
      direction[0] + lateral[0] * bow,
      direction[1] + lateral[1] * bow,
      direction[2] + lateral[2] * bow,
    ]);
    points.push([heading[0] * radius, heading[1] * radius, heading[2] * radius]);
  }

  return points;
}

// The dendrite system: the organism's radiating anatomy. Trunks are placed on
// a Fibonacci sphere so they are evenly separated in ANGLE — that even
// spacing is what creates the reference's clean negative space between
// petals. Each trunk sheds branches, each branch sheds twigs, and every child
// deviates from its parent by a bounded angle so a family stays one petal.
function buildDendrites(
  seed: number,
  trunkCount: number,
  lavenderPole: Vec3,
): Dendrite[] {
  const rng = mulberry32(seed ^ 0x1b873593);
  const dendrites: Dendrite[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < trunkCount; index += 1) {
    const y = trunkCount === 1 ? 0 : 1 - (index / (trunkCount - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * index;
    const direction = normalize([
      Math.cos(theta) * ring,
      y,
      Math.sin(theta) * ring,
    ]);

    // a trunk belongs to whichever pole it grows toward
    const towardLavender =
      direction[0] * lavenderPole[0] + direction[1] * lavenderPole[1] > 0.16;
    const family: Dendrite['family'] = towardLavender ? 'lavender' : 'gold';

    const trunkStart = 0.055 + rng() * 0.03;
    const trunkEnd = 0.46 + rng() * 0.16;
    const trunkPoints = growStrand(
      [direction[0] * trunkStart, direction[1] * trunkStart, direction[2] * trunkStart],
      direction,
      trunkStart,
      trunkEnd,
      0.1 + rng() * 0.08,
      14,
      rng,
    );

    dendrites.push({
      points: trunkPoints,
      generation: 0,
      family,
      brightness: 0.78 + rng() * 0.22,
    });

    // Branches leave the trunk partway along, never at its tip, so the fork
    // reads as growth rather than a broken line.
    const branchCount = 3 + Math.floor(rng() * 2);
    for (let b = 0; b < branchCount; b += 1) {
      const forkAt = 0.42 + rng() * 0.34;
      const forkIndex = Math.floor(forkAt * (trunkPoints.length - 1));
      const forkPoint = trunkPoints[forkIndex];
      const forkRadius = length(forkPoint);

      const perpendicular = normalize(
        cross(direction, [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]),
      );
      // bounded deviation: 16-34 degrees keeps the family coherent
      const deviation = (16 + rng() * 18) * (Math.PI / 180);
      const branchDir = normalize(rotateAbout(direction, perpendicular, deviation));
      const branchEnd = forkRadius + 0.24 + rng() * 0.22;

      const branchPoints = growStrand(
        forkPoint,
        branchDir,
        forkRadius,
        Math.min(0.93, branchEnd),
        0.14 + rng() * 0.1,
        11,
        rng,
      );

      dendrites.push({
        points: branchPoints,
        generation: 1,
        family,
        brightness: 0.4 + rng() * 0.24,
      });

      // Twigs: the finest generation, sensed more than read.
      const twigCount = 1 + Math.floor(rng() * 3);
      for (let w = 0; w < twigCount; w += 1) {
        const twigAt = 0.45 + rng() * 0.4;
        const twigIndex = Math.floor(twigAt * (branchPoints.length - 1));
        const twigPoint = branchPoints[twigIndex];
        const twigRadius = length(twigPoint);

        const twigPerp = normalize(
          cross(branchDir, [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]),
        );
        const twigDeviation = (14 + rng() * 20) * (Math.PI / 180);
        const twigDir = normalize(rotateAbout(branchDir, twigPerp, twigDeviation));

        dendrites.push({
          points: growStrand(
            twigPoint,
            twigDir,
            twigRadius,
            Math.min(0.96, twigRadius + 0.12 + rng() * 0.16),
            0.16 + rng() * 0.12,
            8,
            rng,
          ),
          generation: 2,
          family,
          brightness: 0.16 + rng() * 0.16,
        });
      }
    }
  }

  return dendrites;
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

  // The radiating anatomy. This replaces the old 'radial' strands, which
  // wandered independently and therefore crossed each other into a scribble.
  const dendrites = buildDendrites(
    options.seed,
    options.dendriteTrunkCount,
    LAVENDER_POLE,
  );

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
      t < 0.1 ? 'radial' : t < 0.68 ? 'inner' : t < 0.9 ? 'membrane' : 'orbital';

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

  // The surrounding constellation, on its own RNG stream so density can be
  // tuned without disturbing a single strand of the organism itself.
  const starRng = mulberry32(options.seed ^ 0x6a09e667);
  const stars: FieldStar[] = [];
  for (let index = 0; index < options.starCount; index += 1) {
    // Placed in an annulus around the view axis rather than on a sphere. A
    // sphere puts stars directly in front of and behind the body, and since the
    // organism's glow layers write no depth, those land as specks ON it. The
    // annulus keeps the constellation in the surrounding space where it belongs
    // while |z| still supplies genuine depth.
    const angle = starRng() * Math.PI * 2;
    // Concentrated near the organism and thinning outward, so the field reads
    // as this thing's own atmosphere rather than wallpaper behind it.
    const planarRadius = 1.28 + 2.17 * Math.pow(starRng(), 1.7);
    const depth = (starRng() * 2 - 1) * 1.2;
    const direction: Vec3 = [Math.cos(angle), Math.sin(angle), 0];

    // Three brightness classes: mostly fine, some mid, a few carrying weight.
    const roll = starRng();
    const size = roll < 0.7
      ? 0.16 + starRng() * 0.24
      : roll < 0.94
        ? 0.42 + starRng() * 0.3
        : 0.78 + starRng() * 0.22;

    // Distance dims: the far field has to recede or depth collapses flat.
    const depthFade = 1 - (planarRadius - 1.28) / 2.17;
    const opacity = (0.1 + 0.42 * size) * (0.34 + 0.66 * depthFade * depthFade);

    // Cool stars belong to the reasoning side; a violet speck stranded in the
    // warm hemisphere reads as an error, not as atmosphere.
    const wantsLavender = starRng() < 0.3;
    const family: 'gold' | 'lavender' =
      wantsLavender && direction[0] > -0.05 ? 'lavender' : 'gold';

    stars.push({
      position: [
        direction[0] * planarRadius,
        direction[1] * planarRadius,
        depth,
      ],
      size,
      opacity,
      family,
    });
  }

  return {
    stars,
    macroLoops,
    dendrites,
    nodes,
    connections,
    filaments,
    microFilaments,
    arcs,
    flares,
  };
}
