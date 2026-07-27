// Public surface of the platform speech layer.
//
// Phase 0: governed contract + config, the Voicebox provider transport, the
// playback controller, and the orchestrator that decides whether to speak.
// See docs/superpowers/specs/2026-07-27-voicebox-voice-output-design.md.

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

export {
  createVoiceboxProvider,
  type VoiceboxProvider,
  type VoiceboxProviderDeps,
  type SynthesizeInput,
  type SynthesizeResult,
} from './providers/voicebox-provider.ts';

export {
  createPlaybackController,
  type PlaybackController,
  type PlaybackControllerDeps,
  type PlaybackResult,
} from './playback-controller.ts';

export {
  createSpeechOrchestrator,
  type SpeechOrchestrator,
  type SpeechOrchestratorDeps,
} from './speech-orchestrator.ts';
