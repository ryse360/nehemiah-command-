// Nehemiah cost-controlled AI boundary — public surface.
//
// SERVER-ONLY. Composes the pricing table, complexity router, budget ledger,
// and hard-fail spend guard into a single controller. The intended lifecycle
// for a paid model call (wired to a real provider in a later slice):
//
//   const plan = cost.route({ complexity: 'moderate' });
//   const estNano = cost.estimate(plan.model, estInputTokens, estOutputTokens);
//   cost.authorize(agent, estNano);           // THROWS if it breaches a ceiling
//   const result = await callModel(plan.model, ...);   // (future slice)
//   cost.record({ agent, task, plan, inputTokens, outputTokens });  // actuals
//
// Everything here runs against synthetic data and a controllable clock — no
// API keys, no network, no real Founder data.

import { BudgetLedger, type Clock, type LedgerEntry } from './budget-ledger';
import { routeModel, type RouteDecision, type RouteRequest } from './model-router';
import {
  DEFAULT_MODELS,
  costNano,
  nanoToUsd,
  type ModelSpec,
  type PricingTable,
} from './pricing';
import { SpendGuard, type Ceilings } from './spend-guard';

export interface CostControllerOptions {
  now: Clock;
  ceilings: Ceilings;
  pricing?: PricingTable;
}

export interface RecordInput {
  agent: string;
  task: string;
  plan: Pick<RouteDecision, 'tier' | 'model'>;
  inputTokens: number;
  outputTokens: number;
}

export interface CostReport {
  dayKey: string;
  totalUsd: number;
  byAgentUsd: Record<string, number>;
  ceilings: Ceilings;
  callCount: number;
}

export class CostController {
  readonly ledger: BudgetLedger;
  readonly guard: SpendGuard;
  readonly ceilings: Ceilings;
  private readonly pricing: PricingTable;

  constructor(options: CostControllerOptions) {
    this.pricing = options.pricing ?? DEFAULT_MODELS;
    this.ceilings = options.ceilings;
    this.ledger = new BudgetLedger(options.now);
    this.guard = new SpendGuard(this.ledger, options.ceilings);
  }

  /** Pick a model for a task by complexity (with optional escalation/cap). */
  route(request: RouteRequest): RouteDecision {
    return routeModel(request, this.pricing);
  }

  /** Estimated cost of a call, in nano-dollars, from a token estimate. */
  estimate(model: ModelSpec, inputTokens: number, outputTokens: number): number {
    return costNano(model, inputTokens, outputTokens);
  }

  /** Hard-fail authorization — throws BudgetExceededError if over a ceiling. */
  authorize(agent: string, estCostNano: number): void {
    this.guard.authorize(agent, estCostNano);
  }

  /** Commit the ACTUAL token usage of a completed call to the ledger. */
  record(input: RecordInput): LedgerEntry {
    const cost = costNano(input.plan.model, input.inputTokens, input.outputTokens);
    return this.ledger.record({
      agent: input.agent,
      task: input.task,
      model: input.plan.model.id,
      tier: input.plan.tier,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costNano: cost,
    });
  }

  report(): CostReport {
    const attribution = this.ledger.attributionByAgent();
    const byAgentUsd: Record<string, number> = {};
    for (const [agent, nano] of Object.entries(attribution)) {
      byAgentUsd[agent] = nanoToUsd(nano);
    }
    return {
      dayKey: this.ledger.all().at(-1)?.dayKey ?? new Date(0).toISOString().slice(0, 10),
      totalUsd: nanoToUsd(this.ledger.spentOnDayNano()),
      byAgentUsd,
      ceilings: this.ceilings,
      callCount: this.ledger.all().length,
    };
  }
}

export { BudgetLedger, dayKeyOf } from './budget-ledger';
export type { Clock, LedgerEntry } from './budget-ledger';
export { routeModel, TIER_ORDER } from './model-router';
export type { RouteDecision, RouteRequest, TaskComplexity } from './model-router';
export {
  DEFAULT_MODELS,
  NANO_PER_USD,
  costNano,
  nanoToUsd,
  usdToNano,
} from './pricing';
export type { ModelId, ModelSpec, ModelTier, PricingTable } from './pricing';
export { BudgetExceededError, SpendGuard } from './spend-guard';
export type { Ceilings, CeilingKind } from './spend-guard';
