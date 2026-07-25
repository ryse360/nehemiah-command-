// Memory admission — composes the salience gate and the dedup index into a
// single decision on each candidate: write it (and embed it), or skip it.
// This is the gate that sits in front of Graphiti/embedding in a later slice;
// here it runs fully synthetic.
//
// SERVER-ONLY.

import { DedupIndex, type DedupConfig, type DuplicateKind } from './dedup';
import {
  DEFAULT_SALIENCE,
  scoreSalience,
  type MemoryCandidate,
  type SalienceConfig,
} from './salience';

export type AdmissionAction = 'write' | 'skip';

export interface AdmissionDecision {
  action: AdmissionAction;
  /** Whether this admission should trigger a (paid) embedding. */
  embed: boolean;
  reason: string;
  salienceScore: number;
  duplicateOf?: string;
  duplicateKind?: DuplicateKind;
}

export interface AdmissionStats {
  seen: number;
  written: number;
  skippedNotSalient: number;
  skippedDuplicate: number;
  /** Embedding calls avoided vs. a naive "embed everything" baseline. */
  embedsAvoided: number;
}

export interface MemoryAdmissionOptions {
  salience?: SalienceConfig;
  dedup?: DedupConfig;
}

export class MemoryAdmission {
  private readonly dedupIndex: DedupIndex;
  private readonly salienceConfig: SalienceConfig;
  private readonly stats: AdmissionStats = {
    seen: 0,
    written: 0,
    skippedNotSalient: 0,
    skippedDuplicate: 0,
    embedsAvoided: 0,
  };

  constructor(options: MemoryAdmissionOptions = {}) {
    this.salienceConfig = options.salience ?? DEFAULT_SALIENCE;
    this.dedupIndex = new DedupIndex(options.dedup);
  }

  /**
   * Decide the fate of a candidate. On a "write" decision the candidate is
   * added to the dedup index so later duplicates are caught. Salience is
   * checked FIRST (cheapest) so noise never even reaches the dedup scan.
   */
  evaluate(id: string, candidate: MemoryCandidate): AdmissionDecision {
    this.stats.seen += 1;

    const salience = scoreSalience(candidate, this.salienceConfig);
    if (!salience.salient) {
      this.stats.skippedNotSalient += 1;
      this.stats.embedsAvoided += 1; // would have embedded under naive baseline
      return {
        action: 'skip',
        embed: false,
        reason: `not salient — ${salience.reason}`,
        salienceScore: salience.score,
      };
    }

    const dup = this.dedupIndex.check(candidate.text);
    if (dup.duplicate) {
      this.stats.skippedDuplicate += 1;
      this.stats.embedsAvoided += 1;
      return {
        action: 'skip',
        embed: false,
        reason: `${dup.kind} duplicate of ${dup.matchId} (sim ${dup.similarity.toFixed(2)})`,
        salienceScore: salience.score,
        duplicateOf: dup.matchId,
        duplicateKind: dup.kind,
      };
    }

    this.dedupIndex.add(id, candidate.text);
    this.stats.written += 1;
    return {
      action: 'write',
      embed: true,
      reason: `salient & novel — ${salience.reason}`,
      salienceScore: salience.score,
    };
  }

  getStats(): Readonly<AdmissionStats> {
    return { ...this.stats };
  }
}

export {
  DedupIndex,
  jaccard,
  normalize,
  shingles,
  DEFAULT_DEDUP,
} from './dedup';
export type { DedupConfig, DedupResult, DuplicateKind } from './dedup';
export {
  DEFAULT_SALIENCE,
  scoreSalience,
} from './salience';
export type { MemoryCandidate, MemoryKind, SalienceConfig, SalienceDecision } from './salience';
