import type { StrategicRecall } from './founder-strategic-recall';
import type { StrategicConsequenceMap } from './strategic-consequence-mapping';

export type ReadinessDimension = 'evidence' | 'ownership' | 'capacity' | 'boundaries' | 'proof';
export type DecisionReadinessStatus = 'ready' | 'conditional' | 'not-ready';

export type DecisionReadinessDimension = {
  key: ReadinessDimension;
  label: string;
  ready: boolean;
  explanation: string;
};

export type FounderDecisionReadiness = {
  score: number;
  total: 5;
  status: DecisionReadinessStatus;
  canSurfaceToFounder: boolean;
  dimensions: DecisionReadinessDimension[];
  missing: ReadinessDimension[];
  summary: string;
  nextRequirement?: string;
};

function contains(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function evidenceIsStrong(
  command: string,
  consequenceMap: StrategicConsequenceMap | null,
  recall: StrategicRecall | null,
): boolean {
  if (consequenceMap?.riskLevel === 'high') {
    const preservedEvidence = [
      recall?.precedent?.record?.proof,
      recall?.precedent?.record?.lesson,
    ].filter(Boolean).join(' ');
    return preservedEvidence.length >= 24 && !contains(preservedEvidence, /insufficient|unknown|missing/i);
  }

  return Boolean(
    consequenceMap
    && contains(command, /authorize|restricted|bounded|pilot|trial|decision/i)
  );
}

export function assessDecisionReadiness(
  command: string,
  consequenceMap: StrategicConsequenceMap | null,
  recall: StrategicRecall | null,
): FounderDecisionReadiness {
  const normalized = command.trim();
  const ownershipReady = contains(normalized, /product|engineering|owner|ownership|responsible/i)
    || Boolean(consequenceMap && contains(consequenceMap.immediateResponse, /owner|ownership|product|engineering|responsible/i));
  const capacityReady = Boolean(
    consequenceMap?.resourceTradeoff
    && consequenceMap.resourceTradeoff.trim().length > 20
    && contains(consequenceMap.resourceTradeoff, /pause|capacity|reserve|narrow|tradeoff|priority/i),
  );
  const boundariesReady = contains(normalized, /restricted|bounded|pilot|trial|limit/i)
    || Boolean(consequenceMap?.stopCondition?.trim());
  const proofReady = contains(normalized, /proof|evidence|gate|criteria|threshold/i)
    || Boolean(consequenceMap && contains(
      `${consequenceMap.preparedContinuation} ${consequenceMap.stopCondition}`,
      /proof|evidence|gate|threshold|criteria/i,
    ));
  const evidenceReady = evidenceIsStrong(normalized, consequenceMap, recall);

  const dimensions: DecisionReadinessDimension[] = [
    {
      key: 'evidence',
      label: 'Evidence',
      ready: evidenceReady,
      explanation: evidenceReady
        ? 'The decision is grounded in a defined operating signal or preserved precedent.'
        : 'The decision needs stronger evidence before confidence can be claimed.',
    },
    {
      key: 'ownership',
      label: 'Ownership',
      ready: ownershipReady,
      explanation: ownershipReady
        ? 'A responsible owner or operating function is explicit.'
        : 'No accountable owner has been named.',
    },
    {
      key: 'capacity',
      label: 'Capacity',
      ready: capacityReady,
      explanation: capacityReady
        ? 'The capacity cost and displaced priority are visible.'
        : 'The resource cost and displaced work are not yet explicit.',
    },
    {
      key: 'boundaries',
      label: 'Boundaries',
      ready: boundariesReady,
      explanation: boundariesReady
        ? 'Scope, limits, or a stop condition protect the decision.'
        : 'The decision has no clear boundary or stopping rule.',
    },
    {
      key: 'proof',
      label: 'Proof',
      ready: proofReady,
      explanation: proofReady
        ? 'A visible proof gate exists before expansion or completion.'
        : 'The decision does not yet define what will count as proof.',
    },
  ];

  const missing = dimensions.filter((dimension) => !dimension.ready).map((dimension) => dimension.key);
  const score = dimensions.length - missing.length;
  const status: DecisionReadinessStatus = score === 5
    ? 'ready'
    : score >= 3
      ? 'conditional'
      : 'not-ready';
  const canSurfaceToFounder = status !== 'not-ready';

  return {
    score,
    total: 5,
    status,
    canSurfaceToFounder,
    dimensions,
    missing,
    summary: status === 'ready'
      ? 'The decision is prepared for Founder judgment.'
      : status === 'conditional'
        ? 'The decision may be surfaced with explicit unresolved conditions.'
        : 'Nehemiah should continue preparing this decision before escalating it.',
    nextRequirement: missing.length
      ? dimensions.find((dimension) => !dimension.ready)?.explanation
      : undefined,
  };
}
