import { requireNativeModule } from 'expo-modules-core';
import type { LLMMessage, LLMOptions } from './types';

export type ExpoAiKitNativeModule = {
  prepareModel(options?: { model?: string }): Promise<void>;
  createSession(options?: { systemPrompt?: string }): Promise<string>;
  sendMessage(
    sessionId: string,
    messages: LLMMessage[],
    options?: LLMOptions
  ): Promise<{ reply: string }>;
  isAvailable(): boolean;
  sendPrompt(prompt: string): Promise<string>;
};

const NativeModule: ExpoAiKitNativeModule =
  requireNativeModule<ExpoAiKitNativeModule>('ExpoAiKit'); 

export default NativeModule;