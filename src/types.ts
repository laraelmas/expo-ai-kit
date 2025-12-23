/**
 * Role in a conversation message.
 */
export type LLMRole = 'system' | 'user' | 'assistant';

/**
 * A single message in a conversation.
 */
export type LLMMessage = {
  role: LLMRole;
  content: string;
};

/**
 * Options for sendMessage.
 */
export type LLMSendOptions = {
  /**
   * Default system prompt to use if no system message is provided in the messages array.
   * If a system message exists in the array, this is ignored.
   */
  systemPrompt?: string;
};

/**
 * Response from sendMessage.
 */
export type LLMResponse = {
  /** The generated response text */
  text: string;
};

/**
 * Options for streamMessage.
 */
export type LLMStreamOptions = {
  /**
   * Default system prompt to use if no system message is provided in the messages array.
   * If a system message exists in the array, this is ignored.
   */
  systemPrompt?: string;
};

/**
 * Event payload for streaming tokens.
 */
export type LLMStreamEvent = {
  /** Unique identifier for this streaming session */
  sessionId: string;
  /** The token/chunk of text received */
  token: string;
  /** Accumulated text so far */
  accumulatedText: string;
  /** Whether this is the final chunk */
  isDone: boolean;
};

/**
 * Callback function for streaming events.
 */
export type LLMStreamCallback = (event: LLMStreamEvent) => void;
