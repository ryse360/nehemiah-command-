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

export interface FieldOptions {
  seed: number;
  nodeCount: number;
  connectionRadius: number;
  majorFilamentCount: number;
  arcCount: number;
  flareCount: number;
}

export interface OrganismFieldResult {
  nodes: FieldNode[];
  connections: FieldConnection[];
  filaments: MajorFilament[];
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
    const originScale = 0.25 + rng() * 0.45;
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

    const heading = normalize([
      origin[0] + (rng() * 2 - 1) * 0.8,
      origin[1] + (rng() * 2 - 1) * 0.8,
      origin[2] + (rng() * 2 - 1) * 0.8,
    ]);

    const pointCount = 5 + Math.floor(rng() * 3);
    const controlPoints: Vec3[] = [origin];
    for (let step = 1; step < pointCount; step += 1) {
      const progress = step / (pointCount - 1);
      const radius = length(origin) + (endRadius - length(origin)) * progress;
      const wander = 0.22 * Math.sin(progress * Math.PI);
      const direction = normalize([
        heading[0] + (rng() * 2 - 1) * wander * 2,
        heading[1] + (rng() * 2 - 1) * wander * 2,
        heading[2] + (rng() * 2 - 1) * wander * 2,
      ]);
      controlPoints.push([
        direction[0] * radius + (rng() * 2 - 1) * wander * 0.4,
        direction[1] * radius + (rng() * 2 - 1) * wander * 0.4,
        direction[2] * radius + (rng() * 2 - 1) * wander * 0.4,
      ]);
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

  return { nodes, connections, filaments, arcs, flares };
}
