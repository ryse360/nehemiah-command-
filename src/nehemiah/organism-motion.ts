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

export interface FloatParameters {
  floatAmplitude: number;
  floatSpeed: number;
}

export interface FloatOffset {
  x: number;
  y: number;
}

// A gentle, weightless bob: the organism rises and falls on a slow sine, with
// a slower, smaller lateral sway layered on so the drift never repeats on a
// mechanical loop. Starts exactly at origin so a state change never snaps it.
export function organismFloatOffset(
  elapsedSeconds: number,
  { floatAmplitude, floatSpeed }: FloatParameters,
  motionScale: number,
): FloatOffset {
  const y = Math.sin(elapsedSeconds * floatSpeed * Math.PI * 2) * floatAmplitude;
  const x =
    Math.sin(elapsedSeconds * floatSpeed * Math.PI * 2 * 0.37) *
    floatAmplitude *
    0.35;

  return { x: x * motionScale, y: y * motionScale };
}
