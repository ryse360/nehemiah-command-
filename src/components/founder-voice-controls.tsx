'use client';

import type { VoicePreferences } from '@/nehemiah/speech/voice-preferences';

export interface FounderVoiceControlsProps {
  available: boolean;
  preferences: VoicePreferences;
  onToggleAutoSpeak: (on: boolean) => void;
  onToggleQuiet: (on: boolean) => void;
  onVolume: (value: number) => void;
  onStop: () => void;
  onReplay: () => void;
  onReconnect: () => void;
}

/**
 * The Founder's voice controls. Rendered only when the capability is enabled —
 * voice is optional, so the default build shows nothing at all.
 */
export function FounderVoiceControls({
  available,
  preferences,
  onToggleAutoSpeak,
  onToggleQuiet,
  onVolume,
  onStop,
  onReplay,
  onReconnect,
}: FounderVoiceControlsProps) {
  if (!available) return null;

  return (
    <section className="voice-controls" aria-label="Nehemiah voice">
      <label>
        <input
          type="checkbox"
          checked={preferences.autoSpeak}
          onChange={(event) => onToggleAutoSpeak(event.target.checked)}
        />
        Speak aloud
      </label>
      <label>
        <input
          type="checkbox"
          checked={preferences.quietMode}
          onChange={(event) => onToggleQuiet(event.target.checked)}
        />
        Quiet mode
      </label>
      <label>
        Volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={preferences.volume}
          onChange={(event) => onVolume(Number(event.target.value))}
          aria-label="Voice volume"
        />
      </label>
      <button type="button" onClick={onStop}>
        Stop speaking
      </button>
      <button type="button" onClick={onReplay}>
        Replay last
      </button>
      <button type="button" onClick={onReconnect}>
        Reconnect Voicebox
      </button>
    </section>
  );
}
