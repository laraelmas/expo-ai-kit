import { useState, useCallback, useRef, useEffect } from 'react';
import { getExecutorch } from './dependencyCheck';
import { useSpeechToTextBridge } from './useSpeechToTextBridge';
import { useTextToSpeechBridge } from './useTextToSpeechBridge';
import { streamMessage } from '../index';
import type { LLMMessage } from '../types';
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

  // --- State ---
  const [stage, setStage] = useState<VoiceAssistantStage>('loading');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState<LLMMessage[]>([]);
  const [error, setError] = useState<VoiceError | null>(null);

  // Ref to track if we should cancel
  const cancelledRef = useRef(false);

  // --- Initialize ExecuTorch ---
  useEffect(() => {
    try {
      const et = getExecutorch();
      et.initExecutorch({ resourceFetcher: et.ResourceFetcher });
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

  // Keep a ref to the latest transcription to avoid stale closures
  const transcriptRef = useRef('');
  useEffect(() => {
    console.log('[VA] stt.committedTranscription changed:', stt.committedTranscription);
    console.log('[VA] stt.nonCommittedTranscription:', stt.nonCommittedTranscription);
    transcriptRef.current = stt.committedTranscription;
  }, [stt.committedTranscription]);

  const stopListening = useCallback(async () => {
    stt.stopListening();

    // Small delay to let the stream finish and final transcription settle
    await new Promise(resolve => setTimeout(resolve, 200));

    const finalText = transcriptRef.current.trim();
    events?.onListeningEnd?.(finalText);

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
