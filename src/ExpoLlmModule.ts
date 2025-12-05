import { requireNativeModule } from 'expo-modules-core';
import type { LLMMessage, LLMOptions } from './types';

export type ExpoLlmNativeModule = {
  prepareModel(options?: { model?: string }): Promise<void>;
  createSession(options?: { systemPrompt?: string }): Promise<string>;
  sendMessage(
    sessionId: string,
    messages: LLMMessage[],
    options?: LLMOptions
  ): Promise<{ reply: string }>;
};

const NativeModule: ExpoLlmNativeModule =
  requireNativeModule<ExpoLlmNativeModule>('ExpoLlm'); 

export default NativeModule;