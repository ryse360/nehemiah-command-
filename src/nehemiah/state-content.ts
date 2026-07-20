import type { NehemiahState } from './state-machine.ts';

export type VisibleRegion =
  | 'identity'
  | 'organism'
  | 'command'
  | 'focus'
  | 'decision'
  | 'action'
  | 'proof';

export interface DecisionSection {
  label: string;
  body: string;
}

export interface StateContent {
  state: NehemiahState;
  primaryPrompt: string;
  visibleRegions: VisibleRegion[];
  decisionVisible: boolean;
  organismIntent:
    | 'breathe'
    | 'orient'
    | 'converge'
    | 'surface'
    | 'flow'
    | 'settle';
  focus?: {
    label: "TODAY'S FOCUS";
    body: string;
    why: string;
    protectedWindow: string;
  };
  decision?: {
    title: string;
    sections: DecisionSection[];
    cta: 'OPEN DECISION';
  };
  actionMessage?: string;
  proofMessage?: string;
}

const decisionSections: DecisionSection[] = [
  {
    label: 'WHY THIS SURFACED',
    body: 'The pilot team is blocked. Scope approval is the final Founder-only decision.',
  },
  {
    label: 'WHAT COULD BECOME POSSIBLE',
    body: 'A unified intelligence layer that simplifies every coaching experience.',
  },
  {
    label: 'THE TRADEOFF',
    body: 'Two weeks of focused build time and one paused lower-priority initiative.',
  },
  {
    label: 'VISIBLE ACTION',
    body: 'Approve or revise the pilot scope and assign product and engineering ownership.',
  },
  {
    label: 'PROOF REQUIRED',
    body: 'Pilot launched within 30 days with no critical failures and documented decisions.',
  },
];

const stateContent: Record<NehemiahState, StateContent> = {
  resting: {
    state: 'resting',
    primaryPrompt: 'What matters most now?',
    visibleRegions: ['identity', 'organism', 'command'],
    decisionVisible: false,
    organismIntent: 'breathe',
  },
  listening: {
    state: 'listening',
    primaryPrompt: 'I am listening.',
    visibleRegions: ['identity', 'organism', 'command'],
    decisionVisible: false,
    organismIntent: 'orient',
  },
  'focus-surfaced': {
    state: 'focus-surfaced',
    primaryPrompt: 'This matters most now.',
    visibleRegions: ['identity', 'organism', 'command', 'focus'],
    decisionVisible: false,
    organismIntent: 'converge',
    focus: {
      label: "TODAY'S FOCUS",
      body: 'Remove the decision preventing Product from proceeding.',
      why: 'One Founder-only decision is blocking Product and Engineering from moving together.',
      protectedWindow: '7:30–9:30 a.m. · Deep work · No meetings',
    },
  },
  'decision-required': {
    state: 'decision-required',
    primaryPrompt: 'This requires your decision.',
    visibleRegions: ['identity', 'organism', 'command', 'focus', 'decision'],
    decisionVisible: true,
    organismIntent: 'surface',
    focus: {
      label: "TODAY'S FOCUS",
      body: 'Remove the decision preventing Product from proceeding.',
      why: 'One Founder-only decision is blocking Product and Engineering from moving together.',
      protectedWindow: '7:30–9:30 a.m. · Deep work · No meetings',
    },
    decision: {
      title: 'Authorize Platform v2 Restricted Pilot',
      sections: decisionSections,
      cta: 'OPEN DECISION',
    },
  },
  'action-underway': {
    state: 'action-underway',
    primaryPrompt: 'The decision is in action.',
    visibleRegions: ['identity', 'organism', 'command', 'action'],
    decisionVisible: false,
    organismIntent: 'flow',
    actionMessage: 'Product and Engineering are executing the approved pilot boundary.',
  },
  'proof-created': {
    state: 'proof-created',
    primaryPrompt: 'The direction now has proof.',
    visibleRegions: ['identity', 'organism', 'command', 'proof'],
    decisionVisible: false,
    organismIntent: 'settle',
    proofMessage: 'Proof change is possible.',
  },
};

export function getStateContent(state: NehemiahState): StateContent {
  return stateContent[state];
}
