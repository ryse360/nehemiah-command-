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
