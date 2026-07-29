import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ECOLOGY_OPTIONS,
  ecologyModulation,
  ecologyStateFor,
  organismEcology,
} from './organism-ecology';

const eco = organismEcology();

function radius(p: readonly [number, number, number]): number {
  return Math.hypot(p[0], p[1], p[2]);
}

test('the ecology is deterministic for a given seed', () => {
  const a = organismEcology();
  const b = organismEcology();
  assert.deepEqual(a.nodes[0], b.nodes[0]);
  assert.equal(a.nodes.length, b.nodes.length);
  assert.equal(a.links.length, b.links.length);
});

// --- the rejected failure modes, encoded as tests --------------------------

test('REJECTS shell wrapping: nodes fill a volume, not a sphere surface', () => {
  const radii = eco.nodes.map((n) => radius(n.position));
  const mean = radii.reduce((s, r) => s + r, 0) / radii.length;
  const variance = radii.reduce((s, r) => s + (r - mean) ** 2, 0) / radii.length;
  const sd = Math.sqrt(variance);
  // A Fibonacci shell has ~zero radial spread. A volume has substantial spread.
  assert.ok(sd > 0.12, `radial spread must be volumetric, got sd=${sd.toFixed(3)}`);
  // and the interior must genuinely be populated, not hollow
  const interior = radii.filter((r) => r < 0.45).length;
  assert.ok(
    interior / radii.length > 0.15,
    `interior must be populated, got ${((interior / radii.length) * 100).toFixed(1)}%`,
  );
});

test('REJECTS equal prominence: brightness follows a power law', () => {
  const bright = eco.nodes.filter((n) => n.brightness > 0.5).length;
  const faint = eco.nodes.filter((n) => n.brightness < 0.15).length;
  const fraction = bright / eco.nodes.length;
  assert.ok(fraction < 0.2, `few nodes may be luminous, got ${(fraction * 100).toFixed(1)}%`);
  assert.ok(faint > bright * 2, 'most nodes must be faint');
});

test('REJECTS uniform tessellation: density varies sharply between regions', () => {
  const counts = new Map<number, number>();
  for (const n of eco.nodes) counts.set(n.cluster, (counts.get(n.cluster) ?? 0) + 1);
  const values = [...counts.values()];
  const max = Math.max(...values);
  const min = Math.min(...values);
  // uniform distribution would make these nearly equal
  assert.ok(max > min * 2, `density must be organised, got max=${max} min=${min}`);
});

test('REJECTS exposed wireframe: links are sparse, weak, and intra-cluster only', () => {
  for (const link of eco.links) {
    assert.equal(
      eco.nodes[link.a].cluster,
      eco.nodes[link.b].cluster,
      'a link may never span two attractors',
    );
    assert.ok(link.strength <= 0.34, 'links stay weak — implied, not structural');
  }
  // far fewer links than nodes → tissue, not a net
  assert.ok(
    eco.links.length < eco.nodes.length,
    `links must stay sparse: ${eco.links.length} links vs ${eco.nodes.length} nodes`,
  );
});

test('REJECTS radial sunburst: macro paths are few and bowed, not straight spokes', () => {
  assert.ok(eco.paths.length <= 4, 'only a few macro paths stay readable');
  for (const path of eco.paths) {
    const start = path.points[0];
    const end = path.points[path.points.length - 1];
    const mid = path.points[Math.floor(path.points.length / 2)];
    const straightMid: readonly [number, number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2,
    ];
    const bow = Math.hypot(
      mid[0] - straightMid[0],
      mid[1] - straightMid[1],
      mid[2] - straightMid[2],
    );
    assert.ok(bow > 0.05, `path must bow, not run straight (bow=${bow.toFixed(3)})`);
  }
});

test('preserves negative space: a meaningful share of the volume stays quiet', () => {
  // sample a grid through the volume; count cells with no node nearby
  let empty = 0;
  let total = 0;
  for (let x = -0.8; x <= 0.8; x += 0.4) {
    for (let y = -0.8; y <= 0.8; y += 0.4) {
      for (let z = -0.8; z <= 0.8; z += 0.4) {
        total += 1;
        const near = eco.nodes.some(
          (n) =>
            Math.hypot(n.position[0] - x, n.position[1] - y, n.position[2] - z) < 0.2,
        );
        if (!near) empty += 1;
      }
    }
  }
  assert.ok(empty / total > 0.15, `quiet space must survive, got ${empty}/${total}`);
});

test('bridges connect only selected attractor pairs', () => {
  const possible = (eco.clusters.length * (eco.clusters.length - 1)) / 2;
  assert.ok(eco.bridges.length < possible / 2, 'only selected pairs bridge');
  for (const b of eco.bridges) {
    assert.notEqual(b.a, b.b);
    assert.ok(b.a < eco.clusters.length && b.b < eco.clusters.length);
  }
});

test('exactly one attractor is dormant, so surfacing has something to awaken', () => {
  assert.equal(eco.clusters.filter((c) => c.dormant).length, 1);
});

test('both cognition families are present and spatially separated', () => {
  const gold = eco.clusters.filter((c) => c.family === 'gold');
  const lav = eco.clusters.filter((c) => c.family === 'lavender');
  assert.ok(gold.length >= 3 && lav.length >= 2);
  const goldX = gold.reduce((s, c) => s + c.center[0], 0) / gold.length;
  const lavX = lav.reduce((s, c) => s + c.center[0], 0) / lav.length;
  // warm-left / cool-right composition from the approved reference
  assert.ok(lavX > goldX, 'the reasoning volume sits opposite the cognition mass');
});

test('every node stays inside the containment volume', () => {
  for (const n of eco.nodes) {
    assert.ok(radius(n.position) <= ECOLOGY_OPTIONS.extent + 1e-9);
  }
});

// --- state reorganisation ---------------------------------------------------

test('attending concentrates and orients on the primary attractor', () => {
  const m = ecologyModulation('attending', eco.clusters);
  const breathing = ecologyModulation('breathing', eco.clusters);
  assert.ok(m.clusterGain[0] > m.clusterGain[1], 'the primary attractor dominates');
  assert.ok(m.concentration > breathing.concentration, 'the system pulls inward');
});

test('surfacing awakens the dormant cluster and propagates', () => {
  const dormantIndex = eco.clusters.findIndex((c) => c.dormant);
  const asleep = ecologyModulation('surfacing', eco.clusters, 0);
  const awake = ecologyModulation('surfacing', eco.clusters, 1);
  assert.ok(
    awake.clusterGain[dormantIndex] > asleep.clusterGain[dormantIndex] * 5,
    'the dormant region genuinely wakes',
  );
  assert.ok(awake.flow > ecologyModulation('breathing', eco.clusters).flow, 'retrieval propagates');
});

test('weighing redistributes influence between two competing attractors', () => {
  const early = ecologyModulation('weighing', eco.clusters, 0.1);
  const late = ecologyModulation('weighing', eco.clusters, 0.6);
  const warmShift = late.clusterGain[0] - early.clusterGain[0];
  const coolShift = late.clusterGain[3] - early.clusterGain[3];
  // influence moves BETWEEN them — one rises as the other falls
  assert.ok(warmShift * coolShift < 0, 'the two attractors trade influence');
  assert.ok(late.tension > ecologyModulation('breathing', eco.clusters).tension);
});

test('breathing regulates without letting anything dominate', () => {
  const m = ecologyModulation('breathing', eco.clusters);
  const lit = m.clusterGain.filter((_, i) => !eco.clusters[i].dormant);
  const spread = Math.max(...lit) - Math.min(...lit);
  assert.ok(spread < 0.2, 'at rest no attractor dominates');
  assert.ok(m.concentration < 0.25, 'the system rests open, not clenched');
});

test('lifecycle states map onto the four ecology behaviours', () => {
  assert.equal(ecologyStateFor('resting'), 'breathing');
  assert.equal(ecologyStateFor('listening'), 'attending');
  assert.equal(ecologyStateFor('focus-surfaced'), 'surfacing');
  assert.equal(ecologyStateFor('decision-required'), 'weighing');
  assert.equal(ecologyStateFor('unknown-state'), 'breathing');
});
