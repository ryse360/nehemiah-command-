export const DEPLOYMENT_GATES = [
  'readiness', 'migrations', 'backupRestore', 'tests', 'typecheck',
  'build', 'performance', 'smoke', 'securityHeaders', 'rollbackPrepared',
] as const;
export type DeploymentGate = typeof DEPLOYMENT_GATES[number];
export type DeploymentRehearsalEvidence = Record<DeploymentGate, boolean>;

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
