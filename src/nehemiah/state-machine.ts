export type NehemiahState =
  | 'resting'
  | 'listening'
  | 'focus-surfaced'
  | 'decision-required'
  | 'action-underway'
  | 'proof-created';

export type NehemiahEvent =
  | 'input-started'
  | 'focus-identified'
  | 'decision-justified'
  | 'decision-approved'
  | 'proof-received'
  | 'review-closed';

const transitions: Record<NehemiahState, Partial<Record<NehemiahEvent, NehemiahState>>> = {
  resting: {
    'input-started': 'listening',
  },
  listening: {
    'focus-identified': 'focus-surfaced',
  },
  'focus-surfaced': {
    'decision-justified': 'decision-required',
  },
  'decision-required': {
    'decision-approved': 'action-underway',
  },
  'action-underway': {
    'proof-received': 'proof-created',
  },
  'proof-created': {
    'review-closed': 'resting',
  },
};

export function transitionState(
  current: NehemiahState,
  event: NehemiahEvent,
): NehemiahState {
  const next = transitions[current][event];

  if (!next) {
    throw new Error(`Invalid Nehemiah transition: ${current} + ${event}`);
  }

  return next;
}
