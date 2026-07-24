export type Vec3 = [number, number, number];

export interface FieldNode {
  position: Vec3;
  family: 'gold' | 'lavender';
}

export interface FieldConnection {
  a: number;
  b: number;
}

export interface MajorFilament {
  controlPoints: Vec3[];
  depth: 'rear' | 'middle' | 'front';
  family: 'gold' | 'lavender';
  brightness: number;
  reach: 'inner' | 'membrane' | 'orbital';
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
}

export interface OrganismFieldResult {
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

// The volumetric generative filament field. Everything is deterministic per
// seed so the organism is the same being on every visit — only its motion
// lives in time. Geometry follows the Founder's Orbital Filament System
// specification: nodes fill the volume with lavender leaning right but
// interwoven; strands originate at interior nodes (never the exact center),
// wander outward through smooth control points, and split into inner /
// membrane-touching / orbital reach classes.
export function organismField(options: FieldOptions): OrganismFieldResult {
  const rng = mulberry32(options.seed);

  const nodes: FieldNode[] = [];
  for (let index = 0; index < options.nodeCount; index += 1) {
    const theta = rng() * Math.PI * 2;
    const cosPhi = rng() * 2 - 1;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    const radius = Math.cbrt(rng());
    const position: Vec3 = [
      Math.cos(theta) * sinPhi * radius,
      cosPhi * radius,
      Math.sin(theta) * sinPhi * radius,
    ];
    // Lavender leans right, but small traces flow into and across the
    // center so the split never reads as two clean halves.
    const family: FieldNode['family'] =
      position[0] > 0.15 + 0.35 * rng() || rng() < 0.07 ? 'lavender' : 'gold';
    nodes.push({ position, family });
  }

  const connections: FieldConnection[] = [];
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      if (distance(nodes[a].position, nodes[b].position) < options.connectionRadius) {
        connections.push({ a, b });
      }
    }
  }

  const filaments: MajorFilament[] = [];
  const depthCycle: MajorFilament['depth'][] = [
    'rear', 'middle', 'front', 'middle', 'rear', 'front', 'middle', 'front', 'rear', 'middle',
  ];
  for (let index = 0; index < options.majorFilamentCount; index += 1) {
    const t = index / options.majorFilamentCount;
    const reach: MajorFilament['reach'] =
      t < 0.64 ? 'inner' : t < 0.9 ? 'membrane' : 'orbital';

    const originNode = nodes[Math.floor(rng() * nodes.length)];
    const originScale = 0.3 + rng() * 0.55;
    let origin: Vec3 = [
      originNode.position[0] * originScale,
      originNode.position[1] * originScale,
      originNode.position[2] * originScale,
    ];
    if (length(origin) < 0.14) {
      const dir = normalize([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]);
      origin = [dir[0] * 0.18, dir[1] * 0.18, dir[2] * 0.18];
    }

    const endRadius =
      reach === 'inner'
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
    const heading = normalize([
      tangential[0] * 0.6 + outward[0] * 0.4 + (rng() * 2 - 1) * 0.15,
      tangential[1] * 0.6 + outward[1] * 0.4 + (rng() * 2 - 1) * 0.15,
      tangential[2] * 0.6 + outward[2] * 0.4 + (rng() * 2 - 1) * 0.15,
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
      const wander = 0.16 * Math.sin(progress * Math.PI);
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
      brightness: 0.25 + rng() * 0.75,
      reach,
    });
  }

  const arcs: OrbitalArc[] = [];
  for (let index = 0; index < options.arcCount; index += 1) {
    arcs.push({
      radius: 1.25 + rng() * 0.4,
      tilt: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI],
      direction: index % 2 === 0 ? 1 : -1,
      periodSeconds: 16 + rng() * 16,
    });
  }

  const brightestFirst = [...filaments].sort((a, b) => b.brightness - a.brightness);
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
      scale: 0.03 + rng() * 0.04,
      pulseSeconds: 1.8 + rng() * 3,
      phase: rng() * Math.PI * 2,
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
    const inward = 0.86 + microRng() * 0.12;
    const anchor: Vec3 = [
      anchorNode.position[0] * inward,
      anchorNode.position[1] * inward,
      anchorNode.position[2] * inward,
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
      opacity: 0.04 + microRng() * 0.12,
    });
  }

  return { nodes, connections, filaments, microFilaments, arcs, flares };
}
