// Model routing by task complexity.
//
// The single cheapest lever on AI spend: don't send trivial work to a premium
// model. Every operation declares a complexity; the router maps that to a tier
// and returns the concrete model spec from the (overridable) pricing table.
//
// SERVER-ONLY. Pure function of its inputs — no I/O, no clock, no secrets.

import { DEFAULT_MODELS, type ModelSpec, type ModelTier, type PricingTable } from './pricing';

// Ordered cheapest → dearest so escalation/clamping can walk the scale.
export const TIER_ORDER: readonly ModelTier[] = ['economy', 'standard', 'premium'] as const;

export type TaskComplexity =
  | 'trivial' // deterministic-ish: classify, tag, route, format
  | 'simple' // short extraction, single-fact lookup
  | 'moderate' // summarize, draft, compare a few items
  | 'complex' // multi-step reasoning, synthesis
  | 'critical'; // high-stakes: contradiction checks, decisions of record

const COMPLEXITY_TO_TIER: Record<TaskComplexity, ModelTier> = {
  trivial: 'economy',
  simple: 'economy',
  moderate: 'standard',
  complex: 'premium',
  critical: 'premium',
};

export interface RouteRequest {
  complexity: TaskComplexity;
  /** Bump exactly one tier dearer (e.g. a retry after a low-tier failure). */
  escalate?: boolean;
  /** Never exceed this tier regardless of complexity (a cost cap knob). */
  maxTier?: ModelTier;
}

export interface RouteDecision {
  tier: ModelTier;
  model: ModelSpec;
  reason: string;
}

function tierIndex(tier: ModelTier): number {
  return TIER_ORDER.indexOf(tier);
}

function clampTier(tier: ModelTier, maxTier?: ModelTier): ModelTier {
  if (!maxTier) return tier;
  return tierIndex(tier) > tierIndex(maxTier) ? maxTier : tier;
}

export function routeModel(
  request: RouteRequest,
  pricing: PricingTable = DEFAULT_MODELS,
): RouteDecision {
  const base = COMPLEXITY_TO_TIER[request.complexity];
  let tier = base;
  const reasons: string[] = [`complexity=${request.complexity}→${base}`];

  if (request.escalate) {
    const bumped = TIER_ORDER[Math.min(tierIndex(tier) + 1, TIER_ORDER.length - 1)];
    if (bumped !== tier) reasons.push(`escalated→${bumped}`);
    tier = bumped;
  }

  const clamped = clampTier(tier, request.maxTier);
  if (clamped !== tier) reasons.push(`capped at maxTier=${request.maxTier}→${clamped}`);
  tier = clamped;

  return { tier, model: pricing[tier], reason: reasons.join(', ') };
}
