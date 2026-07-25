import test from 'node:test';
import assert from 'node:assert/strict';
import {
  organismStateParameters,
  restingOrganismParameters,
  resolveOrganismParameters,
  resolveStateParameters,
} from './organism-parameters';
import type { NehemiahState } from './state-machine';

const states: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

test('resting parameters stay restrained and alive', () => {
  const resting = restingOrganismParameters;

  assert.ok(resting.breathingAmplitude > 0);
  assert.ok(resting.rotationDrift > 0);
  assert.ok(resting.goldIntensity < 1);
  assert.ok(resting.indigoIntensity > 0 && resting.indigoIntensity < resting.goldIntensity + 1);
  assert.ok(resting.particleCount > 0);
  assert.ok(resting.particleSize > 0);
});

test('gold remains the dominant intelligence path over indigo at rest', () => {
  assert.ok(
    restingOrganismParameters.goldIntensity >= restingOrganismParameters.indigoIntensity,
  );
});

test('camera and lighting values are centralized on the parameter model', () => {
  assert.equal(restingOrganismParameters.camera.position.length, 3);
  assert.ok(restingOrganismParameters.camera.fieldOfView > 0);
  assert.ok(restingOrganismParameters.lighting.ambientIntensity > 0);
});

test('reduced-motion values are part of the centralized model', () => {
  assert.ok(restingOrganismParameters.reducedMotion.motionScale > 0);
  assert.ok(restingOrganismParameters.reducedMotion.motionScale < 1);
});

test('resolveOrganismParameters returns defaults with no overrides', () => {
  assert.deepEqual(resolveOrganismParameters(), restingOrganismParameters);
});

test('resolveOrganismParameters merges partial overrides without losing other values', () => {
  const resolved = resolveOrganismParameters({ goldIntensity: 0.9 });

  assert.equal(resolved.goldIntensity, 0.9);
  assert.equal(resolved.indigoIntensity, restingOrganismParameters.indigoIntensity);
  assert.deepEqual(resolved.camera, restingOrganismParameters.camera);
});

test('resolveOrganismParameters merges nested camera overrides', () => {
  const resolved = resolveOrganismParameters({
    camera: { position: [0, 0, 8], fieldOfView: 38 },
  });

  assert.deepEqual(resolved.camera.position, [0, 0, 8]);
  assert.equal(resolved.lighting.ambientIntensity, restingOrganismParameters.lighting.ambientIntensity);
});

test('every lifecycle state has centralized parameters', () => {
  for (const state of states) {
    const parameters = organismStateParameters[state];
    assert.ok(parameters.breathingSpeed > 0);
    assert.ok(parameters.goldIntensity > 0);
    assert.ok(parameters.indigoIntensity >= 0);
    assert.ok(parameters.indigoConvergence >= 0 && parameters.indigoConvergence <= 1);
  }
});

test('the resting entry is the same object the resting milestone shipped with', () => {
  assert.deepEqual(organismStateParameters.resting, restingOrganismParameters);
});

test('gold rises monotonically toward proof', () => {
  for (let index = 1; index < states.length; index += 1) {
    assert.ok(
      organismStateParameters[states[index]].goldIntensity >=
        organismStateParameters[states[index - 1]].goldIntensity,
      `gold must not dip between ${states[index - 1]} and ${states[index]}`,
    );
  }
});

test('indigo peaks and converges at the decision, then disperses', () => {
  const decision = organismStateParameters['decision-required'];

  for (const state of states.filter((s) => s !== 'decision-required')) {
    assert.ok(
      decision.indigoIntensity > organismStateParameters[state].indigoIntensity,
      `indigo at decision must exceed ${state}`,
    );
    assert.ok(
      decision.indigoConvergence > organismStateParameters[state].indigoConvergence,
      `indigo convergence at decision must exceed ${state}`,
    );
  }

  assert.ok(
    organismStateParameters['proof-created'].indigoIntensity <
      organismStateParameters.resting.indigoIntensity,
    'by proof, indigo has receded below its resting hum',
  );
});

test('the organism is dimmest at rest and brightest at proof', () => {
  assert.ok(
    organismStateParameters.resting.coreIntensity <
      organismStateParameters['proof-created'].coreIntensity,
  );
  assert.ok(
    organismStateParameters.resting.lighting.ambientIntensity <=
      organismStateParameters['proof-created'].lighting.ambientIntensity,
  );
});

test('per-state core shape and pulse reach the parameter model', () => {
  // These were read from organismCoreModel.resting inside the renderer, so
  // five of the eight per-state core values never affected anything. They
  // must differ across the lifecycle or the focal point is frozen again.
  const distinct = (pick: (p: (typeof organismStateParameters)['resting']) => number) =>
    new Set(states.map((state) => pick(organismStateParameters[state]))).size;

  assert.ok(distinct((p) => p.coreBodyRadius) > 1, 'core body radius varies by state');
  assert.ok(distinct((p) => p.coreHaloRadius) > 1, 'core halo radius varies by state');
  assert.ok(distinct((p) => p.corePulseRate) > 1, 'core pulse rate varies by state');
  assert.ok(
    distinct((p) => p.corePulseAmplitude) > 1,
    'core pulse amplitude varies by state',
  );

  for (const state of states) {
    const parameters = organismStateParameters[state];
    assert.ok(parameters.coreBodyRadius > 0);
    assert.ok(parameters.coreKernelRadius > 0);
    assert.ok(parameters.coreHaloOpacity > 0);
  }
});

test('the decision holds its breath while action quickens it', () => {
  assert.ok(
    organismStateParameters['decision-required'].corePulseRate <
      organismStateParameters['action-underway'].corePulseRate,
  );
});

test('resolveStateParameters merges overrides onto the requested state', () => {
  const resolved = resolveStateParameters('decision-required', { goldIntensity: 2 });

  assert.equal(resolved.goldIntensity, 2);
  assert.equal(
    resolved.indigoIntensity,
    organismStateParameters['decision-required'].indigoIntensity,
  );
  assert.deepEqual(
    resolveStateParameters('listening'),
    organismStateParameters.listening,
  );
});
