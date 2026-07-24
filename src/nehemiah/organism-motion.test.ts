import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReducedMotion, resolveMotionScale } from './organism-motion';

test('reduced motion scales down without disabling movement entirely', () => {
  const scale = resolveMotionScale(true, 0.12);

  assert.equal(scale, 0.12);
  assert.ok(scale > 0, 'the organism must still breathe under reduced motion');
});

test('full motion is unaffected when reduced motion is not requested', () => {
  assert.equal(resolveMotionScale(false, 0.12), 1);
});

test('applyReducedMotion scales a value consistently with resolveMotionScale', () => {
  assert.equal(applyReducedMotion(1, true, 0.12), 0.12);
  assert.equal(applyReducedMotion(2, false, 0.12), 2);
});
