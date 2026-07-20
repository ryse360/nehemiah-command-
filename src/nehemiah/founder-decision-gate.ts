import type { DecisionDisposition } from './founder-journey';
import type { FounderDecisionReadiness } from './founder-decision-readiness';

export type FounderDecisionGateStatus = 'open' | 'conditional' | 'blocked';

export type FounderDecisionGate = {
  status: FounderDecisionGateStatus;
  canOpenDecision: boolean;
  allowedDispositions: DecisionDisposition[];
  message: string;
  requirement?: string;
};

const allDispositions: DecisionDisposition[] = [
  'approve',
  'approve-with-limits',
  'request-evidence',
  'delay',
  'reject',
];

export function buildFounderDecisionGate(
  readiness: FounderDecisionReadiness,
): FounderDecisionGate {
  if (readiness.status === 'ready') {
    return {
      status: 'open',
      canOpenDecision: true,
      allowedDispositions: allDispositions,
      message: 'The decision gate is open. The matter is prepared for Founder judgment.',
    };
  }

  if (readiness.status === 'conditional') {
    return {
      status: 'conditional',
      canOpenDecision: true,
      allowedDispositions: [
        'approve-with-limits',
        'request-evidence',
        'delay',
        'reject',
      ],
      message: 'The decision may proceed only with explicit limits protecting the unresolved conditions.',
      requirement: readiness.nextRequirement,
    };
  }

  return {
    status: 'blocked',
    canOpenDecision: false,
    allowedDispositions: ['request-evidence', 'delay', 'reject'],
    message: 'Nehemiah must continue preparing this matter before approval can be placed before the Founder.',
    requirement: readiness.nextRequirement,
  };
}

export function dispositionIsAllowed(
  gate: FounderDecisionGate,
  disposition: DecisionDisposition,
): boolean {
  return gate.allowedDispositions.includes(disposition);
}
