import type { StrategicRecall } from './founder-strategic-recall';

export type ConsequenceRiskLevel = 'moderate' | 'high';

export type StrategicConsequenceMap = {
  immediateResponse: string;
  secondOrderConsequence: string;
  resourceTradeoff: string;
  preparedContinuation: string;
  stopCondition: string;
  assumptions: string[];
  riskLevel: ConsequenceRiskLevel;
  founderQuestion: string;
};

function has(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function contextTransferRisk(recall: StrategicRecall | null): boolean {
  if (!recall) return false;
  const evidence = [
    recall.precedent.record.proof,
    recall.precedent.record.lesson,
    recall.warning?.message,
  ].filter(Boolean).join(' ');
  return /context transfer|failed|delayed|insufficient|critical failure/i.test(evidence);
}

export function buildConsequenceMap(
  command: string,
  recall: StrategicRecall | null,
): StrategicConsequenceMap {
  const normalized = command.trim();
  const isPilot = has(normalized, /pilot|trial|limited launch/i);
  const isPlatform = has(normalized, /platform|product|engineering|context layer|software/i);
  const costlyPrecedent = contextTransferRisk(recall);

  const immediateResponse = isPilot && isPlatform
    ? 'Product and Engineering will convert the decision into a bounded pilot, ownership assignment, and activation gate.'
    : isPilot
      ? 'The responsible owner will translate the decision into a bounded pilot with explicit scope, timing, and success criteria.'
      : 'The responsible owner will convert the decision into an explicit action, sequence, and accountability boundary.';

  const secondOrderConsequence = isPlatform
    ? 'The pilot will consume Product and Engineering capacity, affect onboarding and context continuity, and force priority choices elsewhere.'
    : 'Execution will consume operating capacity and may displace another priority, alter timing, or create a new dependency.';

  const resourceTradeoff = recall?.precedent.record.decisionNote
    ? `Protect the decision boundary by carrying forward the prior tradeoff: ${recall.precedent.record.decisionNote}`
    : 'Reserve time and operating capacity by pausing or narrowing one lower-priority initiative before activation.';

  const preparedContinuation = costlyPrecedent
    ? 'Require context transfer proof before expansion, preserve a rollback boundary, and prepare a continuation only after the activation gate is passed.'
    : 'Define the activation gate, proof threshold, ownership handoff, and rollback boundary before the first action begins.';

  const stopCondition = costlyPrecedent
    ? 'Stop or roll back if context transfer fails, onboarding is delayed beyond the agreed threshold, or a critical dependency remains unowned.'
    : 'Stop, narrow, or delay if the proof threshold is missed, capacity falls below the protected minimum, or ownership becomes ambiguous.';

  return {
    immediateResponse,
    secondOrderConsequence,
    resourceTradeoff,
    preparedContinuation,
    stopCondition,
    assumptions: [
      'Founder authority is required for the decision.',
      'The initiative can be bounded before full commitment.',
      'Visible proof can be defined before execution begins.',
    ],
    riskLevel: costlyPrecedent ? 'high' : 'moderate',
    founderQuestion: 'What response do we expect, what consequence follows, and what continuation is already prepared if the first move succeeds or fails?',
  };
}
