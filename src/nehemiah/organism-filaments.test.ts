import test from 'node:test';
import assert from 'node:assert/strict';
import { radiatingFilaments, type FilamentPoint } from './organism-filaments';

const length = (p: FilamentPoint) => Math.hypot(p[0], p[1], p[2]);

const baseOptions = {
  count: 40,
  seed: 7,
  innerRadius: 0.12,
  outerRadius: 1.45,
  segments: 24,
  curl: 0.28,
} as const;

test('produces the requested number of filaments with fixed resolution', () => {
  const filaments = radiatingFilaments(baseOptions);

  assert.equal(filaments.length, baseOptions.count);
  for (const filament of filaments) {
    assert.equal(filament.points.length, baseOptions.segments + 1);
  }
});

test('every filament radiates from the core out toward the shell', () => {
  const filaments = radiatingFilaments(baseOptions);

  for (const filament of filaments) {
    const first = filament.points[0];
    const last = filament.points[filament.points.length - 1];

    assert.ok(
      length(first) <= baseOptions.innerRadius * 1.4,
      'strand begins at the core, not out in orbit',
    );
    assert.ok(
      length(last) >= baseOptions.outerRadius * 0.7,
      'strand reaches outward toward the shell',
    );
  }
});

test('strands grow outward monotonically on average (radiating, not orbiting)', () => {
  const [filament] = radiatingFilaments(baseOptions);
  const radii = filament.points.map(length);

  // the outer half is always further out than the inner half
  const innerMax = Math.max(...radii.slice(0, radii.length / 2));
  const outerMin = Math.min(...radii.slice(radii.length / 2));
  assert.ok(outerMin >= innerMax * 0.6);
  assert.ok(radii[radii.length - 1] > radii[0]);
});

test('generation is deterministic for a given seed', () => {
  assert.deepEqual(
    radiatingFilaments(baseOptions),
    radiatingFilaments(baseOptions),
  );
});

test('different seeds produce different strands', () => {
  const a = radiatingFilaments(baseOptions);
  const b = radiatingFilaments({ ...baseOptions, seed: 19 });
  assert.notDeepEqual(a, b);
});

test('the right hemisphere biases the indigo field to one side', () => {
  const filaments = radiatingFilaments({
    ...baseOptions,
    seed: 19,
    hemisphere: 'right',
  });

  const meanX =
    filaments.reduce((sum, f) => {
      const last = f.points[f.points.length - 1];
      return sum + last[0];
    }, 0) / filaments.length;

  assert.ok(meanX > 0, 'indigo dendrites lean to the +x hemisphere');
});
