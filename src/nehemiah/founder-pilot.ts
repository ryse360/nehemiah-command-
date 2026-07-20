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
  notes: string;
};

export function validatePilotSession(session: FounderPilotSession) {
  const errors: string[] = [];
  if (!session.id.trim()) errors.push('Pilot session ID is required.');
  if (Number.isNaN(Date.parse(session.startedAt)) || Number.isNaN(Date.parse(session.endedAt))) errors.push('Valid start and end times are required.');
  if (!session.command.trim()) errors.push('Founder command is required.');
  if (session.notes.length > 2_000) errors.push('Pilot notes exceed the 2,000-character limit.');
  if (!Number.isInteger(session.criticalIssues) || session.criticalIssues < 0) errors.push('Critical issue count is invalid.');
  if (!Number.isInteger(session.highIssues) || session.highIssues < 0) errors.push('High issue count is invalid.');
  return { valid: errors.length === 0, errors };
}

function sessionSucceeded(session: FounderPilotSession) {
  return session.completedJourney && session.proofCaptured && session.decisionUseful && Object.values(session.fiveSecondGate).every(Boolean) && session.criticalIssues === 0;
}

export function assessFounderPilot(sessions: FounderPilotSession[], founderApproved: boolean) {
  const validSessions = sessions.filter((item) => validatePilotSession(item).valid);
  const successfulSessions = validSessions.filter(sessionSucceeded).length;
  const criticalIssues = validSessions.reduce((sum, item) => sum + item.criticalIssues, 0);
  const highIssues = validSessions.reduce((sum, item) => sum + item.highIssues, 0);
  const blockers: string[] = [];
  if (validSessions.length < 5) blockers.push('At least five completed Founder pilot sessions are required.');
  if (successfulSessions < 5) blockers.push('Five sessions must complete the journey, five-second gate, and proof capture successfully.');
  if (criticalIssues > 0) blockers.push('All critical pilot issues must be resolved before release.');
  if (highIssues > 0) blockers.push('All high-severity pilot issues must be resolved or explicitly accepted.');
  if (!founderApproved) blockers.push('Explicit Founder release approval is required.');
  return {
    status: blockers.length ? 'blocked' as const : 'pass' as const,
    sessions: validSessions.length,
    successfulSessions,
    criticalIssues,
    highIssues,
    founderApproved,
    blockers,
  };
}
