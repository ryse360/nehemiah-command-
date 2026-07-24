import test from 'node:test';
import assert from 'node:assert/strict';
import {
  restingOrganismParameters,
  resolveOrganismParameters,
} from './organism-parameters';

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
