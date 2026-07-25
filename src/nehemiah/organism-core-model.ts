import type { NehemiahState } from './state-machine';

export interface OrganismCoreParameters {
  bodyRadius: number;
  haloRadius: number;
  kernelRadius: number;
  pulseAmplitude: number;
  pulseRate: number;
  emissiveIntensity: number;
  haloOpacity: number;
  pointLightIntensity: number;
}

export const organismCoreModel = {
  resting: {
    bodyRadius: 0.38,
    haloRadius: 0.7,
    kernelRadius: 0.105,
    pulseAmplitude: 0.026,
    pulseRate: 0.82,
    emissiveIntensity: 1.55,
    haloOpacity: 0.16,
    pointLightIntensity: 3.2,
  },
  listening: {
    bodyRadius: 0.39,
    haloRadius: 0.73,
    kernelRadius: 0.11,
    pulseAmplitude: 0.034,
    pulseRate: 1.02,
    emissiveIntensity: 1.95,
    haloOpacity: 0.19,
    pointLightIntensity: 4.25,
  },
  'focus-surfaced': {
    bodyRadius: 0.385,
    haloRadius: 0.72,
    kernelRadius: 0.108,
    pulseAmplitude: 0.018,
    pulseRate: 0.66,
    emissiveIntensity: 2.15,
    haloOpacity: 0.2,
    pointLightIntensity: 4.5,
  },
  'decision-required': {
    bodyRadius: 0.4,
    haloRadius: 0.76,
    kernelRadius: 0.115,
    pulseAmplitude: 0.015,
    pulseRate: 0.56,
    emissiveIntensity: 2.55,
    haloOpacity: 0.23,
    pointLightIntensity: 5.35,
  },
  'action-underway': {
    bodyRadius: 0.405,
    haloRadius: 0.8,
    kernelRadius: 0.12,
    pulseAmplitude: 0.042,
    pulseRate: 1.16,
    emissiveIntensity: 2.35,
    haloOpacity: 0.25,
    pointLightIntensity: 6.1,
  },
  'proof-created': {
    bodyRadius: 0.4,
    haloRadius: 0.84,
    kernelRadius: 0.122,
    pulseAmplitude: 0.013,
    pulseRate: 0.48,
    emissiveIntensity: 2.6,
    haloOpacity: 0.28,
    pointLightIntensity: 6.8,
  },
} satisfies Record<NehemiahState, OrganismCoreParameters>;
