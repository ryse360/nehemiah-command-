import type { DecisionDisposition, FounderJourney } from './founder-journey';

export const FOUNDER_MEMORY_KEY = 'nehemiah.founder-memory.v1';

export type FounderDecisionRecord = {
  id: string;
  command: string;
  disposition: DecisionDisposition;
  decisionNote?: string;
  decidedAt: string;
  visibleAction?: string;
  actionStartedAt?: string;
  proof: string;
  proofRecordedAt: string;
  lesson?: string;
};

export type FounderMemory = {
  version: 1;
  decisions: FounderDecisionRecord[];
};

export function createFounderMemory(): FounderMemory {
  return { version: 1, decisions: [] };
}

function recordId(journey: FounderJourney): string {
  const source = `${journey.command}|${journey.decision?.decidedAt}|${journey.proof?.recordedAt}`;
  let hash = 0;
  for (const character of source) hash = Math.imul(31, hash) + character.charCodeAt(0) | 0;
  return `decision-${Math.abs(hash)}`;
}

export function appendJourneyToMemory(memory: FounderMemory, journey: FounderJourney): FounderMemory {
  if (journey.lifecycle !== 'proof-created' || !journey.decision || !journey.proof) return memory;

  const record: FounderDecisionRecord = {
    id: recordId(journey),
    command: journey.command || 'Founder decision',
    disposition: journey.decision.disposition,
    decisionNote: journey.decision.note,
    decidedAt: journey.decision.decidedAt,
    visibleAction: journey.action?.visibleAction,
    actionStartedAt: journey.action?.startedAt,
    proof: journey.proof.evidence,
    proofRecordedAt: journey.proof.recordedAt,
    ...(journey.proof.lesson ? { lesson: journey.proof.lesson } : {}),
  };

  if (memory.decisions.some((decision) => decision.id === record.id)) return memory;
  return { ...memory, decisions: [record, ...memory.decisions] };
}

export function serializeFounderMemory(memory: FounderMemory): string {
  return JSON.stringify(memory);
}

function isFounderMemory(value: unknown): value is FounderMemory {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FounderMemory>;
  return candidate.version === 1 && Array.isArray(candidate.decisions);
}

export function deserializeFounderMemory(serialized: string | null): FounderMemory {
  if (!serialized) return createFounderMemory();
  try {
    const parsed: unknown = JSON.parse(serialized);
    return isFounderMemory(parsed) ? parsed : createFounderMemory();
  } catch {
    return createFounderMemory();
  }
}
