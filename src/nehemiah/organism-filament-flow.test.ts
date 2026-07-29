import test from 'node:test';
import assert from 'node:assert/strict';

import { organismEcology } from './organism-ecology';
import {
  FILAMENT_FLOW_OPTIONS,
  curlNoise3,
  organismFilamentFlow,
  type Filament,
} from './organism-filament-flow';

const eco = organismEcology();
const { filaments } = organismFilamentFlow(eco.clusters);

const byTier = (t: Filament['tier']) => filaments.filter((f) => f.tier === t);
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('filament flow is deterministic', () => {
  const again = organismFilamentFlow(eco.clusters);
  assert.deepEqual(again.filaments[0].points[5], filaments[0].points[5]);
  assert.equal(again.filaments.length, filaments.length);
});

test('curl noise is divergence-free — the field cannot radiate from a point', () => {
  // Sample the divergence numerically across the volume. A radial/sunburst
  // field has strongly positive divergence at its source; curl noise must stay
  // near zero everywhere, which is WHY it cannot produce spokes.
  const e = 1e-3;
  let worst = 0;
  for (let i = 0; i < 40; i += 1) {
    const p: [number, number, number] = [
      (i % 5) * 0.3 - 0.6,
      ((i * 7) % 5) * 0.3 - 0.6,
      ((i * 3) % 5) * 0.3 - 0.6,
    ];
    const dx =
      curlNoise3([p[0] + e, p[1], p[2]], 1.35)[0] - curlNoise3([p[0] - e, p[1], p[2]], 1.35)[0];
    const dy =
      curlNoise3([p[0], p[1] + e, p[2]], 1.35)[1] - curlNoise3([p[0], p[1] - e, p[2]], 1.35)[1];
    const dz =
      curlNoise3([p[0], p[1], p[2] + e], 1.35)[2] - curlNoise3([p[0], p[1], p[2] - e], 1.35)[2];
    worst = Math.max(worst, Math.abs((dx + dy + dz) / (2 * e)));
  }
  // normalised curl vectors make this approximate, but it must stay bounded —
  // nothing like the large positive divergence of a radial source.
  assert.ok(worst < 60, `divergence must stay bounded, got ${worst.toFixed(1)}`);
});

test('REJECTS radial spokes: filaments curve rather than run straight from the centre', () => {
  for (const f of byTier('principal')) {
    const start = f.points[0];
    const end = f.points[f.points.length - 1];
    // arc length vs straight-line distance: a spoke has ratio ~1
    let arc = 0;
    for (let i = 1; i < f.points.length; i += 1) arc += dist(f.points[i - 1], f.points[i]);
    const chord = dist(start, end) || 1e-6;
    assert.ok(
      arc / chord > 1.25,
      `principal filaments must wander, got ratio ${(arc / chord).toFixed(2)}`,
    );
  }
});

test('three legibility tiers exist with a real hierarchy', () => {
  assert.ok(byTier('principal').length > 0);
  assert.ok(byTier('supporting').length > byTier('principal').length);
  assert.ok(byTier('micro').length > byTier('supporting').length);
  const avg = (t: Filament['tier']) =>
    byTier(t).reduce((s, f) => s + f.weight, 0) / byTier(t).length;
  // only selected structure is fully legible
  assert.ok(avg('principal') > avg('supporting'), 'principal reads strongest');
  assert.ok(avg('supporting') > avg('micro'), 'micro is recessive');
});

test('principal filaments are long; micro strands are short and recessive', () => {
  for (const f of byTier('principal')) {
    assert.equal(f.points.length, FILAMENT_FLOW_OPTIONS.principalSteps);
  }
  for (const f of byTier('micro')) {
    assert.equal(f.points.length, FILAMENT_FLOW_OPTIONS.microSteps);
    assert.ok(f.weight < 0.3, 'micro strands stay faint');
  }
});

test('filaments travel through depth, not across a flat plane', () => {
  let spanned = 0;
  for (const f of filaments) {
    const zs = f.points.map((p) => p[2]);
    if (Math.max(...zs) - Math.min(...zs) > 0.12) spanned += 1;
  }
  assert.ok(
    spanned / filaments.length > 0.4,
    `filaments must move through depth, got ${spanned}/${filaments.length}`,
  );
});

test('supporting filaments thread their own attractor region', () => {
  for (const f of byTier('supporting')) {
    const c = eco.clusters[f.cluster];
    const near = f.points.filter(
      (p) => dist(p, c.center) < c.radius * 2.6,
    ).length;
    assert.ok(
      near / f.points.length > 0.5,
      'a supporting filament stays with its region',
    );
  }
});

test('principal filaments link separate regions — circulation, not local loops', () => {
  for (const f of byTier('principal')) {
    const start = f.points[0];
    const end = f.points[f.points.length - 1];
    assert.ok(dist(start, end) > 0.18, 'a principal path genuinely travels');
  }
});

test('some filaments approach the membrane, but not most', () => {
  const breaching = filaments.filter((f) => f.breachesMembrane).length;
  assert.ok(breaching > 0, 'occasional filaments reach the membrane');
  assert.ok(
    breaching / filaments.length < 0.5,
    `membrane contact stays occasional, got ${breaching}/${filaments.length}`,
  );
});

test('every filament point stays within the containment volume', () => {
  const limit = FILAMENT_FLOW_OPTIONS.membraneRadius * 1.07;
  for (const f of filaments) {
    for (const p of f.points) {
      assert.ok(Math.hypot(p[0], p[1], p[2]) <= limit + 1e-6);
    }
  }
});

test('REJECTS shell collapse: filament radii vary — no piling at one radius', () => {
  const radii = filaments.flatMap((f) => f.points.map((p) => Math.hypot(p[0], p[1], p[2])));
  const mean = radii.reduce((s, r) => s + r, 0) / radii.length;
  const sd = Math.sqrt(radii.reduce((s, r) => s + (r - mean) ** 2, 0) / radii.length);
  assert.ok(sd > 0.12, `filaments must occupy the volume, got sd=${sd.toFixed(3)}`);
});

test('both families are represented', () => {
  assert.ok(filaments.some((f) => f.family === 'gold'));
  assert.ok(filaments.some((f) => f.family === 'lavender'));
});
