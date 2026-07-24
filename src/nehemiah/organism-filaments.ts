export type FilamentPoint = [number, number, number];

export interface Filament {
  points: FilamentPoint[];
}

export interface FilamentOptions {
  count: number;
  seed: number;
  innerRadius: number;
  outerRadius: number;
  segments: number;
  curl: number;
  hemisphere?: 'full' | 'right';
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

function normalize(v: FilamentPoint): FilamentPoint {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: FilamentPoint, b: FilamentPoint): FilamentPoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// Dendritic filaments: each strand starts at the luminous core and radiates
// outward to the shell, curving organically along the way. Nothing orbits —
// the geometry reads as intelligence branching out from a single point,
// matching the Founder-approved resting reference.
export function radiatingFilaments({
  count,
  seed,
  innerRadius,
  outerRadius,
  segments,
  curl,
  hemisphere = 'full',
}: FilamentOptions): Filament[] {
  const rng = mulberry32(seed);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const filaments: Filament[] = [];

  for (let index = 0; index < count; index += 1) {
    const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * index;

    let direction = normalize([
      Math.cos(theta) * ringRadius,
      y,
      Math.sin(theta) * ringRadius,
    ]);

    if (hemisphere === 'right') {
      direction = normalize([Math.abs(direction[0]) + 0.15, direction[1], direction[2]]);
    }

    const reference: FilamentPoint =
      Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = normalize(cross(direction, reference));
    const v = cross(direction, u);

    const freqU = 1.5 + rng() * 2.5;
    const freqV = 1.5 + rng() * 2.5;
    const phaseU = rng() * Math.PI * 2;
    const phaseV = rng() * Math.PI * 2;

    const points: FilamentPoint[] = [];
    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      const radius = innerRadius + (outerRadius - innerRadius) * t;
      const wander = curl * t;
      const su = Math.sin(t * freqU * Math.PI + phaseU) * wander;
      const sv = Math.sin(t * freqV * Math.PI + phaseV) * wander;

      points.push([
        direction[0] * radius + u[0] * su + v[0] * sv,
        direction[1] * radius + u[1] * su + v[1] * sv,
        direction[2] * radius + u[2] * su + v[2] * sv,
      ]);
    }

    filaments.push({ points });
  }

  return filaments;
}
