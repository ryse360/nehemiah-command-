import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryDistributedRateLimitStore } from './distributed-rate-limit';

test('blocks after the configured distributed limit', async () => {
  const store = new InMemoryDistributedRateLimitStore();
  const options = { limit: 2, windowMs: 60_000 };
  assert.equal((await store.consume('login:1', options, 1_000)).allowed, true);
  assert.equal((await store.consume('login:1', options, 2_000)).allowed, true);
  const blocked = await store.consume('login:1', options, 3_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterMs > 0);
});

test('reset clears the shared limiter key', async () => {
  const store = new InMemoryDistributedRateLimitStore();
  const options = { limit: 1, windowMs: 60_000 };
  await store.consume('login:2', options, 1_000);
  assert.equal((await store.consume('login:2', options, 2_000)).allowed, false);
  await store.reset('login:2');
  assert.equal((await store.consume('login:2', options, 3_000)).allowed, true);
});
