// Model pricing + capability tiers for Nehemiah's cost-controlled AI boundary.
//
// SERVER-ONLY. No client imports, no secrets — just a pricing table and the
// arithmetic to turn token counts into money.
//
// Money is tracked in integer NANO-DOLLARS (1 USD = 1e9 nUSD). A ledger must
// never accumulate floating-point error, and per-token costs are tiny
// fractions of a cent, so a fixed-point integer base unit is the correct
// representation. Humans read/write USD; we convert at the edges.
//
// PRICING IS REPRESENTATIVE AND MUST BE VERIFIED against current published
// rates before any real spend. It is deliberately a plain, overridable table
// (see CostController's `pricing` option) so updating a number never means
// touching logic.

export const NANO_PER_USD = 1_000_000_000;

export type ModelTier = 'economy' | 'standard' | 'premium';

export type ModelId =
  | 'claude-haiku-4-5'
  | 'claude-sonnet-5'
  | 'claude-opus-5';

export interface ModelSpec {
  id: ModelId;
  tier: ModelTier;
  /** USD per 1,000,000 input tokens. Representative — verify before spend. */
  inputUsdPerMillion: number;
  /** USD per 1,000,000 output tokens. Representative — verify before spend. */
  outputUsdPerMillion: number;
}

// One concrete model per tier. Economy handles the high-volume cheap work
// (classification, routing, extraction); standard the everyday drafting and
// summarizing; premium the rare high-stakes reasoning.
export const DEFAULT_MODELS: Record<ModelTier, ModelSpec> = {
  economy: {
    id: 'claude-haiku-4-5',
    tier: 'economy',
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 5,
  },
  standard: {
    id: 'claude-sonnet-5',
    tier: 'standard',
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
  },
  premium: {
    id: 'claude-opus-5',
    tier: 'premium',
    inputUsdPerMillion: 15,
    outputUsdPerMillion: 75,
  },
};

export type PricingTable = Record<ModelTier, ModelSpec>;

export function usdToNano(usd: number): number {
  return Math.round(usd * NANO_PER_USD);
}

export function nanoToUsd(nano: number): number {
  return nano / NANO_PER_USD;
}

/** Per-token cost in nano-dollars, derived from the USD-per-million rate. */
function nanoPerToken(usdPerMillion: number): number {
  // usd/1e6 tokens -> nUSD/token = usdPerMillion * 1e9 / 1e6 = *1000
  return usdPerMillion * 1000;
}

/**
 * Cost of one model call, in integer nano-dollars. Rounded up (ceil) so the
 * ledger never *under*-charges — a budget guard that rounds spending down
 * would let usage creep past a ceiling a fraction at a time.
 */
export function costNano(
  spec: ModelSpec,
  inputTokens: number,
  outputTokens: number,
): number {
  const input = inputTokens * nanoPerToken(spec.inputUsdPerMillion);
  const output = outputTokens * nanoPerToken(spec.outputUsdPerMillion);
  return Math.ceil(input + output);
}
