// Spend ceilings + hard failure. This is the "brake": before any paid call,
// the guard checks the estimated cost against the daily, per-agent, and
// per-operation ceilings and THROWS if it would breach one. A budget that only
// warns is not a budget — the directive is explicit: hard failure on breach.
//
// SERVER-ONLY.

import { BudgetLedger } from './budget-ledger';
import { nanoToUsd, usdToNano } from './pricing';

export interface Ceilings {
  /** Hard daily cap across all agents. */
  dailyUsd: number;
  /** Optional hard cap per agent per day. */
  perAgentDailyUsd?: number;
  /** Optional hard cap on any single operation (catches runaway prompts). */
  perOperationUsd?: number;
}

export type CeilingKind = 'daily' | 'per-agent-daily' | 'per-operation';

export class BudgetExceededError extends Error {
  readonly kind: CeilingKind;
  readonly agent: string;
  readonly attemptedUsd: number;
  readonly ceilingUsd: number;
  readonly wouldBeUsd: number;

  constructor(params: {
    kind: CeilingKind;
    agent: string;
    attemptedUsd: number;
    ceilingUsd: number;
    wouldBeUsd: number;
  }) {
    super(
      `Budget exceeded (${params.kind}) for agent "${params.agent}": ` +
        `this call ~$${params.attemptedUsd.toFixed(6)} would bring the ` +
        `${params.kind} total to ~$${params.wouldBeUsd.toFixed(6)}, over the ` +
        `$${params.ceilingUsd.toFixed(2)} ceiling.`,
    );
    this.name = 'BudgetExceededError';
    this.kind = params.kind;
    this.agent = params.agent;
    this.attemptedUsd = params.attemptedUsd;
    this.ceilingUsd = params.ceilingUsd;
    this.wouldBeUsd = params.wouldBeUsd;
  }
}

export class SpendGuard {
  constructor(
    private readonly ledger: BudgetLedger,
    private readonly ceilings: Ceilings,
  ) {}

  /**
   * Authorize an estimated spend. Returns silently if it fits under every
   * applicable ceiling; throws BudgetExceededError on the FIRST ceiling it
   * would breach (per-operation, then per-agent-daily, then daily). Call this
   * BEFORE making the paid request, using a conservative estimate.
   */
  authorize(agent: string, estCostNano: number): void {
    const perOpNano =
      this.ceilings.perOperationUsd !== undefined
        ? usdToNano(this.ceilings.perOperationUsd)
        : undefined;
    if (perOpNano !== undefined && estCostNano > perOpNano) {
      throw new BudgetExceededError({
        kind: 'per-operation',
        agent,
        attemptedUsd: nanoToUsd(estCostNano),
        ceilingUsd: this.ceilings.perOperationUsd!,
        wouldBeUsd: nanoToUsd(estCostNano),
      });
    }

    if (this.ceilings.perAgentDailyUsd !== undefined) {
      const already = this.ledger.spentByAgentOnDayNano(agent);
      const wouldBe = already + estCostNano;
      const ceilingNano = usdToNano(this.ceilings.perAgentDailyUsd);
      if (wouldBe > ceilingNano) {
        throw new BudgetExceededError({
          kind: 'per-agent-daily',
          agent,
          attemptedUsd: nanoToUsd(estCostNano),
          ceilingUsd: this.ceilings.perAgentDailyUsd,
          wouldBeUsd: nanoToUsd(wouldBe),
        });
      }
    }

    const alreadyDay = this.ledger.spentOnDayNano();
    const wouldBeDay = alreadyDay + estCostNano;
    const dailyNano = usdToNano(this.ceilings.dailyUsd);
    if (wouldBeDay > dailyNano) {
      throw new BudgetExceededError({
        kind: 'daily',
        agent,
        attemptedUsd: nanoToUsd(estCostNano),
        ceilingUsd: this.ceilings.dailyUsd,
        wouldBeUsd: nanoToUsd(wouldBeDay),
      });
    }
  }

  /** Non-throwing check — for callers that want to degrade instead of fail. */
  wouldExceed(agent: string, estCostNano: number): boolean {
    try {
      this.authorize(agent, estCostNano);
      return false;
    } catch (error) {
      if (error instanceof BudgetExceededError) return true;
      throw error;
    }
  }
}
