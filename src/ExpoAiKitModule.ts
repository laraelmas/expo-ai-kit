import { requireNativeModule } from 'expo-modules-core';
import { LLMMessage, LLMResponse } from './types';

export type ExpoAiKitNativeModule = {
  isAvailable(): boolean;
  sendMessage(
    messages: LLMMessage[],
    systemPrompt: string
  ): Promise<LLMResponse>;
};

const NativeModule: ExpoAiKitNativeModule =
  requireNativeModule<ExpoAiKitNativeModule>('ExpoAiKit');

export default NativeModule;
