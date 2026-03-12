// ============================================================
// Voice Assistant Types for expo-ai-kit
// ============================================================

import type { LLMMessage, LLMStreamEvent } from '../types';

// --- Configuration ---

export type VoiceAssistantLanguage =
  | 'en' | 'tr' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl'
  | 'ja' | 'ko' | 'zh' | 'ar' | 'hi' | 'ru' | 'pl' | 'sv';

export type WhisperModel =
  | 'whisper-tiny-en'     // ~150MB, English only, fastest
  | 'whisper-tiny'        // ~150MB, multilingual
  | 'whisper-base-en'     // ~300MB, English only, better accuracy
  | 'whisper-base'        // ~300MB, multilingual
  | 'whisper-small-en'    // ~600MB, English only, best accuracy
  | 'whisper-small';      // ~600MB, multilingual

export type TTSVoice =
  | 'af_heart'   // American Female (default)
  | 'af_sky'     // American Female (Sky)
  | 'am_adam'    // American Male
  | 'bf_emma'    // British Female
  | 'bm_george'; // British Male

export type TTSModel =
  | 'kokoro-small'   // ~87MB, faster, lower quality
  | 'kokoro-medium'; // ~174MB, better quality

export interface VoiceAssistantConfig {
  /** Language for STT transcription. Default: 'en' */
  language?: VoiceAssistantLanguage;

  /** Whisper model variant. Default: 'whisper-tiny-en' */
  sttModel?: WhisperModel;

  /** Kokoro TTS model variant. Default: 'kokoro-medium' */
  ttsModel?: TTSModel;

  /** TTS voice selection. Default: 'af_heart' */
  ttsVoice?: TTSVoice;

  /** System prompt for the LLM. Default: 'You are a helpful voice assistant. Keep responses concise and conversational.' */
  systemPrompt?: string;

  /** Max conversation turns to keep in memory. Default: 10 */
  maxTurns?: number;

  /** Whether to auto-play TTS after LLM response. Default: true */
  autoPlayResponse?: boolean;

  /** TTS speech speed (0.5 to 2.0). Default: 1.0 */
  speechSpeed?: number;

  /** Whether to use streaming STT (real-time) or batch transcription. Default: 'streaming' */
  sttMode?: 'streaming' | 'batch';

  /** Callback when an error occurs in any pipeline stage */
  onError?: (error: VoiceAssistantError) => void;
}

// --- State ---

export type VoiceAssistantStage =
  | 'idle'           // Waiting for user action
  | 'loading'        // Models downloading/loading
  | 'ready'          // All models loaded, ready to use
  | 'listening'      // STT is active, capturing audio
  | 'processing'     // LLM is generating response
  | 'speaking'       // TTS is playing audio
  | 'error';         // Something went wrong

export interface ModelLoadingProgress {
  stt: number;   // 0 to 1
  tts: number;   // 0 to 1
  overall: number; // 0 to 1 (average)
}

export interface VoiceAssistantState {
  /** Current pipeline stage */
  stage: VoiceAssistantStage;

  /** Whether all models are downloaded and loaded */
  isReady: boolean;

  /** Model download/loading progress */
  loadingProgress: ModelLoadingProgress;

  /** Whether the assistant is currently listening to the user */
  isListening: boolean;

  /** Whether the LLM is currently generating a response */
  isProcessing: boolean;

  /** Whether TTS is currently playing audio */
  isSpeaking: boolean;

  /** Real-time STT transcription (updates as user speaks) */
  liveTranscription: string;

  /** Final committed transcription from STT */
  userTranscript: string;

  /** LLM's text response (updates token by token if streaming) */
  assistantResponse: string;

  /** Full conversation history */
  conversationHistory: LLMMessage[];

  /** Current error, if any */
  error: VoiceAssistantError | null;
}

// --- Actions ---

export interface VoiceAssistantActions {
  /** Start listening to the user's voice */
  startListening: () => Promise<void>;

  /** Stop listening and process the captured audio */
  stopListening: () => Promise<void>;

  /** Cancel any ongoing operation (STT, LLM, or TTS) */
  cancel: () => void;

  /** Stop TTS playback but keep the conversation */
  stopSpeaking: () => void;

  /** Send a text message directly (bypassing STT) */
  sendText: (text: string) => Promise<void>;

  /** Replay the last assistant response via TTS */
  replayLastResponse: () => Promise<void>;

  /** Clear conversation history */
  clearHistory: () => void;

  /** Reset the assistant to initial state */
  reset: () => void;
}

// --- Return Type ---

export type UseVoiceAssistantReturn = VoiceAssistantState & VoiceAssistantActions;

// --- Errors ---

export type VoiceAssistantErrorCode =
  | 'EXECUTORCH_NOT_INSTALLED'
  | 'AUDIO_API_NOT_INSTALLED'
  | 'MICROPHONE_PERMISSION_DENIED'
  | 'MODEL_DOWNLOAD_FAILED'
  | 'MODEL_LOAD_FAILED'
  | 'STT_FAILED'
  | 'LLM_FAILED'
  | 'TTS_FAILED'
  | 'DEVICE_NOT_SUPPORTED'
  | 'INSUFFICIENT_MEMORY';

export class VoiceAssistantError extends Error {
  code: VoiceAssistantErrorCode;
  stage: VoiceAssistantStage;

  constructor(code: VoiceAssistantErrorCode, message: string, stage: VoiceAssistantStage) {
    super(message);
    this.name = 'VoiceAssistantError';
    this.code = code;
    this.stage = stage;
  }
}

// --- Events ---

export interface VoiceAssistantEvents {
  onListeningStart?: () => void;
  onListeningEnd?: (transcript: string) => void;
  onResponseStart?: () => void;
  onResponseToken?: (event: LLMStreamEvent) => void;
  onResponseEnd?: (fullResponse: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onError?: (error: VoiceAssistantError) => void;
}
