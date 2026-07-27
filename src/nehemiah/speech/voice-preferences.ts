// The Founder's runtime voice preferences.
//
// Distinct from the deployment capability flag: the flag says whether voice
// EXISTS, these say whether the Founder wants it right now. Pure and
// immutable so the shell can hold them in React state.

export interface VoicePreferences {
  autoSpeak: boolean;
  /** 0..1 */
  volume: number;
  /** 0.5..2 */
  rate: number;
  quietMode: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

export function createVoicePreferences(): VoicePreferences {
  return { autoSpeak: true, volume: 1, rate: 1, quietMode: false };
}

export function setAutoSpeak(prefs: VoicePreferences, autoSpeak: boolean): VoicePreferences {
  return { ...prefs, autoSpeak };
}

export function setVolume(prefs: VoicePreferences, volume: number): VoicePreferences {
  return { ...prefs, volume: clamp(volume, 0, 1) };
}

export function setRate(prefs: VoicePreferences, rate: number): VoicePreferences {
  return { ...prefs, rate: clamp(rate, 0.5, 2) };
}

export function setQuietMode(prefs: VoicePreferences, quietMode: boolean): VoicePreferences {
  return { ...prefs, quietMode };
}

/** Speech is allowed only when the Founder wants it and quiet mode is off. */
export function shouldSpeak(prefs: VoicePreferences): boolean {
  return prefs.autoSpeak && !prefs.quietMode;
}
