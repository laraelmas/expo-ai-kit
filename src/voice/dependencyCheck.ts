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
  ResourceFetcher: any;
}

interface AudioApiModule {
  AudioContext: any;
  AudioManager: any;
  AudioRecorder: any;
}

let _executorch: ExecutorchModule | null = null;
let _audioApi: AudioApiModule | null = null;

export function getExecutorch(): ExecutorchModule {
  if (!_executorch) {
    try {
      _executorch = require('react-native-executorch');
    } catch {
      throw new Error(
        '[expo-ai-kit] Voice features require react-native-executorch.\n' +
        'Install it with: npx expo install react-native-executorch expo-file-system expo-asset'
      );
    }
  }
  return _executorch!;
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
  return _audioApi!;
}

export function isVoiceAvailable(): boolean {
  try {
    getExecutorch();
    getAudioApi();
    return true;
  } catch {
    return false;
  }
}
