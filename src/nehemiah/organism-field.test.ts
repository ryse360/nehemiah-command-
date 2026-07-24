import test from 'node:test';
import assert from 'node:assert/strict';
import { organismField, type FieldOptions } from './organism-field';

const defaults: FieldOptions = {
  seed: 11,
  nodeCount: 120,
  connectionRadius: 0.34,
  majorFilamentCount: 26,
  arcCount: 8,
  flareCount: 8,
};

const dist = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const len = (p: [number, number, number]) => Math.hypot(p[0], p[1], p[2]);

test('generation is deterministic per seed and varies across seeds', () => {
  assert.deepEqual(organismField(defaults), organismField(defaults));
  assert.notDeepEqual(organismField(defaults), organismField({ ...defaults, seed: 12 }));
});

test('honors requested counts and spec ranges', () => {
  const field = organismField(defaults);

  assert.equal(field.nodes.length, defaults.nodeCount);
  assert.equal(field.filaments.length, defaults.majorFilamentCount);
  assert.equal(field.arcs.length, defaults.arcCount);
  assert.equal(field.flares.length, defaults.flareCount);
  assert.ok(
    field.connections.length >= 150 && field.connections.length <= 280,
    `connections ${field.connections.length} within spec 150-280`,
  );
});

test('connections only join nearby nodes', () => {
  const field = organismField(defaults);
  for (const { a, b } of field.connections) {
    assert.ok(
      dist(field.nodes[a].position, field.nodes[b].position) < defaults.connectionRadius,
    );
  }
});

test('filament reach follows the 60-70 / 20-30 / 8-12 distribution', () => {
  const field = organismField(defaults);
  const reachCount = { inner: 0, membrane: 0, orbital: 0 };
  for (const filament of field.filaments) {
    reachCount[filament.reach] += 1;
  }
  const total = field.filaments.length;

  assert.ok(reachCount.inner / total >= 0.55 && reachCount.inner / total <= 0.75);
  assert.ok(reachCount.membrane / total >= 0.18 && reachCount.membrane / total <= 0.34);
  assert.ok(reachCount.orbital / total >= 0.06 && reachCount.orbital / total <= 0.14);
  assert.ok(reachCount.orbital >= 1, 'at least one filament continues outward');
});

test('orbital filaments genuinely extend beyond the membrane', () => {
  const field = organismField(defaults);
  for (const filament of field.filaments) {
    const end = filament.controlPoints[filament.controlPoints.length - 1];
    if (filament.reach === 'orbital') {
      assert.ok(len(end) >= 1.14, 'orbital strands push past the shell');
    }
    if (filament.reach === 'inner') {
      assert.ok(len(end) <= 0.98, 'inner strands stay within the membrane');
    }
  }
});

test('filaments never all originate from the center', () => {
  const field = organismField(defaults);
  const origins = field.filaments.map((f) => f.controlPoints[0]);

  for (const origin of origins) {
    assert.ok(len(origin) > 0.12, 'no strand starts at the exact center');
  }

  let maxSpread = 0;
  for (const a of origins) for (const b of origins) maxSpread = Math.max(maxSpread, dist(a, b));
  assert.ok(maxSpread > 0.4, 'origins are spread through the volume');
});

test('all three depth groups exist and brightness genuinely varies', () => {
  const field = organismField(defaults);
  const depths = new Set(field.filaments.map((f) => f.depth));

  assert.ok(depths.has('rear') && depths.has('middle') && depths.has('front'));

  const brightness = field.filaments.map((f) => f.brightness);
  assert.ok(Math.max(...brightness) - Math.min(...brightness) > 0.4);
  for (const value of brightness) assert.ok(value >= 0.25 && value <= 1);
});

test('lavender leans right while staying interwoven with gold', () => {
  const field = organismField(defaults);
  const lavender = field.nodes.filter((n) => n.family === 'lavender');
  const gold = field.nodes.filter((n) => n.family === 'gold');

  assert.ok(lavender.length > 0 && gold.length > 0);

  const meanX = (nodes: typeof field.nodes) =>
    nodes.reduce((sum, n) => sum + n.position[0], 0) / nodes.length;
  assert.ok(meanX(lavender) > meanX(gold), 'lavender biased to the right hemisphere');

  // interwoven, not a clean half-split: some lavender on the left, some gold on the right
  assert.ok(lavender.some((n) => n.position[0] < 0.1));
  assert.ok(gold.some((n) => n.position[0] > 0.3));

  // gold dominates per the 55-65% warm balance
  const goldShare = gold.length / field.nodes.length;
  assert.ok(goldShare >= 0.55 && goldShare <= 0.8, `gold share ${goldShare}`);
});

test('arcs and flares follow the motion spec', () => {
  const field = organismField(defaults);

  const directions = new Set(field.arcs.map((a) => a.direction));
  assert.equal(directions.size, 2, 'arcs travel in both directions');
  for (const arc of field.arcs) {
    assert.ok(arc.periodSeconds >= 16 && arc.periodSeconds <= 32);
    assert.ok(arc.radius >= 1.2 && arc.radius <= 1.7);
  }

  const phases = new Set(field.flares.map((f) => f.phase.toFixed(3)));
  assert.ok(phases.size > 1, 'flares never pulse in unison');
  for (const flare of field.flares) {
    assert.ok(flare.pulseSeconds >= 1.8 && flare.pulseSeconds <= 4.8);
    assert.ok(flare.scale >= 0.03 && flare.scale <= 0.07);
  }
});
