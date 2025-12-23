import { requireNativeModule } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';
import { LLMMessage, LLMResponse, LLMStreamEvent } from './types';

export type ExpoAiKitModuleEvents = {
  onStreamToken: (event: LLMStreamEvent) => void;
};

export interface ExpoAiKitNativeModule {
  isAvailable(): boolean;
  sendMessage(
    messages: LLMMessage[],
    systemPrompt: string
  ): Promise<LLMResponse>;
  startStreaming(
    messages: LLMMessage[],
    systemPrompt: string,
    sessionId: string
  ): Promise<void>;
  stopStreaming(sessionId: string): Promise<void>;
  addListener<K extends keyof ExpoAiKitModuleEvents>(
    eventName: K,
    listener: ExpoAiKitModuleEvents[K]
  ): EventSubscription;
}

const ExpoAiKitModule =
  requireNativeModule<ExpoAiKitNativeModule>('ExpoAiKit');

export default ExpoAiKitModule;
