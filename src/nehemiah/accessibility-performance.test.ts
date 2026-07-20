import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAccessibilityContract, evaluatePerformanceBudget } from './accessibility-performance';

test('accessibility contract requires navigation, main landmark, labels, focus and reduced motion', () => {
  const result = assessAccessibilityContract({
    hasSkipLink: true,
    hasMainLandmark: true,
    controlsHaveNames: true,
    visibleFocus: true,
    reducedMotion: true,
    minimumTargetSize: 44,
  });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.failures, []);
});

test('accessibility contract reports missing requirements', () => {
  const result = assessAccessibilityContract({
    hasSkipLink: false,
    hasMainLandmark: true,
    controlsHaveNames: true,
    visibleFocus: false,
    reducedMotion: true,
    minimumTargetSize: 32,
  });
  assert.equal(result.status, 'fail');
  assert.equal(result.failures.length, 3);
});

test('performance budget rejects an oversized production bundle', () => {
  const result = evaluatePerformanceBudget(
    { javascriptBytes: 800_000, cssBytes: 30_000, imageBytes: 0 },
    { javascriptBytes: 750_000, cssBytes: 90_000, imageBytes: 500_000, totalBytes: 1_300_000 },
  );
  assert.equal(result.status, 'fail');
  assert.match(result.failures[0], /JavaScript/);
});
