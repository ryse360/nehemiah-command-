import test from 'node:test';
import assert from 'node:assert/strict';

import { orbParametersFromState } from './orb-parameters';
import { resolveStateParameters } from './organism-parameters';
import type { OrbStateDTO } from './orb-state';
import type { NehemiahState } from './state-machine';

function dto(overrides: Partial<OrbStateDTO> = {}): OrbStateDTO {
  return {
    operatingState: 'resting',
    nodeCount: 0,
    bands: { high: 0, medium: 0, low: 0 },
    recencyWeight: 0,
    intensity: 0.3,
    convergence: 0,
    openLoops: 0,
    settled: 0,
    ...overrides,
  };
}

const ALL_STATES: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

test('base geometry is the approved state geometry — design is not redrawn', () => {
  for (const state of ALL_STATES) {
    const base = resolveStateParameters(state);
    const mapped = orbParametersFromState(dto({ operatingState: state }));
    // The load-bearing shape/motion fields are taken verbatim from the approved
    // parameters; only a few bounded visual scalars are modulated.
    assert.deepEqual(mapped.camera, base.camera, `${state} camera unchanged`);
    assert.equal(mapped.scale, base.scale, `${state} scale unchanged`);
    assert.equal(mapped.coreBodyRadius, base.coreBodyRadius, `${state} core unchanged`);
    assert.equal(mapped.breathingSpeed, base.breathingSpeed, `${state} breath unchanged`);
    assert.equal(mapped.rotationDrift, base.rotationDrift, `${state} rotation unchanged`);
    assert.deepEqual(mapped.lighting, base.lighting, `${state} lighting unchanged`);
  }
});

test('particle count tracks node weight within a tight, bounded band', () => {
  const empty = orbParametersFromState(dto({ nodeCount: 0 }));
  const full = orbParametersFromState(dto({ nodeCount: 220 }));
  assert.ok(empty.particleCount >= 144 && empty.particleCount <= 240);
  assert.ok(full.particleCount >= 144 && full.particleCount <= 240);
  assert.ok(full.particleCount > empty.particleCount, 'more memory reads denser');
});

test('particle count is clamped even when the DTO is pushed past saturation', () => {
  const overloaded = orbParametersFromState(dto({ nodeCount: 100000 }));
  assert.ok(overloaded.particleCount <= 240, 'never exceeds the ceiling');
});

test('intensity nudges gold but keeps it within the approved envelope', () => {
  const cool = orbParametersFromState(dto({ operatingState: 'proof-created', intensity: 0 }));
  const hot = orbParametersFromState(dto({ operatingState: 'proof-created', intensity: 1 }));
  assert.ok(hot.goldIntensity > cool.goldIntensity, 'more energy reads brighter');
  assert.ok(hot.goldIntensity <= 2 && cool.goldIntensity >= 0, 'stays in range');
});

test('convergence only firms the reasoning field, never loosens the approved floor', () => {
  const base = resolveStateParameters('decision-required');
  // decision-required already converges fully; a lower DTO convergence must not
  // pull it below the approved value.
  const mapped = orbParametersFromState(dto({ operatingState: 'decision-required', convergence: 0 }));
  assert.ok(mapped.indigoConvergence >= base.indigoConvergence);
  assert.ok(mapped.indigoConvergence <= 1);
});

test('open loops lift indigo slightly and stay bounded', () => {
  const none = orbParametersFromState(dto({ openLoops: 0 }));
  const one = orbParametersFromState(dto({ openLoops: 1 }));
  assert.ok(one.indigoIntensity >= none.indigoIntensity);
  assert.ok(one.indigoIntensity <= 1.5);
});

test('mapping is pure and deterministic', () => {
  const input = dto({ operatingState: 'action-underway', nodeCount: 40, intensity: 0.6 });
  assert.deepEqual(orbParametersFromState(input), orbParametersFromState(input));
});
