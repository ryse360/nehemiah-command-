import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blendOrganismParameters,
  requiredDwellSeconds,
  resolveTransitionPersonality,
  sleepTransitionPersonality,
  stateDistance,
  transitionProgress,
  wakeTransitionPersonality,
} from './organism-transition';
import { organismStateParameters } from './organism-parameters';

test('state distance measures steps along the lifecycle', () => {
  assert.equal(stateDistance('resting', 'resting'), 0);
  assert.equal(stateDistance('resting', 'listening'), 1);
  assert.equal(stateDistance('resting', 'proof-created'), 5);
  assert.equal(stateDistance('proof-created', 'resting'), 5);
});

test('every transition begins with a held-breath stillness', () => {
  const personality = resolveTransitionPersonality('resting', 'listening', false);

  assert.ok(personality.holdSeconds > 0);
  assert.ok(personality.settleSeconds > 0);
  assert.ok(personality.contraction > 0);
});

test('leaving a decision carries more weight than any other departure', () => {
  const leavingDecision = resolveTransitionPersonality(
    'decision-required',
    'action-underway',
    false,
  );
  const ordinary = resolveTransitionPersonality('resting', 'listening', false);

  assert.ok(leavingDecision.holdSeconds > ordinary.holdSeconds);
});

test('distant transitions overshoot more than adjacent ones', () => {
  const near = resolveTransitionPersonality('resting', 'listening', false);
  const far = resolveTransitionPersonality('resting', 'proof-created', false);

  assert.ok(far.overshoot > near.overshoot);
});

test('reduced motion removes the hold, the overshoot, and the contraction', () => {
  const personality = resolveTransitionPersonality(
    'decision-required',
    'action-underway',
    true,
  );

  assert.equal(personality.holdSeconds, 0);
  assert.equal(personality.overshoot, 0);
  assert.equal(personality.contraction, 0);
  assert.ok(personality.settleSeconds > 0, 'still settles, just quickly');
});

test('action underway cannot be skipped instantly', () => {
  assert.ok(requiredDwellSeconds('action-underway') > requiredDwellSeconds('resting'));
  assert.ok(requiredDwellSeconds('action-underway') >= 1);
});

test('progress holds still, then settles, then completes', () => {
  const personality = resolveTransitionPersonality('resting', 'listening', false);

  const during = transitionProgress(personality, personality.holdSeconds / 2);
  assert.equal(during.phase, 'hold');
  assert.equal(during.blend, 0);
  assert.ok(during.scaleFactor < 1, 'organism contracts during the held breath');

  const later = transitionProgress(
    personality,
    personality.holdSeconds + personality.settleSeconds / 2,
  );
  assert.equal(later.phase, 'settle');
  assert.ok(later.blend > 0);

  const done = transitionProgress(
    personality,
    personality.holdSeconds + personality.settleSeconds + 0.01,
  );
  assert.equal(done.phase, 'complete');
  assert.equal(done.blend, 1);
  assert.equal(done.scaleFactor, 1);
});

test('falling asleep is slower and gentler than waking up', () => {
  const sleep = sleepTransitionPersonality(false);
  const wake = wakeTransitionPersonality(false);

  assert.ok(sleep.settleSeconds > wake.settleSeconds, 'drifting off takes its time');
  assert.equal(sleep.overshoot, 0, 'no bounce when settling into sleep');
  assert.ok(wake.settleSeconds > 0);
});

test('reduced motion still allows a short, plain sleep and wake', () => {
  const sleep = sleepTransitionPersonality(true);
  const wake = wakeTransitionPersonality(true);

  assert.equal(sleep.holdSeconds, 0);
  assert.equal(sleep.overshoot, 0);
  assert.ok(sleep.settleSeconds > 0);
  assert.ok(wake.settleSeconds > 0);
});

test('the held breath hands off to the settle without a scale snap', () => {
  const personalities = [
    resolveTransitionPersonality('resting', 'listening', false),
    resolveTransitionPersonality('decision-required', 'action-underway', false),
  ];

  for (const personality of personalities) {
    const total = personality.holdSeconds + personality.settleSeconds;
    let previous = transitionProgress(personality, 0).scaleFactor;

    for (let elapsed = 1 / 120; elapsed <= total; elapsed += 1 / 120) {
      const current = transitionProgress(personality, elapsed).scaleFactor;
      assert.ok(
        Math.abs(current - previous) < 0.004,
        `scale jumped ${Math.abs(current - previous).toFixed(4)} at t=${elapsed.toFixed(3)}`,
      );
      previous = current;
    }
  }
});

test('overshoot actually carries the organism past the target before settling', () => {
  const from = organismStateParameters.resting;
  const to = organismStateParameters['proof-created'];

  // easeOutBack returns values above 1 mid-settle. If the blend clamps at 1,
  // that overshoot is silently discarded and every transition personality's
  // `overshoot` field is decoration.
  const past = blendOrganismParameters(from, to, 1.08);
  assert.ok(
    past.goldIntensity > to.goldIntensity,
    'a blend past 1 must overshoot the target, not clamp to it',
  );

  const personality = resolveTransitionPersonality('resting', 'proof-created', false);
  const total = personality.holdSeconds + personality.settleSeconds;
  let sawOvershoot = false;
  for (let elapsed = 0; elapsed <= total; elapsed += 1 / 120) {
    const progress = transitionProgress(personality, elapsed);
    const blended = blendOrganismParameters(from, to, progress.blend);
    if (blended.goldIntensity > to.goldIntensity + 1e-9) {
      sawOvershoot = true;
      break;
    }
  }
  assert.ok(sawOvershoot, 'the settle must visibly overshoot at least once');
});

test('overshoot never drives a parameter below zero', () => {
  const from = organismStateParameters['proof-created'];
  const to = organismStateParameters.resting;
  const past = blendOrganismParameters(from, to, 1.2);

  assert.ok(past.goldIntensity >= 0);
  assert.ok(past.indigoIntensity >= 0);
  assert.ok(past.coreIntensity >= 0);
  assert.ok(past.particleCount >= 0);
  assert.ok(past.shellOpacity >= 0);
});

test('blending endpoints reproduce the exact state parameters', () => {
  const from = organismStateParameters.resting;
  const to = organismStateParameters['decision-required'];

  assert.deepEqual(blendOrganismParameters(from, to, 0), from);
  assert.deepEqual(blendOrganismParameters(from, to, 1), to);
});

test('mid-blend interpolates numeric fields including nested ones', () => {
  const from = organismStateParameters.resting;
  const to = organismStateParameters['proof-created'];
  const mid = blendOrganismParameters(from, to, 0.5);

  assert.ok(mid.goldIntensity > from.goldIntensity);
  assert.ok(mid.goldIntensity < to.goldIntensity);
  assert.equal(
    mid.lighting.ambientIntensity,
    (from.lighting.ambientIntensity + to.lighting.ambientIntensity) / 2,
  );
});
