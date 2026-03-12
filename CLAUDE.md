# expo-ai-kit

## Project Overview
expo-ai-kit is an on-device AI library for Expo/React Native apps. It runs on Apple Foundation Models (iOS 26+) and Google ML Kit Prompt API (Android). No user data leaves the device.

## Architecture
- **iOS native**: `ios/` — Swift, built with Expo Modules API
- **Android native**: `android/` — Kotlin, built with Expo Modules API
- **TypeScript API**: `src/` — All public-facing API lives here
- **Package format**: Expo Module, published to npm

## Current Public API
- `isAvailable(): Promise<boolean>` — Check if on-device AI is supported
- `sendMessage(messages, options?): Promise<LLMResponse>` — Single response
- `streamMessage(messages, onToken, options?): { promise, stop }` — Streaming response
- `ChatMemoryManager` — Conversation history management
- Types: `LLMMessage`, `LLMResponse`, `LLMStreamEvent`, `LLMRole`

## Rules
- NEVER break the existing API. Backward compatibility is critical.
- iOS 26+ and Android API 26+ support is required.
- react-native-executorch must ALWAYS remain an OPTIONAL peer dependency.
- If imported without being installed, show a clear runtime error message.
- All new TypeScript types must be defined in `src/voice/types.ts`.
- Every public function/hook must have JSDoc documentation.
- Code comments and error messages must be in English.