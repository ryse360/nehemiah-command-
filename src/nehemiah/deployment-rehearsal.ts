export const DEPLOYMENT_GATES = [
  'readiness', 'migrations', 'backupRestore', 'tests', 'typecheck',
  'build', 'performance', 'smoke', 'securityHeaders', 'rollbackPrepared',
] as const;

export type DeploymentGate = typeof DEPLOYMENT_GATES[number];
export type DeploymentRehearsalEvidence = Record<DeploymentGate, boolean>;

export function parseDeploymentRehearsalEvidence(value: unknown): DeploymentRehearsalEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Deployment rehearsal evidence must be an object.');
  }

  const record = value as Record<string, unknown>;
  const unexpected = Object.keys(record).filter((key) => !DEPLOYMENT_GATES.includes(key as DeploymentGate));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected deployment gates: ${unexpected.join(', ')}`);
  }

  const missing = DEPLOYMENT_GATES.filter((gate) => typeof record[gate] !== 'boolean');
  if (missing.length > 0) {
    throw new Error(`Boolean evidence is required for: ${missing.join(', ')}`);
  }

  return Object.fromEntries(
    DEPLOYMENT_GATES.map((gate) => [gate, record[gate] as boolean]),
  ) as DeploymentRehearsalEvidence;
}

export function evaluateDeploymentRehearsal(evidence: DeploymentRehearsalEvidence) {
  const blockers = DEPLOYMENT_GATES.filter((gate) => !evidence[gate]);
  const passed = DEPLOYMENT_GATES.length - blockers.length;
  return {
    status: blockers.length ? 'blocked' as const : 'pass' as const,
    score: Math.round((passed / DEPLOYMENT_GATES.length) * 100),
    passed,
    total: DEPLOYMENT_GATES.length,
    blockers,
  };
}
