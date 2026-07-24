import type { NehemiahState } from './state-machine';
import { organismCoreModel } from './organism-core-model';
import { organismRenderModel } from './organism-render-model';

export interface OrganismCameraParameters {
  position: [number, number, number];
  fieldOfView: number;
}

export interface OrganismLightingParameters {
  ambientIntensity: number;
  directionalIntensity: number;
  hemisphereIntensity: number;
}

export interface OrganismReducedMotionParameters {
  motionScale: number;
}

export interface OrganismParameters {
  scale: number;
  breathingSpeed: number;
  breathingAmplitude: number;
  particleCount: number;
  particleSize: number;
  particleVelocity: number;
  goldIntensity: number;
  indigoIntensity: number;
  indigoConvergence: number;
  shellOpacity: number;
  coreIntensity: number;
  rotationDrift: number;
  camera: OrganismCameraParameters;
  lighting: OrganismLightingParameters;
  reducedMotion: OrganismReducedMotionParameters;
}

interface StateAccent {
  indigoIntensity: number;
  indigoConvergence: number;
  ambientIntensity: number;
  directionalIntensity: number;
}

// Indigo is the deliberation field: it hums at rest, gathers into a tight
// knot while the decision is weighed, then disperses as gold takes over.
// Light rises with the lifecycle so rest reads dim and proof reads lit.
const stateAccents: Record<NehemiahState, StateAccent> = {
  resting: {
    indigoIntensity: 0.55,
    indigoConvergence: 0,
    ambientIntensity: 0.62,
    directionalIntensity: 1.18,
  },
  listening: {
    indigoIntensity: 0.62,
    indigoConvergence: 0.15,
    ambientIntensity: 0.65,
    directionalIntensity: 1.2,
  },
  'focus-surfaced': {
    indigoIntensity: 0.68,
    indigoConvergence: 0.45,
    ambientIntensity: 0.67,
    directionalIntensity: 1.22,
  },
  'decision-required': {
    indigoIntensity: 0.85,
    indigoConvergence: 1,
    ambientIntensity: 0.68,
    directionalIntensity: 1.24,
  },
  'action-underway': {
    indigoIntensity: 0.35,
    indigoConvergence: 0.25,
    ambientIntensity: 0.7,
    directionalIntensity: 1.27,
  },
  'proof-created': {
    indigoIntensity: 0.15,
    indigoConvergence: 0.05,
    ambientIntensity: 0.73,
    directionalIntensity: 1.32,
  },
};

const lifecycleStates: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

function buildStateParameters(state: NehemiahState): OrganismParameters {
  const render = organismRenderModel[state];
  const core = organismCoreModel[state];
  const accent = stateAccents[state];

  return {
    scale: 1,
    breathingSpeed: render.breathRate,
    breathingAmplitude: render.breathAmplitude,
    particleCount: 160,
    particleSize: 1.55,
    particleVelocity: render.particleSpeed,
    goldIntensity: render.goldIntensity,
    indigoIntensity: accent.indigoIntensity,
    indigoConvergence: accent.indigoConvergence,
    shellOpacity: render.shellOpacity,
    coreIntensity: core.emissiveIntensity,
    rotationDrift: render.rotationSpeed,
    camera: {
      position: [0, 0, 6.4],
      fieldOfView: 38,
    },
    lighting: {
      ambientIntensity: accent.ambientIntensity,
      directionalIntensity: accent.directionalIntensity,
      hemisphereIntensity: 0.82,
    },
    reducedMotion: {
      motionScale: 0.12,
    },
  };
}

export const organismStateParameters = Object.fromEntries(
  lifecycleStates.map((state) => [state, buildStateParameters(state)]),
) as Record<NehemiahState, OrganismParameters>;

export const restingOrganismParameters: OrganismParameters =
  organismStateParameters.resting;

function mergeParameters(
  base: OrganismParameters,
  overrides?: Partial<OrganismParameters>,
): OrganismParameters {
  if (!overrides) {
    return base;
  }

  return {
    ...base,
    ...overrides,
    camera: { ...base.camera, ...overrides.camera },
    lighting: { ...base.lighting, ...overrides.lighting },
    reducedMotion: { ...base.reducedMotion, ...overrides.reducedMotion },
  };
}

export function resolveOrganismParameters(
  overrides?: Partial<OrganismParameters>,
): OrganismParameters {
  return mergeParameters(restingOrganismParameters, overrides);
}

export function resolveStateParameters(
  state: NehemiahState,
  overrides?: Partial<OrganismParameters>,
): OrganismParameters {
  return mergeParameters(organismStateParameters[state], overrides);
}
