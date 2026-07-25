// Cost governance for the REAL AI path. A decorator around any AIModelProvider
// (the production OpenAICompatibleResponsesProvider) that adds the three things
// the real orchestration path lacks: response caching, a hard per-call spend
// ceiling, and usage telemetry. The seam is AIModelProvider.generate, so
// orchestrateDecisionPreparation and the route are untouched.
//
// SERVER-ONLY.
//
// Honest limits (see docs): the deployment uses a SINGLE model, so complexity
// routing is deferred; and an in-memory ledger only accumulates within a warm
// process, so the DAILY ceiling is best-effort here — a durable Postgres ledger
// (step 2b) is the real daily cap. The per-OPERATION ceiling and caching are
// reliable per invocation. Costs are estimated from text length until the
// provider's token usage is captured.

import {
  AIOrchestrationError,
  type AIModelProvider,
  type AIProviderResponse,
} from './ai-orchestration';
import {
  BudgetExceededError,
  BudgetLedger,
  SpendGuard,
  costNano,
  nanoToUsd,
  type Clock,
  type ModelSpec,
} from './cost';
import { ResponseCache, cacheKey } from './ai/cache';
import { UsageTelemetry } from './ai/telemetry';

export interface GovernedProviderConfig {
  /** Pricing for the configured model (routing is deferred to one tier). */
  model: ModelSpec;
  dailyUsdCeiling: number;
  perOperationUsdCeiling: number;
  now?: Clock;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  /** Conservative output-token estimate for the pre-call authorization. */
  estOutputTokens?: number;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class GovernedProvider implements AIModelProvider {
  private readonly ledger: BudgetLedger;
  private readonly guard: SpendGuard;
  private readonly cache: ResponseCache<AIProviderResponse>;
  private readonly telemetry = new UsageTelemetry();
  private readonly agent = 'founder-ai';

  constructor(
    private readonly inner: AIModelProvider,
    private readonly config: GovernedProviderConfig,
  ) {
    const now = config.now ?? (() => Date.now());
    this.ledger = new BudgetLedger(now);
    this.guard = new SpendGuard(this.ledger, {
      dailyUsd: config.dailyUsdCeiling,
      perOperationUsd: config.perOperationUsdCeiling,
    });
    this.cache = new ResponseCache<AIProviderResponse>(now, {
      ttlMs: config.cacheTtlMs ?? 10 * 60 * 1000,
      maxEntries: config.cacheMaxEntries ?? 500,
    });
  }

  async generate(input: {
    system: string;
    user: string;
    schema: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<AIProviderResponse> {
    const key = cacheKey(this.config.model.id, `${input.system}\n${input.user}`);
    const estIn = estimateTokens(`${input.system}\n${input.user}`);

    const hit = this.cache.get(key);
    if (hit) {
      const outTokens = estimateTokens(JSON.stringify(hit.output));
      // a cache hit spends nothing; telemetry records the spend it AVOIDED.
      this.telemetry.record({
        agent: this.agent,
        task: 'decision-preparation',
        model: this.config.model.id,
        tier: this.config.model.tier,
        inputTokens: estIn,
        outputTokens: outTokens,
        costNano: 0,
        naiveCostNano: costNano(this.config.model, estIn, outTokens),
        cached: true,
      });
      return hit;
    }

    const estCost = costNano(
      this.config.model,
      estIn,
      this.config.estOutputTokens ?? 900,
    );
    try {
      this.guard.authorize(this.agent, estCost);
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        // map the budget breach into the route's error taxonomy (→ 502) with a
        // clear, non-retryable message rather than crashing the request.
        throw new AIOrchestrationError(
          'provider_unavailable',
          `AI spend ceiling reached (${error.kind}); request refused to protect the budget.`,
          false,
        );
      }
      throw error;
    }

    const response = await this.inner.generate(input);

    const outTokens = estimateTokens(JSON.stringify(response.output));
    const cost = costNano(this.config.model, estIn, outTokens);
    this.ledger.record({
      agent: this.agent,
      task: 'decision-preparation',
      model: this.config.model.id,
      tier: this.config.model.tier,
      inputTokens: estIn,
      outputTokens: outTokens,
      costNano: cost,
    });
    this.telemetry.record({
      agent: this.agent,
      task: 'decision-preparation',
      model: this.config.model.id,
      tier: this.config.model.tier,
      inputTokens: estIn,
      outputTokens: outTokens,
      costNano: cost,
      naiveCostNano: cost,
      cached: false,
    });
    this.cache.set(key, response);
    return response;
  }

  /** Operational snapshot — spend today, cache hit rate, avoided cost. */
  report() {
    return {
      spentTodayUsd: nanoToUsd(this.ledger.spentOnDayNano()),
      telemetry: this.telemetry.report(),
      cache: this.cache.stats,
    };
  }
}

// A representative default price for the configured model (verify against the
// real provider's published rate; overridable via env). Used only for the
// estimate-based ceiling + telemetry, not billing.
function modelSpecFromEnv(modelId: string): ModelSpec {
  const num = (key: string, fallback: number) => {
    const v = Number(process.env[key]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    id: modelId as ModelSpec['id'],
    tier: 'standard',
    inputUsdPerMillion: num('NEHEMIAH_AI_INPUT_USD_PER_M', 3),
    outputUsdPerMillion: num('NEHEMIAH_AI_OUTPUT_USD_PER_M', 15),
  };
}

// Module-scope singleton so caching and the in-process daily ledger persist
// across requests in a warm serverless container (they reset on cold start —
// the durable daily cap is step 2b). Keyed by model id so a config change
// rebuilds it.
let cached: { modelId: string; provider: GovernedProvider } | null = null;

export function governedProviderFromEnv(
  inner: AIModelProvider,
  modelId: string,
): GovernedProvider {
  if (cached && cached.modelId === modelId) return cached.provider;
  const num = (key: string, fallback: number) => {
    const v = Number(process.env[key]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  const provider = new GovernedProvider(inner, {
    model: modelSpecFromEnv(modelId),
    dailyUsdCeiling: num('NEHEMIAH_AI_DAILY_USD', 25),
    perOperationUsdCeiling: num('NEHEMIAH_AI_PER_CALL_USD', 1),
  });
  cached = { modelId, provider };
  return provider;
}
