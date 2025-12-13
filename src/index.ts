import NativeModule from './ExpoAiKitModule';
import { Platform } from 'react-native';
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

export async function isAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return NativeModule.isAvailable();
  }
  return false;
}

export async function sendPrompt(prompt: string): Promise<string> {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return NativeModule.sendPrompt(prompt);
  }
  return '';
}