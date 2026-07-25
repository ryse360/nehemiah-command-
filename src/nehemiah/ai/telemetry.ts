// Usage telemetry — turns the whole boundary into a dollar-denominated
// decision artifact. Every model call is recorded with BOTH its controlled
// cost (what routing + caching actually spent) and its naive cost (what an
// "always-premium, never-cached" baseline would have spent). The report is
// what the Founder reads to decide when to connect real spend.
//
// SERVER-ONLY.

import { nanoToUsd } from '@/nehemiah/cost';

export interface UsageEvent {
  agent: string;
  task: string;
  model: string;
  tier: string;
  inputTokens: number;
  outputTokens: number;
  /** Actual controlled cost (0 on a cache hit). */
  costNano: number;
  /** What the same tokens would cost at the premium tier with no cache. */
  naiveCostNano: number;
  cached: boolean;
}

export interface TelemetryReport {
  calls: number;
  cacheHits: number;
  cacheHitRate: number;
  controlledUsd: number;
  naiveUsd: number;
  savingsUsd: number;
  savingsPct: number;
  byAgentUsd: Record<string, number>;
  byTierCalls: Record<string, number>;
}

export class UsageTelemetry {
  private readonly events: UsageEvent[] = [];

  record(event: UsageEvent): void {
    this.events.push(event);
  }

  report(): TelemetryReport {
    let controlled = 0;
    let naive = 0;
    let cacheHits = 0;
    const byAgent: Record<string, number> = {};
    const byTier: Record<string, number> = {};

    for (const e of this.events) {
      controlled += e.costNano;
      naive += e.naiveCostNano;
      if (e.cached) cacheHits += 1;
      byAgent[e.agent] = (byAgent[e.agent] ?? 0) + e.costNano;
      byTier[e.tier] = (byTier[e.tier] ?? 0) + 1;
    }

    const calls = this.events.length;
    const savings = naive - controlled;
    const byAgentUsd: Record<string, number> = {};
    for (const [agent, nano] of Object.entries(byAgent)) {
      byAgentUsd[agent] = nanoToUsd(nano);
    }

    return {
      calls,
      cacheHits,
      cacheHitRate: calls === 0 ? 0 : cacheHits / calls,
      controlledUsd: nanoToUsd(controlled),
      naiveUsd: nanoToUsd(naive),
      savingsUsd: nanoToUsd(savings),
      savingsPct: naive === 0 ? 0 : savings / naive,
      byAgentUsd,
      byTierCalls: byTier,
    };
  }

  all(): readonly UsageEvent[] {
    return this.events;
  }
}
