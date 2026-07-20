export type FiveSecondGate = {
  mattersMost: boolean;
  whyFirst: boolean;
  founderAuthority: boolean;
  visibleAction: boolean;
  proofRequired: boolean;
};

export type FounderPilotSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  command: string;
  completedJourney: boolean;
  proofCaptured: boolean;
  decisionUseful: boolean;
  fiveSecondGate: FiveSecondGate;
  criticalIssues: number;
  highIssues: number;
  acceptedHighIssues: number;
  notes: string;
};

const FIVE_SECOND_KEYS = [
  'mattersMost', 'whyFirst', 'founderAuthority', 'visibleAction', 'proofRequired',
] as const;

function validFiveSecondGate(value: unknown): value is FiveSecondGate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === FIVE_SECOND_KEYS.length
    && FIVE_SECOND_KEYS.every((key) => typeof record[key] === 'boolean');
}

export function validatePilotSession(session: FounderPilotSession) {
  const errors: string[] = [];
  if (!session || typeof session !== 'object') return { valid: false, errors: ['Pilot session is required.'] };
  if (typeof session.id !== 'string' || !session.id.trim() || session.id.length > 120) errors.push('Pilot session ID is required and must not exceed 120 characters.');

  const started = Date.parse(session.startedAt);
  const ended = Date.parse(session.endedAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) {
    errors.push('Valid start and end times are required.');
  } else if (ended <= started) {
    errors.push('Pilot end time must be after the start time.');
  }

  if (typeof session.command !== 'string' || !session.command.trim() || session.command.length > 1_000) errors.push('Founder command is required and must not exceed 1,000 characters.');
  if (typeof session.completedJourney !== 'boolean' || typeof session.proofCaptured !== 'boolean' || typeof session.decisionUseful !== 'boolean') {
    errors.push('Journey, proof, and usefulness results must be explicit booleans.');
  }
  if (typeof session.notes !== 'string' || session.notes.length > 2_000) errors.push('Pilot notes exceed the 2,000-character limit.');
  if (!validFiveSecondGate(session.fiveSecondGate)) errors.push('All five usability-gate answers must be explicit booleans.');
  if (!Number.isInteger(session.criticalIssues) || session.criticalIssues < 0) errors.push('Critical issue count is invalid.');
  if (!Number.isInteger(session.highIssues) || session.highIssues < 0) errors.push('High issue count is invalid.');
  if (!Number.isInteger(session.acceptedHighIssues) || session.acceptedHighIssues < 0 || session.acceptedHighIssues > session.highIssues) {
    errors.push('Accepted high-severity issue count is invalid.');
  }
  return { valid: errors.length === 0, errors };
}

function sessionSucceeded(session: FounderPilotSession) {
  return session.completedJourney
    && session.proofCaptured
    && session.decisionUseful
    && FIVE_SECOND_KEYS.every((key) => session.fiveSecondGate[key])
    && session.criticalIssues === 0;
}

export function assessFounderPilot(sessions: FounderPilotSession[], founderApproved: boolean) {
  const validSessions = sessions.filter((item) => validatePilotSession(item).valid);
  const successfulSessions = validSessions.filter(sessionSucceeded).length;
  const criticalIssues = validSessions.reduce((sum, item) => sum + item.criticalIssues, 0);
  const highIssues = validSessions.reduce((sum, item) => sum + item.highIssues, 0);
  const acceptedHighIssues = validSessions.reduce((sum, item) => sum + item.acceptedHighIssues, 0);
  const unresolvedHighIssues = Math.max(0, highIssues - acceptedHighIssues);
  const blockers: string[] = [];
  if (validSessions.length < 5) blockers.push('At least five completed Founder pilot sessions are required.');
  if (successfulSessions < 5) blockers.push('Five sessions must complete the journey, five-second gate, and proof capture successfully.');
  if (criticalIssues > 0) blockers.push('All critical pilot issues must be resolved before release.');
  if (unresolvedHighIssues > 0) blockers.push('All high-severity pilot issues must be resolved or explicitly accepted.');
  if (!founderApproved) blockers.push('Explicit Founder release approval is required.');
  return {
    status: blockers.length ? 'blocked' as const : 'pass' as const,
    sessions: validSessions.length,
    successfulSessions,
    criticalIssues,
    highIssues,
    acceptedHighIssues,
    unresolvedHighIssues,
    founderApproved,
    blockers,
  };
}
