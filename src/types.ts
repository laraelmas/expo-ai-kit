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

// ============================================================================
// Prompt Helper Types
// ============================================================================

/**
 * Options for the summarize helper.
 */
export type LLMSummarizeOptions = {
  /**
   * Target length for the summary.
   * @default 'medium'
   */
  length?: 'short' | 'medium' | 'long';
  /**
   * Style of summary to generate.
   * @default 'paragraph'
   */
  style?: 'paragraph' | 'bullets' | 'tldr';
};

/**
 * Options for the translate helper.
 */
export type LLMTranslateOptions = {
  /**
   * Target language to translate to.
   */
  to: string;
  /**
   * Source language (auto-detected if not provided).
   */
  from?: string;
  /**
   * Tone/formality of the translation.
   * @default 'neutral'
   */
  tone?: 'formal' | 'informal' | 'neutral';
};

/**
 * Options for the rewrite helper.
 */
export type LLMRewriteOptions = {
  /**
   * Style to rewrite in.
   */
  style:
    | 'formal'
    | 'casual'
    | 'professional'
    | 'friendly'
    | 'concise'
    | 'detailed'
    | 'simple'
    | 'academic';
};

/**
 * Options for the extractKeyPoints helper.
 */
export type LLMExtractKeyPointsOptions = {
  /**
   * Maximum number of key points to extract.
   * @default 5
   */
  maxPoints?: number;
};

/**
 * Options for the answerQuestion helper.
 */
export type LLMAnswerQuestionOptions = {
  /**
   * How detailed the answer should be.
   * @default 'medium'
   */
  detail?: 'brief' | 'medium' | 'detailed';
};

// ============================================================================
// Smart Suggestions Types
// ============================================================================

/**
 * Options for the suggest helper.
 */
export type LLMSuggestOptions = {
  /**
   * Number of suggestions to generate.
   * @default 3
   */
  count?: number;
  /**
   * Optional context to inform the suggestions (e.g., surrounding text, app context).
   */
  context?: string;
  /**
   * Tone of the suggestions.
   * @default 'neutral'
   */
  tone?: 'formal' | 'casual' | 'professional' | 'friendly' | 'neutral';
};

/**
 * A single suggestion item.
 */
export type LLMSuggestion = {
  /** The suggested text */
  text: string;
};

/**
 * Response from suggest/smartReply containing multiple suggestions.
 */
export type LLMSuggestResponse = {
  /** Array of generated suggestions */
  suggestions: LLMSuggestion[];
  /** Raw response text from the model */
  raw: string;
};

/**
 * Options for the smartReply helper.
 */
export type LLMSmartReplyOptions = {
  /**
   * Number of reply suggestions to generate.
   * @default 3
   */
  count?: number;
  /**
   * Tone of the reply suggestions.
   * @default 'neutral'
   */
  tone?: 'formal' | 'casual' | 'professional' | 'friendly' | 'neutral';
  /**
   * Optional persona/context for the replier (e.g., "customer support agent", "friendly colleague").
   */
  persona?: string;
};

/**
 * Options for the autocomplete helper.
 */
export type LLMAutocompleteOptions = {
  /**
   * Number of completions to generate.
   * @default 3
   */
  count?: number;
  /**
   * Maximum length of each completion in words.
   * @default 10
   */
  maxWords?: number;
  /**
   * Optional context to inform the completions (e.g., what the user is writing about).
   */
  context?: string;
};

// ============================================================================
// Chat Memory Types
// ============================================================================

/**
 * Options for creating a ChatMemoryManager.
 */
export type ChatMemoryOptions = {
  /**
   * Maximum number of conversation turns to keep in memory.
   * A turn is one user message + one assistant response.
   * @default 10
   */
  maxTurns?: number;
  /**
   * Optional system prompt to prepend to every generated prompt.
   */
  systemPrompt?: string;
};

/**
 * A snapshot of the current chat memory state.
 */
export type ChatMemorySnapshot = {
  /** All messages currently in memory */
  messages: LLMMessage[];
  /** The system prompt (if any) */
  systemPrompt: string | undefined;
  /** Current number of turns stored */
  turnCount: number;
  /** Maximum turns allowed */
  maxTurns: number;
};
