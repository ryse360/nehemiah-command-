import type {
  FounderDecisionReadiness,
  ReadinessDimension,
} from './founder-decision-readiness';

export type PreparationItemStatus = 'unresolved' | 'resolved';

export type DecisionPreparationItem = {
  dimension: ReadinessDimension;
  label: string;
  prompt: string;
  requiredOutput: string;
  suggestedAction: string;
  status: PreparationItemStatus;
  response?: string;
};

export type DecisionPreparationWorkspace = {
  status: 'not-needed' | 'in-progress' | 'complete';
  items: DecisionPreparationItem[];
  completed: number;
  total: number;
};

const preparationGuidance: Record<ReadinessDimension, Omit<DecisionPreparationItem, 'dimension' | 'status'>> = {
  evidence: {
    label: 'Evidence',
    prompt: 'What verified signal, source, or preserved precedent justifies placing this matter before the Founder?',
    requiredOutput: 'Name the evidence and what it demonstrates.',
    suggestedAction: 'Attach the strongest available operating signal or request the missing evidence.',
  },
  ownership: {
    label: 'Ownership',
    prompt: 'Who is accountable for the visible action and who owns the critical dependency?',
    requiredOutput: 'Name at least one accountable owner and their responsibility.',
    suggestedAction: 'Assign delivery ownership before the decision gate opens.',
  },
  capacity: {
    label: 'Capacity',
    prompt: 'What work, time, or resource must be paused, narrowed, or reserved to make this executable?',
    requiredOutput: 'State the capacity cost and the displaced priority.',
    suggestedAction: 'Protect capacity by naming what will not proceed simultaneously.',
  },
  boundaries: {
    label: 'Boundaries',
    prompt: 'What limit, scope boundary, or stop condition prevents uncontrolled expansion?',
    requiredOutput: 'Define the operating limit and the condition that stops or narrows the move.',
    suggestedAction: 'Set a bounded pilot, review date, or failure threshold.',
  },
  proof: {
    label: 'Proof',
    prompt: 'What observable proof must exist before this decision is considered successful or expanded?',
    requiredOutput: 'Define the measurable proof gate and acceptable threshold.',
    suggestedAction: 'Name the evidence that will distinguish progress from intention.',
  },
};

function workspaceStatus(items: DecisionPreparationItem[]): DecisionPreparationWorkspace['status'] {
  if (items.length === 0) return 'not-needed';
  return items.every((item) => item.status === 'resolved') ? 'complete' : 'in-progress';
}

export function buildDecisionPreparationWorkspace(
  readiness: FounderDecisionReadiness,
): DecisionPreparationWorkspace {
  const items = readiness.missing.map((dimension) => ({
    dimension,
    ...preparationGuidance[dimension],
    status: 'unresolved' as const,
  }));

  return {
    status: workspaceStatus(items),
    items,
    completed: 0,
    total: items.length,
  };
}

export function resolvePreparationItem(
  workspace: DecisionPreparationWorkspace,
  dimension: ReadinessDimension,
  response: string,
): DecisionPreparationWorkspace {
  const normalized = response.trim();
  if (normalized.length < 12 || normalized.split(/\s+/).length < 3) {
    throw new Error('A specific response is required before this preparation item can be resolved.');
  }

  let found = false;
  const items = workspace.items.map((item) => {
    if (item.dimension !== dimension) return item;
    found = true;
    return { ...item, status: 'resolved' as const, response: normalized };
  });

  if (!found) throw new Error(`No preparation item exists for ${dimension}.`);

  const completed = items.filter((item) => item.status === 'resolved').length;
  return {
    status: workspaceStatus(items),
    items,
    completed,
    total: items.length,
  };
}

export function applyDecisionPreparation(
  readiness: FounderDecisionReadiness,
  workspace: DecisionPreparationWorkspace,
): FounderDecisionReadiness {
  const resolved = new Set(
    workspace.items
      .filter((item) => item.status === 'resolved')
      .map((item) => item.dimension),
  );
  const dimensions = readiness.dimensions.map((dimension) => resolved.has(dimension.key)
    ? {
        ...dimension,
        ready: true,
        explanation: workspace.items.find((item) => item.dimension === dimension.key)?.response
          ?? dimension.explanation,
      }
    : dimension);
  const missing = dimensions.filter((dimension) => !dimension.ready).map((dimension) => dimension.key);
  const score = dimensions.length - missing.length;
  const status = score === 5 ? 'ready' : score >= 3 ? 'conditional' : 'not-ready';

  return {
    ...readiness,
    score,
    status,
    canSurfaceToFounder: status !== 'not-ready',
    dimensions,
    missing,
    summary: status === 'ready'
      ? 'The decision is prepared for Founder judgment.'
      : status === 'conditional'
        ? 'The decision may be surfaced with explicit unresolved conditions.'
        : 'Nehemiah should continue preparing this decision before escalating it.',
    nextRequirement: dimensions.find((dimension) => !dimension.ready)?.explanation,
  };
}
