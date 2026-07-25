import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DedupIndex,
  MemoryAdmission,
  jaccard,
  normalize,
  scoreSalience,
  shingles,
  type MemoryCandidate,
} from './index';

test('salience keeps decisions and drops chatter', () => {
  const decision = scoreSalience({
    text: 'Founder decided to prioritize the debt-payoff plan over new hires this quarter.',
    kind: 'decision',
  });
  assert.equal(decision.salient, true);

  const chatter = scoreSalience({
    text: 'Founder decided to prioritize the debt-payoff plan over new hires this quarter.',
    kind: 'chatter',
  });
  assert.equal(chatter.salient, false);
});

test('salience drops thin text unless importance overrides', () => {
  const thin = scoreSalience({ text: 'ok thanks', kind: 'fact' });
  assert.equal(thin.salient, false);

  const forced = scoreSalience({ text: 'ok thanks', kind: 'fact', importance: 0.9 });
  assert.equal(forced.salient, true);
  assert.match(forced.reason, /importance/);
});

test('normalize + shingles + jaccard behave', () => {
  assert.equal(normalize('  Hello, WORLD!!  '), 'hello world');
  const a = shingles('a b c d', 2);
  const b = shingles('a b c d e', 2);
  // {ab,bc,cd} vs {ab,bc,cd,de} -> 3/4
  assert.equal(jaccard(a, b), 0.75);
  assert.equal(jaccard(shingles('a b c', 2), shingles('x y z', 2)), 0);
});

test('dedup catches exact (case/whitespace-insensitive) and near duplicates', () => {
  const idx = new DedupIndex();
  idx.add('m1', 'Founder prefers concise morning briefings before 9am');

  const exact = idx.check('  founder PREFERS concise morning briefings before 9am. ');
  assert.equal(exact.kind, 'exact');
  assert.equal(exact.matchId, 'm1');

  const near = idx.check('Founder prefers concise morning briefings before 9am on weekdays');
  assert.equal(near.duplicate, true);
  assert.equal(near.kind, 'near');

  const distinct = idx.check('Quarterly revenue grew twelve percent versus last year');
  assert.equal(distinct.duplicate, false);
});

test('admission writes salient novel memories and embeds them', () => {
  const admit = new MemoryAdmission();
  const d = admit.evaluate('m1', {
    text: 'Founder decided to delay the Series A raise until Q3 to preserve leverage.',
    kind: 'decision',
  });
  assert.equal(d.action, 'write');
  assert.equal(d.embed, true);
});

test('admission skips a near-duplicate WITHOUT embedding it', () => {
  const admit = new MemoryAdmission();
  admit.evaluate('m1', {
    text: 'Founder decided to delay the Series A raise until Q3 to preserve leverage.',
    kind: 'decision',
  });
  const dup = admit.evaluate('m2', {
    text: 'The Founder decided to delay the Series A raise until Q3 to preserve leverage now.',
    kind: 'decision',
  });
  assert.equal(dup.action, 'skip');
  assert.equal(dup.embed, false);
  assert.equal(dup.duplicateOf, 'm1');
});

test('a synthetic stream memorializes signal, not noise', () => {
  const admit = new MemoryAdmission();
  const stream: Array<[string, MemoryCandidate]> = [
    ['1', { text: 'Founder decided to consolidate vendors to cut $40k annual spend.', kind: 'decision' }],
    ['2', { text: 'thanks!', kind: 'transient' }],
    ['3', { text: 'Founder decided to consolidate vendors to cut $40k annual spend today.', kind: 'decision' }], // near-dup of 1
    ['4', { text: 'Founder prefers async written updates over standup meetings.', kind: 'preference' }],
    ['5', { text: 'ok', kind: 'chatter' }],
    ['6', { text: 'Quarterly churn dropped to 2.1% after the onboarding revamp shipped.', kind: 'fact' }],
  ];

  for (const [id, candidate] of stream) admit.evaluate(id, candidate);

  const stats = admit.getStats();
  assert.equal(stats.seen, 6);
  assert.equal(stats.written, 3); // decision(1), preference(4), fact(6)
  assert.equal(stats.skippedNotSalient, 2); // transient(2), chatter(5)
  assert.equal(stats.skippedDuplicate, 1); // near-dup(3)
  // three of six candidates never hit the embedding model
  assert.equal(stats.embedsAvoided, 3);
});
