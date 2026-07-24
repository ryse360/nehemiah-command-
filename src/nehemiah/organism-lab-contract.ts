import type { NehemiahState } from './state-machine';

// Tense-arc labels: five present-participle conditions, then one past-tense
// close. A decision, once proven, is a fact — the grammar breaks on purpose.
export const organismStateLabels: Record<NehemiahState, string> = {
  resting: 'BREATHING',
  listening: 'ATTENDING',
  'focus-surfaced': 'SURFACING',
  'decision-required': 'WEIGHING',
  'action-underway': 'ENACTING',
  'proof-created': 'WITNESSED',
};

export const ORGANISM_STATUS_LABEL = organismStateLabels.resting;

export interface LabCommandSurface {
  active: false;
  presence: 'dormant' | 'attentive';
  placeholder: string;
  helperText: string;
}

// The surface is never functionally wired in the laboratory. From listening
// onward it looks awake — a slow glow, no cursor, no hover response — but
// it must never look like it accepted input.
export const commandSurfaceByState: Record<NehemiahState, LabCommandSurface> = {
  resting: {
    active: false,
    presence: 'dormant',
    placeholder: 'Ask Nehemiah anything…',
    helperText: 'The command surface wakes in a later milestone.',
  },
  listening: {
    active: false,
    presence: 'attentive',
    placeholder: 'Ask Nehemiah anything…',
    helperText: 'The command surface wakes in a later milestone.',
  },
  'focus-surfaced': {
    active: false,
    presence: 'attentive',
    placeholder: 'Ask Nehemiah anything…',
    helperText: 'The command surface wakes in a later milestone.',
  },
  'decision-required': {
    active: false,
    presence: 'attentive',
    placeholder: 'Ask Nehemiah anything…',
    helperText: 'The command surface wakes in a later milestone.',
  },
  'action-underway': {
    active: false,
    presence: 'attentive',
    placeholder: 'Ask Nehemiah anything…',
    helperText: 'The command surface wakes in a later milestone.',
  },
  'proof-created': {
    active: false,
    presence: 'attentive',
    placeholder: 'Ask Nehemiah anything…',
    helperText: 'The command surface wakes in a later milestone.',
  },
};

export const restingLabCommandSurface: LabCommandSurface =
  commandSurfaceByState.resting;
