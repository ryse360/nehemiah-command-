import test from 'node:test';
import assert from 'node:assert/strict';
import { getStateContent } from './state-content.ts';

test('resting keeps the decision field hidden and invites input', () => {
  const content = getStateContent('resting');
  assert.equal(content.decisionVisible, false);
  assert.equal(content.primaryPrompt, 'What matters most now?');
  assert.deepEqual(content.visibleRegions, ['identity', 'organism', 'command']);
});

test('focus surfaced explains why the selected work comes first', () => {
  const content = getStateContent('focus-surfaced');
  assert.equal(content.focus?.label, "TODAY'S FOCUS");
  assert.match(content.focus?.why ?? '', /Founder-only decision/);
  assert.equal(content.decisionVisible, false);
});

test('decision required exposes the approved decision chain', () => {
  const content = getStateContent('decision-required');
  assert.equal(content.decisionVisible, true);
  assert.deepEqual(content.decision?.sections.map((section) => section.label), [
    'WHY THIS SURFACED',
    'WHAT COULD BECOME POSSIBLE',
    'THE TRADEOFF',
    'VISIBLE ACTION',
    'PROOF REQUIRED',
  ]);
});

test('proof created uses Founder-approved proof language', () => {
  const content = getStateContent('proof-created');
  assert.equal(content.proofMessage, 'Proof change is possible.');
});
