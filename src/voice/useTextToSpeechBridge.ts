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
