import type { FounderDecisionRecord, FounderMemory } from './founder-memory';
import { findSimilarDecisions, type SimilarDecision } from './founder-memory-intelligence';

export type StrategicRecallWarning = {
  level: 'caution' | 'high';
  message: string;
  evidence: string;
};

export type StrategicRecall = {
  headline: string;
  precedent: SimilarDecision;
  similarities: string[];
  differences: {
    currentOnly: string[];
    precedentOnly: string[];
  };
  warning?: StrategicRecallWarning;
  founderQuestion: string;
};

const stopWords = new Set([
  'about', 'again', 'another', 'before', 'could', 'from', 'have', 'into', 'new',
  'should', 'that', 'the', 'their', 'this', 'through', 'under', 'until', 'what',
  'when', 'where', 'which', 'with', 'would', 'your', 'authorize', 'approve',
]);

const costlySignals = [
  /\bfailed?\b/i,
  /\bdelayed?\b/i,
  /\boverrun\b/i,
  /\bstalled?\b/i,
  /\bmissed?\b/i,
  /\breversed?\b/i,
  /\bcritical failure/i,
  /\binsufficient\b/i,
  /\bremoved from the roadmap/i,
  /\bdid not\b/i,
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function meaningfulTerms(value: string): string[] {
  return [...new Set(
    normalize(value)
      .split(' ')
      .filter((term) => term.length > 3 && !stopWords.has(term)),
  )];
}

function decisionText(record: FounderDecisionRecord): string {
  return [record.command, record.decisionNote, record.visibleAction, record.proof, record.lesson]
    .filter(Boolean)
    .join(' ');
}

function materialDifferences(command: string, record: FounderDecisionRecord) {
  const current = meaningfulTerms(command);
  const precedent = meaningfulTerms(decisionText(record));
  const currentSet = new Set(current);
  const precedentSet = new Set(precedent);

  return {
    currentOnly: current.filter((term) => !precedentSet.has(term)).slice(0, 5),
    precedentOnly: precedent.filter((term) => !currentSet.has(term)).slice(0, 5),
  };
}

function detectCostlyOutcome(record: FounderDecisionRecord): StrategicRecallWarning | undefined {
  const evidence = [record.proof, record.lesson].filter(Boolean).join(' ');
  const matched = costlySignals.filter((signal) => signal.test(evidence));
  if (matched.length === 0) return undefined;

  return {
    level: 'caution',
    message: matched.length >= 2
      ? 'The closest precedent contains a costly pattern: execution failed or delayed after commitment.'
      : 'The closest precedent contains a costly pattern that deserves explicit protection before proceeding.',
    evidence: record.proof,
  };
}

export function buildStrategicRecall(
  memory: FounderMemory,
  currentCommand: string,
): StrategicRecall | null {
  const [precedent] = findSimilarDecisions(memory.decisions, currentCommand, 1);
  if (!precedent) return null;

  // One generic shared word is not enough to interrupt a Founder decision.
  if (precedent.sharedTerms.length < 2 && precedent.score < 0.34) return null;

  const warning = detectCostlyOutcome(precedent.record);

  return {
    headline: 'Relevant precedent found before this decision moves forward.',
    precedent,
    similarities: precedent.sharedTerms.slice(0, 6),
    differences: materialDifferences(currentCommand, precedent.record),
    warning,
    founderQuestion: warning
      ? 'What is structurally different this time—and what proof protects us from repeating the same cost?'
      : 'What is materially different this time, and does that difference justify a different decision?',
  };
}
