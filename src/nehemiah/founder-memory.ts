import type { FounderJourney } from './founder-journey';
import {
  appendJourneyWithIntegrity,
  createIntegrityMemory,
  migrateLegacyDecisionRecord,
  type IntegrityDecisionRecord,
  type IntegrityFounderMemory,
  type LegacyDecisionRecord,
} from './decision-record-integrity';

export const FOUNDER_MEMORY_KEY = 'nehemiah.founder-memory.v2';
export const LEGACY_FOUNDER_MEMORY_KEY = 'nehemiah.founder-memory.v1';

export type FounderDecisionRecord = IntegrityDecisionRecord;
export type FounderMemory = IntegrityFounderMemory;

export function createFounderMemory(): FounderMemory {
  return createIntegrityMemory();
}

export function appendJourneyToMemory(memory: FounderMemory, journey: FounderJourney): FounderMemory {
  return appendJourneyWithIntegrity(memory, journey);
}

export function serializeFounderMemory(memory: FounderMemory): string {
  return JSON.stringify(memory);
}

function isIntegrityMemory(value: unknown): value is FounderMemory {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FounderMemory>;
  return candidate.version === 2
    && Array.isArray(candidate.decisions)
    && candidate.decisions.every((record) => record && typeof record === 'object' && Array.isArray(record.auditTrail));
}

function isLegacyMemory(value: unknown): value is { version: 1; decisions: LegacyDecisionRecord[] } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { version?: unknown; decisions?: unknown };
  return candidate.version === 1 && Array.isArray(candidate.decisions);
}

export function deserializeFounderMemory(serialized: string | null): FounderMemory {
  if (!serialized) return createFounderMemory();
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isIntegrityMemory(parsed)) return parsed;
    if (isLegacyMemory(parsed)) {
      return { version: 2, decisions: parsed.decisions.map(migrateLegacyDecisionRecord) };
    }
    return createFounderMemory();
  } catch {
    return createFounderMemory();
  }
}
