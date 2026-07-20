import type { DecisionPreparationWorkspace } from './founder-decision-preparation';
import type { ReadinessDimension } from './founder-decision-readiness';

export type PreparationEvidenceType = 'link' | 'file' | 'source';
export type PreparationEvidenceStatus = 'unverified' | 'verified' | 'rejected';

export type PreparationEvidenceInput = {
  type: PreparationEvidenceType;
  title: string;
  reference: string;
  owner?: string;
  dueDate?: string;
};

export type PreparationEvidence = PreparationEvidenceInput & {
  id: string;
  verificationStatus: PreparationEvidenceStatus;
  addedAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
};

function validateInput(input: PreparationEvidenceInput): PreparationEvidenceInput {
  const normalized = {
    ...input,
    title: input.title.trim(),
    reference: input.reference.trim(),
    owner: input.owner?.trim() || undefined,
    dueDate: input.dueDate?.trim() || undefined,
  };

  if (normalized.title.length < 4) {
    throw new Error('Evidence requires a descriptive title.');
  }

  if (normalized.reference.length < 4) {
    throw new Error('Evidence requires a source reference.');
  }

  if (normalized.type === 'link' && !/^https:\/\//i.test(normalized.reference)) {
    throw new Error('Link evidence requires a valid HTTPS link.');
  }

  if (normalized.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalized.dueDate)) {
    throw new Error('Evidence due dates must use YYYY-MM-DD.');
  }

  return normalized;
}

function createEvidenceId(dimension: ReadinessDimension, timestamp: string, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
  return `${dimension}-${Date.parse(timestamp) || Date.now()}-${slug}`;
}

export function addPreparationEvidence(
  workspace: DecisionPreparationWorkspace,
  dimension: ReadinessDimension,
  input: PreparationEvidenceInput,
  now = new Date().toISOString(),
): DecisionPreparationWorkspace {
  const normalized = validateInput(input);
  let found = false;
  const items = workspace.items.map((item) => {
    if (item.dimension !== dimension) return item;
    found = true;
    const evidence: PreparationEvidence = {
      ...normalized,
      id: createEvidenceId(dimension, now, normalized.title),
      verificationStatus: 'unverified',
      addedAt: now,
    };
    return { ...item, evidence: [...item.evidence, evidence] };
  });

  if (!found) throw new Error(`No preparation item exists for ${dimension}.`);
  return { ...workspace, items };
}

export function verifyPreparationEvidence(
  workspace: DecisionPreparationWorkspace,
  dimension: ReadinessDimension,
  evidenceId: string,
  verifiedBy: string,
  now = new Date().toISOString(),
): DecisionPreparationWorkspace {
  const verifier = verifiedBy.trim();
  if (verifier.length < 2) throw new Error('Evidence verification requires a named verifier.');

  let found = false;
  const items = workspace.items.map((item) => {
    if (item.dimension !== dimension) return item;
    const evidence = item.evidence.map((entry) => {
      if (entry.id !== evidenceId) return entry;
      found = true;
      return {
        ...entry,
        verificationStatus: 'verified' as const,
        verifiedBy: verifier,
        verifiedAt: now,
      };
    });
    return { ...item, evidence };
  });

  if (!found) throw new Error('The specified evidence attachment could not be found.');
  return { ...workspace, items };
}
