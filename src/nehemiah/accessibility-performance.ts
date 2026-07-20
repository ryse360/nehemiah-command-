export type AccessibilityContractInput = {
  hasSkipLink: boolean;
  hasMainLandmark: boolean;
  controlsHaveNames: boolean;
  visibleFocus: boolean;
  reducedMotion: boolean;
  minimumTargetSize: number;
};

export function assessAccessibilityContract(input: AccessibilityContractInput) {
  const failures: string[] = [];
  if (!input.hasSkipLink) failures.push('Skip navigation link is missing.');
  if (!input.hasMainLandmark) failures.push('Main landmark is missing.');
  if (!input.controlsHaveNames) failures.push('One or more controls lack an accessible name.');
  if (!input.visibleFocus) failures.push('Visible keyboard focus is missing.');
  if (!input.reducedMotion) failures.push('Reduced-motion behavior is missing.');
  if (input.minimumTargetSize < 44) failures.push('Interactive targets must be at least 44 CSS pixels.');
  return { status: failures.length ? 'fail' as const : 'pass' as const, failures };
}

export type PerformanceSnapshot = { javascriptBytes: number; cssBytes: number; imageBytes: number };
export type PerformanceBudget = PerformanceSnapshot & { totalBytes: number };

export function evaluatePerformanceBudget(snapshot: PerformanceSnapshot, budget: PerformanceBudget) {
  const failures: string[] = [];
  const totalBytes = snapshot.javascriptBytes + snapshot.cssBytes + snapshot.imageBytes;
  if (snapshot.javascriptBytes > budget.javascriptBytes) failures.push('JavaScript exceeds the production budget.');
  if (snapshot.cssBytes > budget.cssBytes) failures.push('CSS exceeds the production budget.');
  if (snapshot.imageBytes > budget.imageBytes) failures.push('Images exceed the production budget.');
  if (totalBytes > budget.totalBytes) failures.push('Total static assets exceed the production budget.');
  return { status: failures.length ? 'fail' as const : 'pass' as const, failures, budget, snapshot: { ...snapshot, totalBytes } };
}
