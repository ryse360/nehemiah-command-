import type { DecisionDisposition, FounderJourney, JourneyHistoryItem } from './founder-journey';

export type DecisionRecordActor = 'Founder' | 'Nehemiah';
export type DecisionAuditEventType = 'decision-archived' | 'record-revised';

export type DecisionSourceProvenance = {
  kind: JourneyHistoryItem['kind'];
  summary: string;
  recordedAt: string;
};

export type DecisionAuditEntry = {
  sequence: number;
  eventType: DecisionAuditEventType;
  actor: DecisionRecordActor;
  reason: string;
  recordedAt: string;
  recordDigest: string;
  previousHash: string;
  hash: string;
};

export type IntegrityDecisionRecord = {
  id: string;
  logicalDecisionId: string;
  recordVersion: number;
  supersedesVersion?: number;
  command: string;
  disposition: DecisionDisposition;
  decisionNote?: string;
  decidedAt: string;
  visibleAction?: string;
  actionStartedAt?: string;
  proof: string;
  proofRecordedAt: string;
  lesson?: string;
  provenance: DecisionSourceProvenance[];
  auditTrail: DecisionAuditEntry[];
};

export type IntegrityFounderMemory = {
  version: 2;
  decisions: IntegrityDecisionRecord[];
};

export type DecisionRecordRevision = Partial<Pick<
  IntegrityDecisionRecord,
  'decisionNote' | 'visibleAction' | 'proof' | 'lesson'
>>;

export function createIntegrityMemory(): IntegrityFounderMemory {
  return { version: 2, decisions: [] };
}

function stableHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

function logicalId(journey: FounderJourney): string {
  return `decision-${stableHash(`${journey.command}|${journey.decision?.decidedAt}|${journey.proof?.recordedAt}`)}`;
}

function materialSnapshot(record: Omit<IntegrityDecisionRecord, 'auditTrail'> | IntegrityDecisionRecord): string {
  return JSON.stringify({
    id: record.id,
    logicalDecisionId: record.logicalDecisionId,
    recordVersion: record.recordVersion,
    supersedesVersion: record.supersedesVersion ?? null,
    command: record.command,
    disposition: record.disposition,
    decisionNote: record.decisionNote ?? null,
    decidedAt: record.decidedAt,
    visibleAction: record.visibleAction ?? null,
    actionStartedAt: record.actionStartedAt ?? null,
    proof: record.proof,
    proofRecordedAt: record.proofRecordedAt,
    lesson: record.lesson ?? null,
    provenance: record.provenance,
  });
}

function createAuditEntry(
  record: Omit<IntegrityDecisionRecord, 'auditTrail'>,
  eventType: DecisionAuditEventType,
  actor: DecisionRecordActor,
  reason: string,
  recordedAt: string,
  previous: DecisionAuditEntry | undefined,
): DecisionAuditEntry {
  const recordDigest = stableHash(materialSnapshot(record));
  const previousHash = previous?.hash ?? 'GENESIS';
  const sequence = (previous?.sequence ?? 0) + 1;
  const hash = stableHash(JSON.stringify({
    sequence,
    eventType,
    actor,
    reason,
    recordedAt,
    recordDigest,
    previousHash,
  }));

  return { sequence, eventType, actor, reason, recordedAt, recordDigest, previousHash, hash };
}

export function appendJourneyWithIntegrity(
  memory: IntegrityFounderMemory,
  journey: FounderJourney,
): IntegrityFounderMemory {
  if (journey.lifecycle !== 'proof-created' || !journey.decision || !journey.proof) return memory;

  const baseId = logicalId(journey);
  if (memory.decisions.some((record) => record.logicalDecisionId === baseId && record.recordVersion === 1)) {
    return memory;
  }

  const recordWithoutAudit: Omit<IntegrityDecisionRecord, 'auditTrail'> = {
    id: `${baseId}:v1`,
    logicalDecisionId: baseId,
    recordVersion: 1,
    command: journey.command || 'Founder decision',
    disposition: journey.decision.disposition,
    ...(journey.decision.note ? { decisionNote: journey.decision.note } : {}),
    decidedAt: journey.decision.decidedAt,
    ...(journey.action?.visibleAction ? { visibleAction: journey.action.visibleAction } : {}),
    ...(journey.action?.startedAt ? { actionStartedAt: journey.action.startedAt } : {}),
    proof: journey.proof.evidence,
    proofRecordedAt: journey.proof.recordedAt,
    ...(journey.proof.lesson ? { lesson: journey.proof.lesson } : {}),
    provenance: journey.history.map(({ kind, summary, recordedAt }) => ({ kind, summary, recordedAt })),
  };
  const auditEntry = createAuditEntry(
    recordWithoutAudit,
    'decision-archived',
    'Nehemiah',
    'Completed Founder journey archived with visible proof.',
    journey.proof.recordedAt,
    undefined,
  );

  return {
    ...memory,
    decisions: [{ ...recordWithoutAudit, auditTrail: [auditEntry] }, ...memory.decisions],
  };
}

function hasMaterialChange(record: IntegrityDecisionRecord, changes: DecisionRecordRevision): boolean {
  return Object.entries(changes).some(([key, value]) => {
    if (value === undefined) return false;
    return record[key as keyof DecisionRecordRevision] !== value;
  });
}

export function reviseDecisionRecord(
  memory: IntegrityFounderMemory,
  recordId: string,
  changes: DecisionRecordRevision,
  actor: DecisionRecordActor,
  reason: string,
  recordedAt = new Date().toISOString(),
): IntegrityFounderMemory {
  const current = memory.decisions.find((record) => record.id === recordId);
  if (!current) throw new Error('Decision record not found.');
  if (reason.trim().length < 8) throw new Error('A specific revision reason is required.');
  if (!hasMaterialChange(current, changes)) throw new Error('A material change is required for a new record version.');

  const nextVersion = Math.max(
    ...memory.decisions
      .filter((record) => record.logicalDecisionId === current.logicalDecisionId)
      .map((record) => record.recordVersion),
  ) + 1;
  const revisedWithoutAudit: Omit<IntegrityDecisionRecord, 'auditTrail'> = {
    ...current,
    ...changes,
    id: `${current.logicalDecisionId}:v${nextVersion}`,
    recordVersion: nextVersion,
    supersedesVersion: current.recordVersion,
  };
  const auditEntry = createAuditEntry(
    revisedWithoutAudit,
    'record-revised',
    actor,
    reason.trim(),
    recordedAt,
    current.auditTrail.at(-1),
  );

  return {
    ...memory,
    decisions: [
      { ...revisedWithoutAudit, auditTrail: [...current.auditTrail, auditEntry] },
      ...memory.decisions,
    ],
  };
}

export function verifyDecisionRecordIntegrity(record: IntegrityDecisionRecord): boolean {
  if (record.auditTrail.length === 0) return false;

  for (let index = 0; index < record.auditTrail.length; index += 1) {
    const entry = record.auditTrail[index]!;
    const previousHash = index === 0 ? 'GENESIS' : record.auditTrail[index - 1]!.hash;
    if (entry.sequence !== index + 1 || entry.previousHash !== previousHash) return false;
    const expectedHash = stableHash(JSON.stringify({
      sequence: entry.sequence,
      eventType: entry.eventType,
      actor: entry.actor,
      reason: entry.reason,
      recordedAt: entry.recordedAt,
      recordDigest: entry.recordDigest,
      previousHash: entry.previousHash,
    }));
    if (entry.hash !== expectedHash) return false;
  }

  return record.auditTrail.at(-1)?.recordDigest === stableHash(materialSnapshot(record));
}

export type LegacyDecisionRecord = {
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

export function migrateLegacyDecisionRecord(record: LegacyDecisionRecord): IntegrityDecisionRecord {
  const logicalDecisionId = record.id.includes(':v') ? record.id.split(':v')[0]! : record.id;
  const withoutAudit: Omit<IntegrityDecisionRecord, 'auditTrail'> = {
    ...record,
    id: `${logicalDecisionId}:v1`,
    logicalDecisionId,
    recordVersion: 1,
    provenance: [],
  };
  const audit = createAuditEntry(
    withoutAudit,
    'decision-archived',
    'Nehemiah',
    'Legacy Founder memory migrated into the integrity ledger.',
    record.proofRecordedAt,
    undefined,
  );
  return { ...withoutAudit, auditTrail: [audit] };
}
