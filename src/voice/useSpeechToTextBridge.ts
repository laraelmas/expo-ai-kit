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

  // Keep a ref to sttModel so callbacks always have the latest
  const sttModelRef = useRef(sttModel);
  useEffect(() => {
    sttModelRef.current = sttModel;
  }, [sttModel]);

  // Setup audio session once on mount
  useEffect(() => {
    (async () => {
      try {
        await audioApi.AudioManager.requestRecordingPermissions();
        audioApi.AudioManager.setAudioSessionOptions({
          iosCategory: 'playAndRecord',
          iosMode: 'spokenAudio',
          iosOptions: ['allowBluetooth', 'defaultToSpeaker'],
        });
        await audioApi.AudioManager.setAudioSessionActivity(true);
        console.log('[STT] Audio session ready');
      } catch (err: any) {
        console.log('[STT] Session setup error:', err.message);
      }
    })();
  }, []);

  const startListening = useCallback(async () => {
    if (!sttModel.isReady) return;

    setIsListening(true);
    setError(null);

    if (config.mode === 'streaming') {
      try {
        const recorder = new audioApi.AudioRecorder();
        recorderRef.current = recorder;

        recorder.onError((err: any) => {
          console.log('[STT] Recorder error:', err.message || JSON.stringify(err));
        });

        recorder.onAudioReady(
          { sampleRate: 16000, bufferLength: 1600, channelCount: 1 },
          ({ buffer }: any) => {
            const model = sttModelRef.current;
            if (model.isReady) {
              const channelData = buffer.getChannelData(0);
              model.streamInsert(Array.from(channelData));
            }
          }
        );

        // enableFileOutput is required for start() to work on iOS
        recorder.enableFileOutput({ channelCount: 1 });

        const startResult = recorder.start();
        console.log('[STT] start() result:', JSON.stringify(startResult));

        if (startResult.status === 'error') {
          setError(new Error(startResult.message));
          setIsListening(false);
          return;
        }

        console.log('[STT] Recording, calling stream()...');
        const decodingOptions = config.language !== 'en'
          ? { language: config.language }
          : undefined;
        await sttModel.stream(decodingOptions);
      } catch (err: any) {
        console.log('[STT] Error:', err.message);
        setError(err);
        setIsListening(false);
      }
    }
  }, [sttModel.isReady, config.mode, config.language]);

  const stopListening = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch (_) {}
    try {
      sttModel.streamStop();
    } catch (_) {}
    recorderRef.current = null;
    setIsListening(false);
  }, [sttModel]);

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
