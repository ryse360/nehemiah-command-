import type { NehemiahState } from './state-machine';

export interface OrganismRenderParameters {
  breathAmplitude: number;
  breathRate: number;
  rotationSpeed: number;
  particleSpeed: number;
  goldIntensity: number;
  threadOpacity: number;
  shellOpacity: number;
  ringOpacity: number;
}

export const organismRenderModel = {
  resting: {
    breathAmplitude: 0.035,
    breathRate: 0.72,
    rotationSpeed: 0.035,
    particleSpeed: 0.16,
    goldIntensity: 0.72,
    threadOpacity: 0.22,
    shellOpacity: 0.17,
    ringOpacity: 0.18,
  },
  listening: {
    breathAmplitude: 0.05,
    breathRate: 0.92,
    rotationSpeed: 0.045,
    particleSpeed: 0.22,
    goldIntensity: 0.88,
    threadOpacity: 0.32,
    shellOpacity: 0.19,
    ringOpacity: 0.23,
  },
  'focus-surfaced': {
    breathAmplitude: 0.025,
    breathRate: 0.62,
    rotationSpeed: 0.028,
    particleSpeed: 0.14,
    goldIntensity: 0.95,
    threadOpacity: 0.46,
    shellOpacity: 0.18,
    ringOpacity: 0.2,
  },
  'decision-required': {
    breathAmplitude: 0.02,
    breathRate: 0.54,
    rotationSpeed: 0.022,
    particleSpeed: 0.1,
    goldIntensity: 1.02,
    threadOpacity: 0.72,
    shellOpacity: 0.2,
    ringOpacity: 0.28,
  },
  'action-underway': {
    breathAmplitude: 0.055,
    breathRate: 1.08,
    rotationSpeed: 0.075,
    particleSpeed: 0.38,
    goldIntensity: 1.10,
    threadOpacity: 0.58,
    shellOpacity: 0.21,
    ringOpacity: 0.34,
  },
  'proof-created': {
    breathAmplitude: 0.018,
    breathRate: 0.48,
    rotationSpeed: 0.018,
    particleSpeed: 0.08,
    goldIntensity: 1.18,
    threadOpacity: 0.52,
    shellOpacity: 0.23,
    ringOpacity: 0.32,
  },
} satisfies Record<NehemiahState, OrganismRenderParameters>;
