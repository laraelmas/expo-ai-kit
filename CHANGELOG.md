# Changelog

## 0.2.0

### Added

- **Voice Assistant Pipeline** — `useVoiceAssistant` hook that chains STT (Whisper) → LLM (on-device) → TTS (Kokoro) into a single, fully on-device voice assistant
- `isVoiceAvailable()` helper to check whether voice dependencies are installed at runtime
- Real-time speech transcription with live UI updates, streaming LLM responses, and streaming TTS audio playback
- Typed error handling via `VoiceAssistantError` with specific error codes for each pipeline stage

#### Optional peer dependencies for voice features

Voice features require the following additional packages (existing text-only features are unaffected):

- `react-native-executorch` — Whisper STT, Kokoro TTS models, and resource fetching
- `react-native-audio-api` — Microphone capture and audio playback
- `expo-file-system` — File system for model caching
- `expo-asset` — Asset management

## 0.1.19

- Android support for chat memory

## 0.1.18

- Added `ChatMemoryManager` for managing conversation history

## 0.1.17

- Bug fixes and improvements
