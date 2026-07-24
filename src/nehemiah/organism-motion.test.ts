import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReducedMotion,
  organismFloatOffset,
  resolveMotionScale,
} from './organism-motion';

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

test('the organism rests at its origin at time zero', () => {
  const offset = organismFloatOffset(0, { floatAmplitude: 0.1, floatSpeed: 0.4 }, 1);

  assert.equal(offset.y, 0);
  assert.equal(offset.x, 0);
});

test('the float is a slow, bounded, graceful drift', () => {
  const amplitude = 0.12;
  let maxY = 0;
  let maxX = 0;

  for (let t = 0; t <= 60; t += 0.1) {
    const offset = organismFloatOffset(t, { floatAmplitude: amplitude, floatSpeed: 0.4 }, 1);
    maxY = Math.max(maxY, Math.abs(offset.y));
    maxX = Math.max(maxX, Math.abs(offset.x));
  }

  // vertical bob reaches the amplitude; lateral drift stays a subtle fraction
  assert.ok(maxY > amplitude * 0.9 && maxY <= amplitude + 1e-9);
  assert.ok(maxX > 0 && maxX < amplitude * 0.6, 'lateral drift is secondary to the bob');
});

test('the float never jumps — successive frames move only a little', () => {
  const params = { floatAmplitude: 0.12, floatSpeed: 0.4 };
  let previous = organismFloatOffset(0, params, 1);

  for (let t = 0.016; t <= 10; t += 0.016) {
    const current = organismFloatOffset(t, params, 1);
    assert.ok(Math.abs(current.y - previous.y) < 0.01, 'no vertical snap between frames');
    previous = current;
  }
});

test('reduced motion quiets the float without freezing it into a dead object', () => {
  const params = { floatAmplitude: 0.12, floatSpeed: 0.4 };
  const full = organismFloatOffset(1.5, params, 1);
  const reduced = organismFloatOffset(1.5, params, 0.12);

  assert.ok(Math.abs(reduced.y) < Math.abs(full.y));
  assert.equal(reduced.y, full.y * 0.12);
});
