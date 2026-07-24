import type { NehemiahState } from './state-machine';
import type { OrganismParameters } from './organism-parameters';

export const lifecycleOrder: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

export interface TransitionPersonality {
  holdSeconds: number;
  settleSeconds: number;
  overshoot: number;
  contraction: number;
}

export interface TransitionProgress {
  phase: 'hold' | 'settle' | 'complete';
  blend: number;
  scaleFactor: number;
}

export function stateDistance(from: NehemiahState, to: NehemiahState): number {
  return Math.abs(lifecycleOrder.indexOf(to) - lifecycleOrder.indexOf(from));
}

// Every state change is a held breath: a brief contraction and stillness,
// then the new rhythm settles in with an overshoot scaled to how far the
// organism traveled. Leaving a decision holds longest — decisions carry
// weight. Under reduced motion only a short, plain settle remains.
export function resolveTransitionPersonality(
  from: NehemiahState,
  to: NehemiahState,
  reducedMotion: boolean,
): TransitionPersonality {
  if (from === to) {
    return { holdSeconds: 0, settleSeconds: 0, overshoot: 0, contraction: 0 };
  }

  if (reducedMotion) {
    return { holdSeconds: 0, settleSeconds: 0.25, overshoot: 0, contraction: 0 };
  }

  const distance = stateDistance(from, to);
  const holdSeconds =
    0.3 + 0.08 * (distance - 1) + (from === 'decision-required' ? 0.55 : 0);

  return {
    holdSeconds,
    settleSeconds: 0.9 + 0.15 * (distance - 1),
    overshoot: Math.min(0.18, 0.045 * distance),
    contraction: 0.035,
  };
}

// Sleep settles slowly, like a long exhale; waking is gentler still but
// quicker, so a touch brings the organism back without a jolt.
export function sleepTransitionPersonality(reducedMotion: boolean): TransitionPersonality {
  if (reducedMotion) {
    return { holdSeconds: 0, settleSeconds: 0.35, overshoot: 0, contraction: 0 };
  }
  return { holdSeconds: 0, settleSeconds: 2.6, overshoot: 0, contraction: 0.02 };
}

export function wakeTransitionPersonality(reducedMotion: boolean): TransitionPersonality {
  if (reducedMotion) {
    return { holdSeconds: 0, settleSeconds: 0.25, overshoot: 0, contraction: 0 };
  }
  return { holdSeconds: 0, settleSeconds: 1.1, overshoot: 0.05, contraction: 0 };
}

// The minimum time the organism must visibly inhabit a state before it can
// be moved on. Action must be seen to take time — an instantly skipped
// action-underway would prove no action occurred.
export function requiredDwellSeconds(state: NehemiahState): number {
  return state === 'action-underway' ? 1.2 : 0.35;
}

function easeOutBack(t: number, overshoot: number): number {
  const c1 = 1.70158 * (overshoot * 10);
  const c3 = c1 + 1;
  const shifted = t - 1;

  return 1 + c3 * shifted * shifted * shifted + c1 * shifted * shifted;
}

export function transitionProgress(
  personality: TransitionPersonality,
  elapsedSeconds: number,
): TransitionProgress {
  const { holdSeconds, settleSeconds, overshoot, contraction } = personality;

  if (elapsedSeconds >= holdSeconds + settleSeconds) {
    return { phase: 'complete', blend: 1, scaleFactor: 1 };
  }

  if (elapsedSeconds < holdSeconds) {
    const holdProgress = holdSeconds === 0 ? 0 : elapsedSeconds / holdSeconds;
    const dip = Math.sin(Math.PI * holdProgress);

    return {
      phase: 'hold',
      blend: 0,
      scaleFactor: 1 - contraction * dip,
    };
  }

  const settleProgress =
    settleSeconds === 0 ? 1 : (elapsedSeconds - holdSeconds) / settleSeconds;
  const releaseDip = Math.max(0, 1 - settleProgress * 3);

  return {
    phase: 'settle',
    blend: easeOutBack(Math.min(1, settleProgress), overshoot),
    scaleFactor: 1 - contraction * releaseDip,
  };
}

function lerp(from: number, to: number, blend: number): number {
  return from + (to - from) * blend;
}

export function blendOrganismParameters(
  from: OrganismParameters,
  to: OrganismParameters,
  blend: number,
): OrganismParameters {
  if (blend <= 0) {
    return from;
  }
  if (blend >= 1) {
    return to;
  }

  return {
    scale: lerp(from.scale, to.scale, blend),
    breathingSpeed: lerp(from.breathingSpeed, to.breathingSpeed, blend),
    breathingAmplitude: lerp(from.breathingAmplitude, to.breathingAmplitude, blend),
    particleCount: Math.round(lerp(from.particleCount, to.particleCount, blend)),
    particleSize: lerp(from.particleSize, to.particleSize, blend),
    particleVelocity: lerp(from.particleVelocity, to.particleVelocity, blend),
    goldIntensity: lerp(from.goldIntensity, to.goldIntensity, blend),
    indigoIntensity: lerp(from.indigoIntensity, to.indigoIntensity, blend),
    indigoConvergence: lerp(from.indigoConvergence, to.indigoConvergence, blend),
    shellOpacity: lerp(from.shellOpacity, to.shellOpacity, blend),
    coreIntensity: lerp(from.coreIntensity, to.coreIntensity, blend),
    rotationDrift: lerp(from.rotationDrift, to.rotationDrift, blend),
    floatAmplitude: lerp(from.floatAmplitude, to.floatAmplitude, blend),
    floatSpeed: lerp(from.floatSpeed, to.floatSpeed, blend),
    camera: {
      position: [
        lerp(from.camera.position[0], to.camera.position[0], blend),
        lerp(from.camera.position[1], to.camera.position[1], blend),
        lerp(from.camera.position[2], to.camera.position[2], blend),
      ],
      fieldOfView: lerp(from.camera.fieldOfView, to.camera.fieldOfView, blend),
    },
    lighting: {
      ambientIntensity: lerp(
        from.lighting.ambientIntensity,
        to.lighting.ambientIntensity,
        blend,
      ),
      directionalIntensity: lerp(
        from.lighting.directionalIntensity,
        to.lighting.directionalIntensity,
        blend,
      ),
      hemisphereIntensity: lerp(
        from.lighting.hemisphereIntensity,
        to.lighting.hemisphereIntensity,
        blend,
      ),
    },
    reducedMotion: {
      motionScale: lerp(
        from.reducedMotion.motionScale,
        to.reducedMotion.motionScale,
        blend,
      ),
    },
  };
}
