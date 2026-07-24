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
  shellOpacity: number;
  coreIntensity: number;
  rotationDrift: number;
  camera: OrganismCameraParameters;
  lighting: OrganismLightingParameters;
  reducedMotion: OrganismReducedMotionParameters;
}

const restingRender = organismRenderModel.resting;
const restingCore = organismCoreModel.resting;

export const restingOrganismParameters: OrganismParameters = {
  scale: 1,
  breathingSpeed: restingRender.breathRate,
  breathingAmplitude: restingRender.breathAmplitude,
  particleCount: 160,
  particleSize: 1.55,
  particleVelocity: restingRender.particleSpeed,
  goldIntensity: restingRender.goldIntensity,
  indigoIntensity: 0.55,
  shellOpacity: restingRender.shellOpacity,
  coreIntensity: restingCore.emissiveIntensity,
  rotationDrift: restingRender.rotationSpeed,
  camera: {
    position: [0, 0, 6.4],
    fieldOfView: 38,
  },
  lighting: {
    ambientIntensity: 0.62,
    directionalIntensity: 1.18,
    hemisphereIntensity: 0.82,
  },
  reducedMotion: {
    motionScale: 0.12,
  },
};

export function resolveOrganismParameters(
  overrides?: Partial<OrganismParameters>,
): OrganismParameters {
  if (!overrides) {
    return restingOrganismParameters;
  }

  return {
    ...restingOrganismParameters,
    ...overrides,
    camera: { ...restingOrganismParameters.camera, ...overrides.camera },
    lighting: { ...restingOrganismParameters.lighting, ...overrides.lighting },
    reducedMotion: {
      ...restingOrganismParameters.reducedMotion,
      ...overrides.reducedMotion,
    },
  };
}
