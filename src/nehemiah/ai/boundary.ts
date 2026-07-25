// The AI boundary — the ONE server-side entry point every model call and
// memory write goes through. It composes: complexity routing + hard-fail
// ceilings (CostController), response caching (ResponseCache), usage telemetry
// (UsageTelemetry), and memory admission (MemoryAdmission).
//
// The model call itself is an INJECTED executor. Today tests inject a synthetic
// executor (no network, no keys); a later slice injects the real Vercel AI SDK
// call — nothing else in this file changes. That injection point is the seam
// between "all synthetic" and "real spend", and every control sits in front of
// it.
//
// SERVER-ONLY.

import {
  CostController,
  DEFAULT_MODELS,
  costNano,
  type Ceilings,
  type Clock,
  type ModelId,
  type ModelSpec,
  type ModelTier,
  type PricingTable,
  type TaskComplexity,
} from '@/nehemiah/cost';
import {
  MemoryAdmission,
  type AdmissionDecision,
  type DedupConfig,
  type MemoryCandidate,
  type SalienceConfig,
} from '@/nehemiah/memory';
import { ResponseCache, cacheKey, type ResponseCacheConfig } from './cache';
import { UsageTelemetry, type TelemetryReport } from './telemetry';

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  text: string;
}

export type ModelExecutor = (model: ModelSpec, prompt: string) => Promise<ModelUsage>;

export interface CompletionRequest {
  agent: string;
  task: string;
  complexity: TaskComplexity;
  prompt: string;
  estInputTokens?: number;
  estOutputTokens?: number;
  escalate?: boolean;
  maxTier?: ModelTier;
  /** Defaults to true; set false for prompts that must always run fresh. */
  cacheable?: boolean;
}

export interface Completion {
  text: string;
  cached: boolean;
  model: ModelId;
  tier: ModelTier;
  costNano: number;
}

export interface AIBoundaryOptions {
  now: Clock;
  ceilings: Ceilings;
  executor: ModelExecutor;
  pricing?: PricingTable;
  cache?: ResponseCacheConfig;
  salience?: SalienceConfig;
  dedup?: DedupConfig;
}

export interface BoundaryReport {
  telemetry: TelemetryReport;
  cache: { hits: number; misses: number; hitRate: number; size: number };
  memory: ReturnType<MemoryAdmission['getStats']>;
  spentTodayUsd: number;
}

export class AIBoundary {
  readonly cost: CostController;
  readonly memory: MemoryAdmission;
  private readonly cache: ResponseCache<ModelUsage>;
  private readonly telemetry = new UsageTelemetry();
  private readonly executor: ModelExecutor;
  private readonly pricing: PricingTable;

  constructor(options: AIBoundaryOptions) {
    this.pricing = options.pricing ?? DEFAULT_MODELS;
    this.cost = new CostController({
      now: options.now,
      ceilings: options.ceilings,
      pricing: this.pricing,
    });
    this.cache = new ResponseCache<ModelUsage>(options.now, options.cache);
    this.memory = new MemoryAdmission({ salience: options.salience, dedup: options.dedup });
    this.executor = options.executor;
  }

  /** The naive baseline: the same tokens at the premium tier, never cached. */
  private naiveCostNano(inputTokens: number, outputTokens: number): number {
    return costNano(this.pricing.premium, inputTokens, outputTokens);
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    const decision = this.cost.route({
      complexity: request.complexity,
      escalate: request.escalate,
      maxTier: request.maxTier,
    });
    const cacheable = request.cacheable ?? true;
    const key = cacheKey(decision.model.id, request.prompt);

    if (cacheable) {
      const hit = this.cache.get(key);
      if (hit) {
        // a cache hit spends nothing: it never touches the ledger, but
        // telemetry records the spend it AVOIDED.
        this.telemetry.record({
          agent: request.agent,
          task: request.task,
          model: decision.model.id,
          tier: decision.tier,
          inputTokens: hit.inputTokens,
          outputTokens: hit.outputTokens,
          costNano: 0,
          naiveCostNano: this.naiveCostNano(hit.inputTokens, hit.outputTokens),
          cached: true,
        });
        return {
          text: hit.text,
          cached: true,
          model: decision.model.id,
          tier: decision.tier,
          costNano: 0,
        };
      }
    }

    // Estimate BEFORE the call so the ceiling can refuse it. Fall back to a
    // conservative token estimate from the prompt length (~4 chars/token).
    const estInput = request.estInputTokens ?? Math.ceil(request.prompt.length / 4);
    const estOutput = request.estOutputTokens ?? 400;
    const estCost = this.cost.estimate(decision.model, estInput, estOutput);
    this.cost.authorize(request.agent, estCost); // throws BudgetExceededError if over

    const usage = await this.executor(decision.model, request.prompt);

    const entry = this.cost.record({
      agent: request.agent,
      task: request.task,
      plan: decision,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    this.telemetry.record({
      agent: request.agent,
      task: request.task,
      model: decision.model.id,
      tier: decision.tier,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costNano: entry.costNano,
      naiveCostNano: this.naiveCostNano(usage.inputTokens, usage.outputTokens),
      cached: false,
    });

    if (cacheable) this.cache.set(key, usage);

    return {
      text: usage.text,
      cached: false,
      model: decision.model.id,
      tier: decision.tier,
      costNano: entry.costNano,
    };
  }

  /** Admit (or reject) a memory candidate through the write/dedup gate. */
  remember(id: string, candidate: MemoryCandidate): AdmissionDecision {
    return this.memory.evaluate(id, candidate);
  }

  report(): BoundaryReport {
    return {
      telemetry: this.telemetry.report(),
      cache: this.cache.stats,
      memory: this.memory.getStats(),
      spentTodayUsd: this.cost.report().totalUsd,
    };
  }
}
