import type { DecisionDisposition } from './founder-journey';
import type { FounderDecisionRecord, FounderMemory } from './founder-memory';

export type DecisionFilter = {
  query?: string;
  disposition?: DecisionDisposition | 'all';
};

export type SimilarDecision = {
  record: FounderDecisionRecord;
  score: number;
  sharedTerms: string[];
};

export type MemoryPattern = {
  id: string;
  summary: string;
  count: number;
  evidenceIds: string[];
};

export type FounderMemoryIntelligence = {
  totalDecisions: number;
  lessons: string[];
  patterns: MemoryPattern[];
  similarDecisions: SimilarDecision[];
};

const stopWords = new Set([
  'a', 'an', 'and', 'another', 'are', 'as', 'at', 'be', 'before', 'for', 'from',
  'in', 'is', 'it', 'of', 'on', 'or', 'should', 'the', 'to', 'we', 'with', 'your',
]);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function terms(value: string): string[] {
  return [...new Set(normalize(value).split(' ').filter((term) => term.length > 2 && !stopWords.has(term)))];
}

function searchableText(record: FounderDecisionRecord): string {
  return [
    record.command,
    record.decisionNote,
    record.visibleAction,
    record.proof,
    record.lesson,
    record.disposition.replaceAll('-', ' '),
  ].filter(Boolean).join(' ');
}

export function filterFounderDecisions(
  decisions: FounderDecisionRecord[],
  filter: DecisionFilter,
): FounderDecisionRecord[] {
  const query = normalize(filter.query ?? '');
  const disposition = filter.disposition ?? 'all';

  return decisions
    .filter((record) => disposition === 'all' || record.disposition === disposition)
    .filter((record) => !query || normalize(searchableText(record)).includes(query))
    .sort((a, b) => Date.parse(b.proofRecordedAt) - Date.parse(a.proofRecordedAt));
}

export function findSimilarDecisions(
  decisions: FounderDecisionRecord[],
  command: string,
  limit = 3,
): SimilarDecision[] {
  const commandTerms = terms(command);
  if (commandTerms.length === 0) return [];

  return decisions
    .map((record) => {
      const recordTerms = new Set(terms(searchableText(record)));
      const sharedTerms = commandTerms.filter((term) => recordTerms.has(term));
      const score = sharedTerms.length / Math.max(commandTerms.length, 1);
      return { record, score, sharedTerms };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.record.proofRecordedAt) - Date.parse(a.record.proofRecordedAt))
    .slice(0, limit);
}

export function summarizeRecurringPatterns(decisions: FounderDecisionRecord[]): MemoryPattern[] {
  const patterns: MemoryPattern[] = [];
  const counts = new Map<DecisionDisposition, FounderDecisionRecord[]>();

  for (const record of decisions) {
    const group = counts.get(record.disposition) ?? [];
    group.push(record);
    counts.set(record.disposition, group);
  }

  for (const [disposition, records] of counts.entries()) {
    if (records.length < 2) continue;
    const phrase = disposition.replaceAll('-', ' ');
    patterns.push({
      id: `disposition-${disposition}`,
      summary: `You repeatedly ${phrase} when protecting momentum and controlling downside.`,
      count: records.length,
      evidenceIds: records.map((record) => record.id),
    });
  }

  const bounded = decisions.filter((record) => /limit|restricted|cap|boundary|pause/i.test(searchableText(record)));
  if (bounded.length >= 2) {
    patterns.push({
      id: 'bounded-execution',
      summary: 'You repeatedly use boundaries, limits, or restricted pilots to move without overextension.',
      count: bounded.length,
      evidenceIds: bounded.map((record) => record.id),
    });
  }

  return patterns.sort((a, b) => b.count - a.count || a.summary.localeCompare(b.summary));
}

export function analyzeFounderMemory(
  memory: FounderMemory,
  currentCommand = '',
): FounderMemoryIntelligence {
  const lessons = memory.decisions
    .map((record) => record.lesson?.trim() || inferLesson(record))
    .filter((lesson): lesson is string => Boolean(lesson));

  return {
    totalDecisions: memory.decisions.length,
    lessons: [...new Set(lessons)],
    patterns: summarizeRecurringPatterns(memory.decisions),
    similarDecisions: currentCommand.trim()
      ? findSimilarDecisions(memory.decisions, currentCommand)
      : [],
  };
}

function inferLesson(record: FounderDecisionRecord): string {
  if (record.disposition === 'approve-with-limits') {
    return 'Controlled limits can preserve momentum while containing downside.';
  }
  if (record.disposition === 'reject') {
    return 'A recorded rejection protects focus when proof is insufficient.';
  }
  if (record.disposition === 'delay' || record.disposition === 'request-evidence') {
    return 'Necessary intelligence should be gathered before committing resources.';
  }
  return 'A decision becomes useful when visible action produces proof.';
}
