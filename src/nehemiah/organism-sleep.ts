import type { OrganismParameters } from './organism-parameters';

// After five minutes without interaction the organism settles into a dark,
// quiet sleep — dimmed and slowed, but never switched off.
export const SLEEP_TIMEOUT_MS = 5 * 60 * 1000;

export function toSleepParameters(parameters: OrganismParameters): OrganismParameters {
  return {
    ...parameters,
    breathingSpeed: parameters.breathingSpeed * 0.6,
    breathingAmplitude: parameters.breathingAmplitude * 0.7,
    particleVelocity: parameters.particleVelocity * 0.3,
    goldIntensity: parameters.goldIntensity * 0.34,
    indigoIntensity: parameters.indigoIntensity * 0.1,
    indigoConvergence: parameters.indigoConvergence * 0.4,
    coreIntensity: parameters.coreIntensity * 0.32,
    rotationDrift: parameters.rotationDrift * 0.5,
    coreHaloOpacity: parameters.coreHaloOpacity * 0.4,
    corePulseRate: parameters.corePulseRate * 0.55,
    floatAmplitude: parameters.floatAmplitude * 0.55,
    floatSpeed: parameters.floatSpeed * 0.5,
    camera: { ...parameters.camera },
    lighting: {
      ambientIntensity: parameters.lighting.ambientIntensity * 0.62,
      directionalIntensity: parameters.lighting.directionalIntensity * 0.45,
      hemisphereIntensity: parameters.lighting.hemisphereIntensity * 0.5,
    },
    reducedMotion: { ...parameters.reducedMotion },
  };
}

// Testing/preview seam: `?idleMs=3000` shortens the timer. Any missing,
// non-numeric, or non-positive value falls back to the real five minutes.
export function resolveIdleTimeoutMs(override: string | null): number {
  if (override === null) {
    return SLEEP_TIMEOUT_MS;
  }
  const parsed = Number(override);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return SLEEP_TIMEOUT_MS;
  }
  return parsed;
}
