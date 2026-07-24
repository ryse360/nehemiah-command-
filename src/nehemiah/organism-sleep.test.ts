import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SLEEP_TIMEOUT_MS,
  resolveIdleTimeoutMs,
  toSleepParameters,
} from './organism-sleep';
import { organismStateParameters } from './organism-parameters';

test('the idle timeout defaults to five minutes', () => {
  assert.equal(SLEEP_TIMEOUT_MS, 5 * 60 * 1000);
});

test('sleep dims every luminous quality of the organism', () => {
  const awake = organismStateParameters.resting;
  const asleep = toSleepParameters(awake);

  assert.ok(asleep.coreIntensity < awake.coreIntensity);
  assert.ok(asleep.goldIntensity < awake.goldIntensity);
  assert.ok(asleep.indigoIntensity < awake.indigoIntensity);
  assert.ok(asleep.lighting.ambientIntensity < awake.lighting.ambientIntensity);
  assert.ok(asleep.lighting.directionalIntensity < awake.lighting.directionalIntensity);
});

test('sleep slows and quiets the motion without stopping it', () => {
  const awake = organismStateParameters.resting;
  const asleep = toSleepParameters(awake);

  assert.ok(asleep.floatSpeed < awake.floatSpeed);
  assert.ok(asleep.floatAmplitude < awake.floatAmplitude);
  assert.ok(asleep.breathingSpeed < awake.breathingSpeed);
  // still breathing — a sleeping organism is alive, not switched off
  assert.ok(asleep.floatAmplitude > 0);
  assert.ok(asleep.breathingSpeed > 0);
  assert.ok(asleep.coreIntensity > 0);
});

test('sleep does not mutate the source parameters', () => {
  const awake = organismStateParameters.resting;
  const snapshot = JSON.parse(JSON.stringify(awake));
  toSleepParameters(awake);

  assert.deepEqual(awake, snapshot);
});

test('sleep leaves framing untouched — only mood changes', () => {
  const awake = organismStateParameters.resting;
  const asleep = toSleepParameters(awake);

  assert.deepEqual(asleep.camera, awake.camera);
  assert.equal(asleep.scale, awake.scale);
});

test('a valid positive override wins, otherwise the five-minute default holds', () => {
  assert.equal(resolveIdleTimeoutMs('3000'), 3000);
  assert.equal(resolveIdleTimeoutMs(null), SLEEP_TIMEOUT_MS);
  assert.equal(resolveIdleTimeoutMs('not-a-number'), SLEEP_TIMEOUT_MS);
  assert.equal(resolveIdleTimeoutMs('-5'), SLEEP_TIMEOUT_MS);
  assert.equal(resolveIdleTimeoutMs('0'), SLEEP_TIMEOUT_MS);
});
