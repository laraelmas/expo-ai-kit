import NativeModule from './ExpoAiKitModule';
export * from './types';
import type { LLMMessage, LLMOptions } from './types';

export async function prepareModel(options?: { model?: string }) {
  return NativeModule.prepareModel(options);
}

export async function createSession(options?: { systemPrompt?: string }) {
  return NativeModule.createSession(options);
}

export async function sendMessage(
  sessionId: string,
  messages: LLMMessage[],
  options?: LLMOptions
) {
  return NativeModule.sendMessage(sessionId, messages, options);
}