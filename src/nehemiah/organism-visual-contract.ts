import type { NehemiahState } from './state-machine';

export interface OrganismVisualProfile {
  continuouslyAlive: true;
  motionIntensity:
    | 'low'
    | 'attentive'
    | 'coherent'
    | 'focused'
    | 'directional'
    | 'resolved';
  coreEmphasis:
    | 'quiet'
    | 'attentive'
    | 'organized'
    | 'decisive'
    | 'active'
    | 'resolved';
  goldEmphasis:
    | 'restrained'
    | 'subtle'
    | 'moderate'
    | 'focused'
    | 'active'
    | 'strong';
}

export const organismVisualContract = {
  resting: {
    continuouslyAlive: true,
    motionIntensity: 'low',
    coreEmphasis: 'quiet',
    goldEmphasis: 'restrained',
  },
  listening: {
    continuouslyAlive: true,
    motionIntensity: 'attentive',
    coreEmphasis: 'attentive',
    goldEmphasis: 'subtle',
  },
  'focus-surfaced': {
    continuouslyAlive: true,
    motionIntensity: 'coherent',
    coreEmphasis: 'organized',
    goldEmphasis: 'moderate',
  },
  'decision-required': {
    continuouslyAlive: true,
    motionIntensity: 'focused',
    coreEmphasis: 'decisive',
    goldEmphasis: 'focused',
  },
  'action-underway': {
    continuouslyAlive: true,
    motionIntensity: 'directional',
    coreEmphasis: 'active',
    goldEmphasis: 'active',
  },
  'proof-created': {
    continuouslyAlive: true,
    motionIntensity: 'resolved',
    coreEmphasis: 'resolved',
    goldEmphasis: 'strong',
  },
} satisfies Record<NehemiahState, OrganismVisualProfile>;
