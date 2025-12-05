export type LLMRole = 'system' | 'user' | 'assistant';

export type LLMMessage = {
  role: LLMRole;
  content: string;
};

export type LLMOptions = {
  temperature?: number;
  maxTokens?: number;
  model?: string;
};