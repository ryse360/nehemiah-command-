// Response cache — the single largest runtime cost lever. A model call that
// repeats an identical (model, prompt) pair within the TTL should never hit
// the provider again; a cache hit costs $0 and returns instantly.
//
// SERVER-ONLY. In-memory, insertion-order LRU with a TTL and a pluggable clock
// (a shared Redis/Postgres cache can back the same interface later).

import type { Clock } from '@/nehemiah/cost';

/** Light normalization so trivial whitespace/case differences still hit. */
export function cacheKey(model: string, prompt: string): string {
  const norm = prompt.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${model}\n${norm}`;
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface ResponseCacheConfig {
  maxEntries: number;
  ttlMs: number;
}

export const DEFAULT_CACHE: ResponseCacheConfig = {
  maxEntries: 1000,
  ttlMs: 15 * 60 * 1000, // 15 minutes
};

export class ResponseCache<V> {
  private readonly map = new Map<string, CacheEntry<V>>();
  private readonly now: Clock;
  private readonly config: ResponseCacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(now: Clock, config: ResponseCacheConfig = DEFAULT_CACHE) {
    this.now = now;
    this.config = config;
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      this.misses += 1;
      return undefined;
    }
    // refresh recency (insertion-order LRU): delete + re-set moves it to newest
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + this.config.ttlMs });
    // evict oldest while over capacity
    while (this.map.size > this.config.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get stats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      size: this.map.size,
    };
  }
}
