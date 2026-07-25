import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GLOBE_BUCKETS,
  GLOBE_HUB,
  GLOBE_MID,
  globeBucketIndex,
  globeColorRole,
  globeNodePriority,
  globeTwinklePhase,
} from './organism-globe-model';

test('every size lands in exactly one bucket', () => {
  for (const size of [0, 0.1, 0.39, 0.4, 0.5, 0.74, 0.75, 0.9, 1, 1.5]) {
    const matches = GLOBE_BUCKETS.filter((b) => size >= b.min && size < b.max);
    assert.equal(matches.length, 1, `size ${size} in exactly one bucket`);
    assert.equal(globeBucketIndex(size), GLOBE_BUCKETS.indexOf(matches[0]));
  }
});

test('bucket, colour, and priority agree at the class boundaries', () => {
  // The bug this guards: bucket used `< max` while colour/priority used
  // `> 0.75`, so 0.75 landed in the hub BUCKET but got MID colour/priority.
  // At exactly GLOBE_HUB: hub bucket (index 2), gold-hot, priority 1.
  assert.equal(globeBucketIndex(GLOBE_HUB), 2);
  assert.equal(globeColorRole({ size: GLOBE_HUB, family: 'gold' }), 'gold-hot');
  assert.equal(globeNodePriority(GLOBE_HUB), 1);

  // At exactly GLOBE_MID: mid bucket (index 1), gold-mid, priority 0.35.
  assert.equal(globeBucketIndex(GLOBE_MID), 1);
  assert.equal(globeColorRole({ size: GLOBE_MID, family: 'gold' }), 'gold-mid');
  assert.equal(globeNodePriority(GLOBE_MID), 0.35);

  // Just below each boundary drops a class.
  assert.equal(globeBucketIndex(GLOBE_HUB - 1e-6), 1);
  assert.equal(globeColorRole({ size: GLOBE_HUB - 1e-6, family: 'gold' }), 'gold-mid');
  assert.equal(globeBucketIndex(GLOBE_MID - 1e-6), 0);
  assert.equal(globeNodePriority(GLOBE_MID - 1e-6), 0);
});

test('lavender family overrides size for colour', () => {
  assert.equal(globeColorRole({ size: 0.9, family: 'lavender' }), 'lavender');
  assert.equal(globeColorRole({ size: 0.1, family: 'lavender' }), 'lavender');
});

test('priority rises with class: fine 0, mid 0.35, hub 1', () => {
  assert.equal(globeNodePriority(0.2), 0);
  assert.equal(globeNodePriority(0.5), 0.35);
  assert.equal(globeNodePriority(0.9), 1);
});

test('twinkle phase is deterministic and in [0,1]', () => {
  const p1 = globeTwinklePhase([0.3, -0.5, 0.1]);
  const p2 = globeTwinklePhase([0.3, -0.5, 0.1]);
  assert.equal(p1, p2, 'same position → same phase');
  for (const pos of [[0, 0, 0], [0.94, 0, 0], [-0.5, 0.7, -0.2], [0.33, 0.33, 0.33]] as const) {
    const phase = globeTwinklePhase(pos);
    assert.ok(phase >= 0 && phase <= 1, `phase ${phase} in [0,1]`);
  }
  // distinct positions generally differ (not a constant)
  assert.notEqual(globeTwinklePhase([0.1, 0.2, 0]), globeTwinklePhase([0.7, -0.3, 0]));
});
