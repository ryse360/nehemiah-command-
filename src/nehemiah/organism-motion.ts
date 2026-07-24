export function resolveMotionScale(reducedMotion: boolean, reducedMotionScale: number): number {
  return reducedMotion ? reducedMotionScale : 1;
}

export function applyReducedMotion(
  value: number,
  reducedMotion: boolean,
  reducedMotionScale: number,
): number {
  return value * resolveMotionScale(reducedMotion, reducedMotionScale);
}
