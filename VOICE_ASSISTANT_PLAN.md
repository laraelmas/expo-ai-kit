# PLAN: Voice Assistant Pipeline for expo-ai-kit

## Context

`expo-ai-kit` is an open-source on-device AI library for Expo/React Native apps.
- **GitHub**: https://github.com/laraelmas/expo-ai-kit
- **Current version**: 0.1.19
- **Weekly downloads**: ~8,500
- **Current capabilities**: Text-only LLM via Apple Foundation Models (iOS 26+) and Google ML Kit Prompt API (Android)
- **Current API surface**: `isAvailable()`, `sendMessage()`, `streamMessage()`, `ChatMemoryManager`
- **Architecture**: Expo Module (Swift for iOS, Kotlin for Android, TypeScript API layer in `src/`)

## Goal

Add a **Voice Assistant Pipeline** feature that chains:
1. **STT** (Speech-to-Text) — microphone → text (via `react-native-executorch` Whisper)
2. **LLM** (Language Model) — text → response (via existing expo-ai-kit OS model)
3. **TTS** (Text-to-Speech) — response → audio (via `react-native-executorch` Kokoro)

This creates a full voice-in/voice-out assistant running **100% on-device** with a single hook.

## Architecture Decision

`react-native-executorch` is an **optional peer dependency**. The existing expo-ai-kit API remains unchanged. Users who don't install `react-native-executorch` keep using text-only features as before.

---

## Phase 1: Package Configuration

### 1.1 Update package.json

```json
{
  "peerDependencies": {
    "react-native-executorch": ">=0.5.0",
    "react-native-audio-api": ">=0.5.0",
    "@react-native-executorch/expo-resource-fetcher": ">=0.1.0",
    "expo-file-system": ">=18.0.0",
    "expo-asset": ">=11.0.0"
  },
  "peerDependenciesMeta": {
    "react-native-executorch": { "optional": true },
    "react-native-audio-api": { "optional": true },
    "@react-native-executorch/expo-resource-fetcher": { "optional": true },
    "expo-file-system": { "optional": true },
    "expo-asset": { "optional": true }
  }
}
```

### 1.2 Update tsconfig.json

Ensure TypeScript can resolve optional imports without errors. Add to `compilerOptions`:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "skipLibCheck": true
  }
}
```

---

## Phase 2: File Structure

Create the following new files inside `src/`:

```
src/
├── index.ts                          # Existing — add new exports
├── ExpoAiKit.types.ts               # Existing types
├── ExpoAiKitModule.ts               # Existing native module bridge
│
├── voice/                            # NEW — Voice Assistant feature
│   ├── index.ts                      # Barrel exports for voice module
│   ├── types.ts                      # All voice-related TypeScript types
│   ├── useVoiceAssistant.ts          # Main high-level hook
│   ├── useVoicePipeline.ts          # Internal orchestration hook
│   ├── useSpeechToTextBridge.ts      # Wrapper around ExecuTorch STT
│   ├── useTextToSpeechBridge.ts      # Wrapper around ExecuTorch TTS
│   ├── VoiceAssistantProvider.tsx    # Optional React context provider
│   ├── audioUtils.ts                 # Audio recording helpers
│   └── dependencyCheck.ts           # Runtime check for optional deps
```

---

## Phase 3: Type Definitions

### 3.1 `src/voice/types.ts`

```typescript
// ============================================================
// Voice Assistant Types for expo-ai-kit
// ============================================================

import type { LLMMessage, LLMStreamEvent } from '../ExpoAiKit.types';

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
```

---

## Phase 4: Implementation

### 4.1 Dependency Check (`src/voice/dependencyCheck.ts`)

This is the critical file that handles optional dependency resolution at runtime.

```typescript
// Runtime checks for optional peer dependencies.
// expo-ai-kit works without these — they're only needed for voice features.

interface ExecutorchModule {
  useSpeechToText: any;
  useTextToSpeech: any;
  WHISPER_TINY_EN: any;
  WHISPER_TINY: any;
  WHISPER_BASE_EN: any;
  WHISPER_BASE: any;
  WHISPER_SMALL_EN: any;
  WHISPER_SMALL: any;
  KOKORO_SMALL: any;
  KOKORO_MEDIUM: any;
  KOKORO_VOICE_AF_HEART: any;
  KOKORO_VOICE_AF_SKY: any;
  KOKORO_VOICE_AM_ADAM: any;
  KOKORO_VOICE_BF_EMMA: any;
  KOKORO_VOICE_BM_GEORGE: any;
  initExecutorch: any;
}

interface AudioApiModule {
  AudioContext: any;
  AudioManager: any;
  AudioRecorder: any;
}

interface ResourceFetcherModule {
  ExpoResourceFetcher: any;
}

let _executorch: ExecutorchModule | null = null;
let _audioApi: AudioApiModule | null = null;
let _resourceFetcher: ResourceFetcherModule | null = null;

export function getExecutorch(): ExecutorchModule {
  if (!_executorch) {
    try {
      _executorch = require('react-native-executorch');
    } catch {
      throw new Error(
        '[expo-ai-kit] Voice features require react-native-executorch.\n' +
        'Install it with: npx expo install react-native-executorch @react-native-executorch/expo-resource-fetcher expo-file-system expo-asset'
      );
    }
  }
  return _executorch;
}

export function getAudioApi(): AudioApiModule {
  if (!_audioApi) {
    try {
      _audioApi = require('react-native-audio-api');
    } catch {
      throw new Error(
        '[expo-ai-kit] Voice features require react-native-audio-api.\n' +
        'Install it with: npx expo install react-native-audio-api'
      );
    }
  }
  return _audioApi;
}

export function getResourceFetcher(): ResourceFetcherModule {
  if (!_resourceFetcher) {
    try {
      _resourceFetcher = require('@react-native-executorch/expo-resource-fetcher');
    } catch {
      throw new Error(
        '[expo-ai-kit] Voice features require @react-native-executorch/expo-resource-fetcher.\n' +
        'Install it with: npx expo install @react-native-executorch/expo-resource-fetcher'
      );
    }
  }
  return _resourceFetcher;
}

export function isVoiceAvailable(): boolean {
  try {
    getExecutorch();
    getAudioApi();
    getResourceFetcher();
    return true;
  } catch {
    return false;
  }
}
```

### 4.2 STT Bridge (`src/voice/useSpeechToTextBridge.ts`)

Wraps `react-native-executorch`'s `useSpeechToText` with expo-ai-kit's conventions.

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { getExecutorch, getAudioApi } from './dependencyCheck';
import type { WhisperModel, VoiceAssistantLanguage } from './types';

// Map our model names to ExecuTorch constants
function getSTTModelConstant(model: WhisperModel) {
  const et = getExecutorch();
  const map: Record<WhisperModel, any> = {
    'whisper-tiny-en': et.WHISPER_TINY_EN,
    'whisper-tiny': et.WHISPER_TINY,
    'whisper-base-en': et.WHISPER_BASE_EN,
    'whisper-base': et.WHISPER_BASE,
    'whisper-small-en': et.WHISPER_SMALL_EN,
    'whisper-small': et.WHISPER_SMALL,
  };
  return map[model];
}

interface STTBridgeConfig {
  model: WhisperModel;
  language?: VoiceAssistantLanguage;
  mode: 'streaming' | 'batch';
}

interface STTBridgeReturn {
  isReady: boolean;
  downloadProgress: number;
  isListening: boolean;
  committedTranscription: string;
  nonCommittedTranscription: string;
  error: Error | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

export function useSpeechToTextBridge(config: STTBridgeConfig): STTBridgeReturn {
  const et = getExecutorch();
  const audioApi = getAudioApi();

  // Initialize ExecuTorch STT
  const sttModel = et.useSpeechToText({
    model: getSTTModelConstant(config.model),
  });

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const recorderRef = useRef<any>(null);

  // Create audio recorder on mount
  useEffect(() => {
    recorderRef.current = new audioApi.AudioRecorder({
      sampleRate: 16000,
      bufferLengthInSamples: 1600,
    });

    audioApi.AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'spokenAudio',
      iosOptions: ['allowBluetooth', 'defaultToSpeaker'],
    });

    audioApi.AudioManager.requestRecordingPermissions();

    return () => {
      if (recorderRef.current && isListening) {
        recorderRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!sttModel.isReady || !recorderRef.current) return;

    setIsListening(true);
    setError(null);

    const recorder = recorderRef.current;

    if (config.mode === 'streaming') {
      recorder.onAudioReady(({ buffer }: any) => {
        const bufferArray = Array.from(buffer.getChannelData(0));
        sttModel.streamInsert(bufferArray);
      });

      recorder.start();

      try {
        const decodingOptions = config.language !== 'en'
          ? { language: config.language }
          : undefined;
        await sttModel.stream(decodingOptions);
      } catch (err: any) {
        setError(err);
        setIsListening(false);
      }
    }
  }, [sttModel.isReady, config.mode, config.language]);

  const stopListening = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
    }
    sttModel.streamStop();
    setIsListening(false);
  }, []);

  return {
    isReady: sttModel.isReady,
    downloadProgress: sttModel.downloadProgress ?? 0,
    isListening,
    committedTranscription: sttModel.committedTranscription ?? '',
    nonCommittedTranscription: sttModel.nonCommittedTranscription ?? '',
    error,
    startListening,
    stopListening,
  };
}
```

### 4.3 TTS Bridge (`src/voice/useTextToSpeechBridge.ts`)

Wraps `react-native-executorch`'s `useTextToSpeech`.

```typescript
import { useRef, useState, useCallback } from 'react';
import { getExecutorch, getAudioApi } from './dependencyCheck';
import type { TTSModel, TTSVoice } from './types';

function getTTSModelConstant(model: TTSModel) {
  const et = getExecutorch();
  return model === 'kokoro-small' ? et.KOKORO_SMALL : et.KOKORO_MEDIUM;
}

function getTTSVoiceConstant(voice: TTSVoice) {
  const et = getExecutorch();
  const map: Record<TTSVoice, any> = {
    'af_heart': et.KOKORO_VOICE_AF_HEART,
    'af_sky': et.KOKORO_VOICE_AF_SKY,
    'am_adam': et.KOKORO_VOICE_AM_ADAM,
    'bf_emma': et.KOKORO_VOICE_BF_EMMA,
    'bm_george': et.KOKORO_VOICE_BM_GEORGE,
  };
  return map[voice];
}

interface TTSBridgeConfig {
  model: TTSModel;
  voice: TTSVoice;
  speed?: number;
}

interface TTSBridgeReturn {
  isReady: boolean;
  downloadProgress: number;
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  error: Error | null;
}

export function useTextToSpeechBridge(config: TTSBridgeConfig): TTSBridgeReturn {
  const et = getExecutorch();
  const audioApi = getAudioApi();

  const ttsModel = et.useTextToSpeech({
    model: getTTSModelConstant(config.model),
    voice: getTTSVoiceConstant(config.voice),
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const audioContextRef = useRef<any>(null);
  const isStoppedRef = useRef(false);

  const speak = useCallback(async (text: string) => {
    if (!ttsModel.isReady) return;

    setIsSpeaking(true);
    setError(null);
    isStoppedRef.current = false;

    try {
      // Create audio context for playback at 24kHz (Kokoro's sample rate)
      if (!audioContextRef.current) {
        audioContextRef.current = new audioApi.AudioContext({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;

      // Use streaming TTS for lower time-to-first-audio
      const stream = ttsModel.stream({
        text,
        speed: config.speed ?? 1.0,
      });

      let offset = ctx.currentTime + 0.1; // Small buffer

      for await (const chunk of stream) {
        if (isStoppedRef.current) break;

        const buffer = ctx.createBuffer(1, chunk.length, 24000);
        const channelData = buffer.getChannelData(0);
        channelData.set(chunk);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(offset);

        offset += buffer.duration;
      }

      // Wait for all audio to finish playing
      if (!isStoppedRef.current) {
        const remainingTime = (offset - ctx.currentTime) * 1000;
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsSpeaking(false);
    }
  }, [ttsModel.isReady, config.speed]);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    setIsSpeaking(false);
    // Close and recreate audio context to immediately stop playback
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return {
    isReady: ttsModel.isReady,
    downloadProgress: ttsModel.downloadProgress ?? 0,
    isSpeaking,
    speak,
    stop,
    error,
  };
}
```

### 4.4 Main Hook (`src/voice/useVoiceAssistant.ts`)

This is the **public API** — the single hook that orchestrates the entire pipeline.

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { getExecutorch, getResourceFetcher } from './dependencyCheck';
import { useSpeechToTextBridge } from './useSpeechToTextBridge';
import { useTextToSpeechBridge } from './useTextToSpeechBridge';
import { sendMessage, streamMessage } from '../index'; // existing expo-ai-kit
import type { LLMMessage } from '../ExpoAiKit.types';
import type {
  VoiceAssistantConfig,
  VoiceAssistantStage,
  UseVoiceAssistantReturn,
  VoiceAssistantError as VoiceError,
  VoiceAssistantEvents,
  ModelLoadingProgress,
} from './types';
import { VoiceAssistantError } from './types';

const DEFAULT_CONFIG: Required<Omit<VoiceAssistantConfig, 'onError'>> = {
  language: 'en',
  sttModel: 'whisper-tiny-en',
  ttsModel: 'kokoro-medium',
  ttsVoice: 'af_heart',
  systemPrompt: 'You are a helpful voice assistant. Keep responses concise and conversational, ideally under 3 sentences.',
  maxTurns: 10,
  autoPlayResponse: true,
  speechSpeed: 1.0,
  sttMode: 'streaming',
};

export function useVoiceAssistant(
  userConfig?: VoiceAssistantConfig,
  events?: VoiceAssistantEvents
): UseVoiceAssistantReturn {

  // --- Initialize ExecuTorch ---
  // This must be called before any ExecuTorch hooks
  useEffect(() => {
    try {
      const et = getExecutorch();
      const rf = getResourceFetcher();
      et.initExecutorch({ resourceFetcher: rf.ExpoResourceFetcher });
    } catch (err: any) {
      setError(new VoiceAssistantError(
        'EXECUTORCH_NOT_INSTALLED',
        err.message,
        'loading'
      ));
    }
  }, []);

  // --- Merge config ---
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // --- State ---
  const [stage, setStage] = useState<VoiceAssistantStage>('loading');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState<LLMMessage[]>([]);
  const [error, setError] = useState<VoiceError | null>(null);

  // Ref to track if we should cancel
  const cancelledRef = useRef(false);

  // --- Initialize bridges ---
  const stt = useSpeechToTextBridge({
    model: config.sttModel,
    language: config.language,
    mode: config.sttMode,
  });

  const tts = useTextToSpeechBridge({
    model: config.ttsModel,
    voice: config.ttsVoice,
    speed: config.speechSpeed,
  });

  // --- Track loading progress ---
  const loadingProgress: ModelLoadingProgress = {
    stt: stt.downloadProgress,
    tts: tts.downloadProgress,
    overall: (stt.downloadProgress + tts.downloadProgress) / 2,
  };

  const isReady = stt.isReady && tts.isReady;

  // Update stage when models become ready
  useEffect(() => {
    if (isReady && stage === 'loading') {
      setStage('ready');
    }
  }, [isReady]);

  // --- Build messages array with history ---
  const buildMessages = useCallback((newUserText: string): LLMMessage[] => {
    // Trim history to maxTurns
    const trimmedHistory = conversationHistory.slice(-(config.maxTurns * 2));

    return [
      ...trimmedHistory,
      { role: 'user' as const, content: newUserText },
    ];
  }, [conversationHistory, config.maxTurns]);

  // --- Core pipeline: text → LLM → TTS ---
  const processText = useCallback(async (inputText: string) => {
    if (!inputText.trim()) return;
    cancelledRef.current = false;

    // Update user transcript
    setUserTranscript(inputText);

    // Phase 2: LLM Processing
    setStage('processing');
    setAssistantResponse('');
    events?.onResponseStart?.();

    const messages = buildMessages(inputText);

    try {
      let fullResponse = '';

      // Use streaming for progressive display
      const { promise, stop } = streamMessage(
        messages,
        (event) => {
          if (cancelledRef.current) {
            stop();
            return;
          }
          fullResponse = event.accumulatedText;
          setAssistantResponse(event.accumulatedText);
          events?.onResponseToken?.(event);
        },
        { systemPrompt: config.systemPrompt }
      );

      const response = await promise;
      fullResponse = response.text || fullResponse;

      if (cancelledRef.current) return;

      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: inputText },
        { role: 'assistant', content: fullResponse },
      ]);

      events?.onResponseEnd?.(fullResponse);

      // Phase 3: TTS Playback
      if (config.autoPlayResponse && fullResponse && !cancelledRef.current) {
        setStage('speaking');
        events?.onSpeakingStart?.();

        await tts.speak(fullResponse);

        events?.onSpeakingEnd?.();
      }

      if (!cancelledRef.current) {
        setStage('ready');
      }
    } catch (err: any) {
      const voiceError = new VoiceAssistantError(
        'LLM_FAILED',
        err.message || 'LLM generation failed',
        'processing'
      );
      setError(voiceError);
      setStage('error');
      config.onError?.(voiceError);
      events?.onError?.(voiceError);
    }
  }, [buildMessages, config, tts, events]);

  // --- Actions ---

  const startListening = useCallback(async () => {
    if (!isReady) return;
    cancelledRef.current = false;

    setStage('listening');
    setUserTranscript('');
    setAssistantResponse('');
    events?.onListeningStart?.();

    try {
      await stt.startListening();
    } catch (err: any) {
      const voiceError = new VoiceAssistantError(
        'STT_FAILED',
        err.message || 'Speech recognition failed',
        'listening'
      );
      setError(voiceError);
      setStage('error');
      config.onError?.(voiceError);
    }
  }, [isReady, stt, events, config]);

  const stopListening = useCallback(async () => {
    stt.stopListening();
    events?.onListeningEnd?.(stt.committedTranscription);

    // Get the final transcription and feed it to the LLM
    const finalText = stt.committedTranscription.trim();

    if (finalText) {
      await processText(finalText);
    } else {
      setStage('ready');
    }
  }, [stt, processText, events]);

  const sendText = useCallback(async (text: string) => {
    if (!isReady) return;
    await processText(text);
  }, [isReady, processText]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stt.stopListening();
    tts.stop();
    setStage('ready');
  }, [stt, tts]);

  const stopSpeaking = useCallback(() => {
    tts.stop();
    setStage('ready');
  }, [tts]);

  const replayLastResponse = useCallback(async () => {
    if (!assistantResponse || !tts.isReady) return;
    setStage('speaking');
    events?.onSpeakingStart?.();
    await tts.speak(assistantResponse);
    events?.onSpeakingEnd?.();
    setStage('ready');
  }, [assistantResponse, tts, events]);

  const clearHistory = useCallback(() => {
    setConversationHistory([]);
    setUserTranscript('');
    setAssistantResponse('');
  }, []);

  const reset = useCallback(() => {
    cancel();
    clearHistory();
    setError(null);
    setStage(isReady ? 'ready' : 'loading');
  }, [cancel, clearHistory, isReady]);

  // --- Return ---
  return {
    // State
    stage,
    isReady,
    loadingProgress,
    isListening: stt.isListening,
    isProcessing: stage === 'processing',
    isSpeaking: tts.isSpeaking,
    liveTranscription: `${stt.committedTranscription} ${stt.nonCommittedTranscription}`.trim(),
    userTranscript,
    assistantResponse,
    conversationHistory,
    error,

    // Actions
    startListening,
    stopListening,
    cancel,
    stopSpeaking,
    sendText,
    replayLastResponse,
    clearHistory,
    reset,
  };
}
```

### 4.5 Barrel Exports (`src/voice/index.ts`)

```typescript
export { useVoiceAssistant } from './useVoiceAssistant';
export { isVoiceAvailable } from './dependencyCheck';
export {
  VoiceAssistantError,
  type VoiceAssistantConfig,
  type VoiceAssistantStage,
  type UseVoiceAssistantReturn,
  type VoiceAssistantEvents,
  type ModelLoadingProgress,
  type WhisperModel,
  type TTSModel,
  type TTSVoice,
  type VoiceAssistantLanguage,
} from './types';
```

### 4.6 Update Main Index (`src/index.ts`)

Add to the existing exports:

```typescript
// Existing exports (DO NOT REMOVE)
export { isAvailable, sendMessage, streamMessage } from './ExpoAiKitModule';
export { ChatMemoryManager } from './ChatMemoryManager';
export type { LLMMessage, LLMResponse, LLMStreamEvent } from './ExpoAiKit.types';

// NEW: Voice Assistant (requires optional peer deps)
export {
  useVoiceAssistant,
  isVoiceAvailable,
  VoiceAssistantError,
  type VoiceAssistantConfig,
  type VoiceAssistantStage,
  type UseVoiceAssistantReturn,
  type VoiceAssistantEvents,
  type ModelLoadingProgress,
  type WhisperModel,
  type TTSModel,
  type TTSVoice,
  type VoiceAssistantLanguage,
} from './voice';
```

---

## Phase 5: Documentation

### 5.1 Update README.md

Add a new section after the existing API docs:

```markdown
## Voice Assistant (NEW)

Build a complete voice-in/voice-out AI assistant running 100% on-device.
Requires additional dependencies:

### Installation

\`\`\`bash
# Core (you already have this)
npx expo install expo-ai-kit

# Voice features
npx expo install react-native-executorch @react-native-executorch/expo-resource-fetcher expo-file-system expo-asset react-native-audio-api
\`\`\`

### Quick Start

\`\`\`typescript
import { useVoiceAssistant, isVoiceAvailable } from 'expo-ai-kit';

function VoiceChat() {
  const voice = useVoiceAssistant({
    language: 'en',
    systemPrompt: 'You are a friendly assistant. Keep answers brief.',
  });

  if (!voice.isReady) {
    return <Text>Loading models... {Math.round(voice.loadingProgress.overall * 100)}%</Text>;
  }

  return (
    <View>
      {/* Live transcription */}
      <Text style={{ color: 'gray' }}>{voice.liveTranscription}</Text>

      {/* Assistant response */}
      <Text>{voice.assistantResponse}</Text>

      {/* Controls */}
      {voice.isListening ? (
        <Button title="Stop & Process" onPress={voice.stopListening} />
      ) : (
        <Button title="Start Talking" onPress={voice.startListening} />
      )}

      {voice.isSpeaking && (
        <Button title="Stop Speaking" onPress={voice.stopSpeaking} />
      )}
    </View>
  );
}
\`\`\`

### Check Availability

\`\`\`typescript
import { isVoiceAvailable } from 'expo-ai-kit';

// Returns true if react-native-executorch and react-native-audio-api are installed
const canUseVoice = isVoiceAvailable();
\`\`\`

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `language` | `string` | `'en'` | STT language |
| `sttModel` | `WhisperModel` | `'whisper-tiny-en'` | Whisper model size |
| `ttsModel` | `TTSModel` | `'kokoro-medium'` | TTS model size |
| `ttsVoice` | `TTSVoice` | `'af_heart'` | Voice for TTS |
| `systemPrompt` | `string` | `'You are a helpful voice assistant...'` | LLM system prompt |
| `maxTurns` | `number` | `10` | Conversation history limit |
| `autoPlayResponse` | `boolean` | `true` | Auto-speak responses |
| `speechSpeed` | `number` | `1.0` | TTS speed (0.5-2.0) |

### Pipeline Stages

`idle` → `loading` → `ready` → `listening` → `processing` → `speaking` → `ready`

Use `voice.stage` to show appropriate UI states.
```

### 5.2 Add Audio Permission Config Docs

```markdown
### Permissions

Add microphone permissions via `react-native-audio-api` plugin in `app.json`:

\`\`\`json
{
  "plugins": [
    [
      "react-native-audio-api",
      {
        "iosBackgroundMode": true,
        "iosMicrophonePermission": "This app uses the microphone for voice commands.",
        "androidPermissions": [
          "android.permission.MODIFY_AUDIO_SETTINGS",
          "android.permission.RECORD_AUDIO"
        ]
      }
    ]
  ]
}
\`\`\`
```

---

## Phase 6: Example App

Create `examples/voice-assistant/App.tsx` as a reference implementation:

```typescript
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useVoiceAssistant, isVoiceAvailable } from 'expo-ai-kit';

export default function VoiceAssistantDemo() {
  if (!isVoiceAvailable()) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>
          Voice features require additional packages.{'\n\n'}
          Run:{'\n'}
          npx expo install react-native-executorch react-native-audio-api
          @react-native-executorch/expo-resource-fetcher expo-file-system expo-asset
        </Text>
      </SafeAreaView>
    );
  }

  return <VoiceChat />;
}

function VoiceChat() {
  const voice = useVoiceAssistant({
    language: 'en',
    sttModel: 'whisper-tiny-en',
    ttsModel: 'kokoro-medium',
    ttsVoice: 'af_heart',
    systemPrompt: 'You are a friendly and helpful voice assistant. Keep your answers concise — ideally 1-2 sentences.',
  }, {
    onListeningStart: () => console.log('Listening started'),
    onListeningEnd: (t) => console.log('Heard:', t),
    onResponseEnd: (r) => console.log('Response:', r),
    onError: (e) => console.error('Voice error:', e.code, e.message),
  });

  // --- Loading Screen ---
  if (!voice.isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          Downloading AI models...
        </Text>
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>
            Speech Recognition: {Math.round(voice.loadingProgress.stt * 100)}%
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${voice.loadingProgress.stt * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            Text to Speech: {Math.round(voice.loadingProgress.tts * 100)}%
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${voice.loadingProgress.tts * 100}%` }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- Main UI ---
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Voice Assistant</Text>

      {/* Conversation History */}
      <FlatList
        data={voice.conversationHistory}
        style={styles.chatList}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.role === 'user' ? styles.userBubble : styles.assistantBubble,
          ]}>
            <Text style={[
              styles.bubbleText,
              item.role === 'user' && styles.userBubbleText,
            ]}>
              {item.content}
            </Text>
          </View>
        )}
      />

      {/* Live Transcription */}
      {voice.isListening && (
        <View style={styles.transcriptionBox}>
          <Text style={styles.transcriptionText}>
            {voice.liveTranscription || 'Listening...'}
          </Text>
        </View>
      )}

      {/* Current Response (streaming) */}
      {voice.isProcessing && (
        <View style={styles.responseBox}>
          <Text style={styles.responseText}>
            {voice.assistantResponse || 'Thinking...'}
          </Text>
        </View>
      )}

      {/* Status Indicator */}
      <Text style={styles.stageText}>
        {voice.stage === 'listening' && '🎙️ Listening...'}
        {voice.stage === 'processing' && '🧠 Processing...'}
        {voice.stage === 'speaking' && '🔊 Speaking...'}
        {voice.stage === 'ready' && '✅ Ready'}
        {voice.stage === 'error' && `❌ Error: ${voice.error?.message}`}
      </Text>

      {/* Controls */}
      <View style={styles.controls}>
        {voice.isListening ? (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={voice.stopListening}
          >
            <Text style={styles.buttonText}>⏹ Stop & Process</Text>
          </TouchableOpacity>
        ) : voice.isSpeaking ? (
          <TouchableOpacity
            style={[styles.button, styles.muteButton]}
            onPress={voice.stopSpeaking}
          >
            <Text style={styles.buttonText}>🔇 Stop Speaking</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.listenButton]}
            onPress={voice.startListening}
            disabled={voice.isProcessing}
          >
            <Text style={styles.buttonText}>🎙️ Start Talking</Text>
          </TouchableOpacity>
        )}

        {voice.conversationHistory.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={voice.clearHistory}
          >
            <Text style={styles.buttonText}>🗑 Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F8F9FA' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  chatList: { flex: 1 },
  bubble: { padding: 12, marginVertical: 4, borderRadius: 16, maxWidth: '80%' },
  userBubble: { backgroundColor: '#007AFF', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#E5E5EA', alignSelf: 'flex-start' },
  bubbleText: { fontSize: 16, color: '#000' },
  userBubbleText: { color: '#FFF' },
  transcriptionBox: { padding: 12, backgroundColor: '#FFF3CD', borderRadius: 8, marginVertical: 8 },
  transcriptionText: { fontSize: 14, color: '#856404', fontStyle: 'italic' },
  responseBox: { padding: 12, backgroundColor: '#D4EDDA', borderRadius: 8, marginVertical: 8 },
  responseText: { fontSize: 14, color: '#155724' },
  stageText: { textAlign: 'center', fontSize: 14, marginVertical: 8, color: '#666' },
  controls: { flexDirection: 'row', gap: 12, justifyContent: 'center', paddingVertical: 16 },
  button: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  listenButton: { backgroundColor: '#007AFF' },
  stopButton: { backgroundColor: '#FF3B30' },
  muteButton: { backgroundColor: '#FF9500' },
  clearButton: { backgroundColor: '#8E8E93' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  loadingText: { fontSize: 16, textAlign: 'center', marginTop: 16, color: '#666' },
  progressContainer: { marginTop: 24, paddingHorizontal: 32 },
  progressLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
  progressBar: { height: 8, backgroundColor: '#E5E5EA', borderRadius: 4, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#007AFF', borderRadius: 4 },
  errorText: { fontSize: 14, textAlign: 'center', color: '#FF3B30', padding: 32 },
});
```

---

## Phase 7: Testing Checklist

After implementation, verify each of these scenarios:

### Must Pass
- [ ] `npm install expo-ai-kit` alone works — no errors from missing optional deps
- [ ] `isAvailable()` and `sendMessage()` work without ExecuTorch installed
- [ ] `isVoiceAvailable()` returns `false` when ExecuTorch is not installed
- [ ] `useVoiceAssistant()` throws a clear error when ExecuTorch is missing
- [ ] Models download with progress reporting (stt + tts)
- [ ] `isReady` becomes `true` after both models load
- [ ] Microphone permission is requested
- [ ] STT captures speech and shows live transcription
- [ ] `stopListening()` triggers LLM processing
- [ ] LLM response streams token by token
- [ ] TTS plays the response audio after LLM finishes
- [ ] `cancel()` stops any active stage
- [ ] `stopSpeaking()` stops TTS without affecting conversation
- [ ] `clearHistory()` resets conversation
- [ ] `sendText()` works as text-only input (bypassing STT)
- [ ] Multi-turn conversation maintains context
- [ ] TypeScript types export correctly

### Edge Cases
- [ ] User stops listening before saying anything → goes back to `ready`
- [ ] LLM returns empty response → TTS is not called
- [ ] User cancels during LLM processing → pipeline stops cleanly
- [ ] Error in STT → proper error state, recovery possible
- [ ] Error in TTS → response text is still visible
- [ ] Low memory device → appropriate error code

---

## Phase 8: Release Plan

### Version Bump
This is a minor feature addition. Bump to `0.2.0`.

### npm Publish Checklist
1. Update `package.json` version to `0.2.0`
2. Update `CHANGELOG.md`
3. Build TypeScript: `npx tsc`
4. Test on iOS device with all deps installed
5. Test on Android device with all deps installed
6. Test without optional deps (should not break)
7. `npm publish`

### Announcement
- Tweet/X post with demo video
- Medium blog post: "Building a Full Voice Assistant in React Native with Zero Cloud Costs"
- Reddit r/reactnative post
- Expo Discord share

---

## Summary of Dependencies

| Package | Required? | Purpose |
|---------|-----------|---------|
| `expo-ai-kit` | Yes | Core text LLM |
| `react-native-executorch` | Optional (voice) | STT + TTS models |
| `@react-native-executorch/expo-resource-fetcher` | Optional (voice) | Model downloading for Expo |
| `react-native-audio-api` | Optional (voice) | Microphone capture + audio playback |
| `expo-file-system` | Optional (voice) | File system for model caching |
| `expo-asset` | Optional (voice) | Asset management |

## Key Design Principles

1. **Zero breaking changes** — existing API stays identical
2. **Optional everything** — voice deps only needed if you use voice features
3. **Single hook** — `useVoiceAssistant()` does everything
4. **Progressive disclosure** — simple config for common cases, full control when needed
5. **Clear errors** — specific error codes tell developers exactly what's wrong
6. **Pipeline transparency** — `stage` state lets UI respond to each pipeline phase
