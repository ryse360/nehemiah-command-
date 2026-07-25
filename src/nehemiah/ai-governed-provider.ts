// Cost governance for the REAL AI path. A decorator around any AIModelProvider
// (the production OpenAICompatibleResponsesProvider) that puts three things the
// real orchestration path lacked in front of every call: response caching, a
// durable concurrency-safe spend ceiling (per-call + daily, Phoenix-time), and
// usage telemetry. The seam is AIModelProvider.generate, so
// orchestrateDecisionPreparation and the route stay thin.
//
// SERVER-ONLY. Fails CLOSED: a ceiling breach or ledger/DB error refuses the
// call before the provider runs. Costs reconcile from the provider's MEASURED
// token usage against a versioned price table (estimate only pre-call).

import { createHash } from 'node:crypto';
import {
  AIOrchestrationError,
  type AIModelProvider,
  type AIProviderResponse,
} from './ai-orchestration';
import { nanoToUsd } from './cost';
import { ResponseCache, cacheKey } from './ai/cache';
import { UsageTelemetry } from './ai/telemetry';
import {
  InMemoryUsageLedgerStore,
  UsageBudgetError,
  UsageLedger,
  costNanoFromUsage,
  priceFor,
  type ModelPrice,
  type UsageLedgerStore,
} from './usage-ledger';

export interface GovernedProviderConfig {
  modelId: string;
  ledger: UsageLedger;
  priceTable?: readonly ModelPrice[];
  now?: () => number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  estOutputTokens?: number;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class GovernedProvider implements AIModelProvider {
  private readonly cache: ResponseCache<AIProviderResponse>;
  private readonly telemetry = new UsageTelemetry();
  private readonly agent = 'founder-ai';

  constructor(
    private readonly inner: AIModelProvider,
    private readonly config: GovernedProviderConfig,
  ) {
    const now = config.now ?? (() => Date.now());
    this.cache = new ResponseCache<AIProviderResponse>(now, {
      ttlMs: config.cacheTtlMs ?? 10 * 60 * 1000,
      maxEntries: config.cacheMaxEntries ?? 500,
    });
  }

  private costNanoFor(inputTokens: number, outputTokens: number): number {
    return costNanoFromUsage(
      priceFor(this.config.modelId, this.config.priceTable),
      inputTokens,
      outputTokens,
    );
  }

  async generate(input: {
    system: string;
    user: string;
    schema: Record<string, unknown>;
    timeoutMs: number;
    requestId?: string;
  }): Promise<AIProviderResponse> {
    const key = cacheKey(this.config.modelId, `${input.system}\n${input.user}`);
    const estIn = estimateTokens(`${input.system}\n${input.user}`);
    // stable id per logical request (idempotent across retries); fall back to a
    // content hash for direct callers that don't thread one through.
    const requestId =
      input.requestId ?? createHash('sha256').update(key).digest('hex').slice(0, 40);

    const hit = this.cache.get(key);
    if (hit) {
      const outTokens = hit.usage?.outputTokens ?? estimateTokens(JSON.stringify(hit.output));
      await this.config.ledger.cacheHit({ requestId, agent: this.agent, model: this.config.modelId });
      this.telemetry.record({
        agent: this.agent,
        task: 'decision-preparation',
        model: this.config.modelId,
        tier: 'standard',
        inputTokens: estIn,
        outputTokens: outTokens,
        costNano: 0,
        naiveCostNano: this.costNanoFor(estIn, outTokens),
        cached: true,
      });
      return hit;
    }

    // pre-call reservation — fails CLOSED (throws) if over a ceiling or the
    // ledger is unavailable.
    try {
      await this.config.ledger.reserve({
        requestId,
        agent: this.agent,
        model: this.config.modelId,
        estInputTokens: estIn,
        estOutputTokens: this.config.estOutputTokens ?? 900,
      });
    } catch (error) {
      if (error instanceof UsageBudgetError) {
        throw new AIOrchestrationError(
          'provider_unavailable',
          `AI spend refused (${error.reason}) to protect the budget.`,
          false,
        );
      }
      throw error;
    }

    let response: AIProviderResponse;
    try {
      response = await this.inner.generate(input);
    } catch (error) {
      // provider failed → void the reservation so it costs nothing, then
      // rethrow so orchestration can retry (retry reuses the same requestId).
      await this.config.ledger.fail(requestId);
      throw error;
    }

    const inTokens = response.usage?.inputTokens ?? estIn;
    const outTokens = response.usage?.outputTokens ?? estimateTokens(JSON.stringify(response.output));
    await this.config.ledger.reconcile({
      requestId,
      model: this.config.modelId,
      inputTokens: inTokens,
      outputTokens: outTokens,
    });
    const cost = this.costNanoFor(inTokens, outTokens);
    this.telemetry.record({
      agent: this.agent,
      task: 'decision-preparation',
      model: this.config.modelId,
      tier: 'standard',
      inputTokens: inTokens,
      outputTokens: outTokens,
      costNano: cost,
      naiveCostNano: cost,
      cached: false,
    });
    this.cache.set(key, response);
    return response;
  }

  async report() {
    return {
      spentTodayUsd: nanoToUsd(await this.config.ledger.spentTodayNano()),
      telemetry: this.telemetry.report(),
      cache: this.cache.stats,
    };
  }
}

// Module-scope singleton so the cache persists across requests in a warm
// container. The DAILY ceiling is now durable via Postgres (survives cold
// starts and is concurrency-safe); the in-memory store is only a dev fallback
// when DATABASE_URL is absent.
let cached: { modelId: string; provider: GovernedProvider } | null = null;

export function governedProviderFromEnv(
  inner: AIModelProvider,
  modelId: string,
): GovernedProvider {
  if (cached && cached.modelId === modelId) return cached.provider;

  const num = (envKey: string, fallback: number) => {
    const v = Number(process.env[envKey]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  let store: UsageLedgerStore;
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    // lazy require so the pg client isn't pulled into environments without a DB
    const { PostgresUsageLedgerStore } = require('./postgres-usage-ledger-store') as typeof import('./postgres-usage-ledger-store');
    store = new PostgresUsageLedgerStore(dbUrl);
  } else {
    store = new InMemoryUsageLedgerStore();
  }

  const ledger = new UsageLedger({
    store,
    dailyCeilingUsd: num('NEHEMIAH_AI_DAILY_USD', 25),
    perCallCeilingUsd: num('NEHEMIAH_AI_PER_CALL_USD', 1),
  });

  const provider = new GovernedProvider(inner, { modelId, ledger });
  cached = { modelId, provider };
  return provider;
}
