// Public surface of the platform speech layer.
//
// Phase 0, boundary-independent slice: the governed speech CONTRACT and
// validated CONFIG. The provider transport (Voicebox handshake), orchestrator,
// and playback controller are added after the deployed-origin compatibility
// probe selects a supported browser + transport strategy — see
// docs/superpowers/specs/2026-07-27-voicebox-voice-output-design.md.

export type {
  VoiceUtterance,
  SpeechOutcome,
  SpeechFailureReason,
  SpeechLocale,
  SpeechPriority,
  InterruptionPolicy,
  VoiceboxConfig,
} from './types.ts';

export {
  resolveVoiceConfig,
  isApprovedLoopbackUrl,
  DEFAULT_LOCALE,
  type ReadConfigInput,
} from './config.ts';
