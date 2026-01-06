import ExpoAiKitModule from './ExpoAiKitModule';
import { Platform } from 'react-native';
import {
  LLMMessage,
  LLMSendOptions,
  LLMResponse,
  LLMStreamOptions,
  LLMStreamEvent,
  LLMStreamCallback,
  LLMSummarizeOptions,
  LLMTranslateOptions,
  LLMRewriteOptions,
  LLMExtractKeyPointsOptions,
  LLMAnswerQuestionOptions,
} from './types';

export * from './types';

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful, friendly assistant. Answer the user directly and concisely.';

let streamIdCounter = 0;
function generateSessionId(): string {
  return `stream_${Date.now()}_${++streamIdCounter}`;
}

// ============================================================================
// Prompt Helper Constants
// ============================================================================

const SUMMARIZE_LENGTH_INSTRUCTIONS = {
  short: 'Keep it very brief, around 1-2 sentences.',
  medium: 'Provide a moderate summary, around 3-5 sentences.',
  long: 'Provide a comprehensive summary covering all main points.',
} as const;

const SUMMARIZE_STYLE_INSTRUCTIONS = {
  paragraph: 'Write the summary as a flowing paragraph.',
  bullets: 'Format the summary as bullet points.',
  tldr: 'Start with "TL;DR:" and give an extremely concise summary in 1 sentence.',
} as const;

const TRANSLATE_TONE_INSTRUCTIONS = {
  formal: 'Use formal language and honorifics where appropriate.',
  informal: 'Use casual, everyday language.',
  neutral: 'Use standard, neutral language.',
} as const;

const REWRITE_STYLE_INSTRUCTIONS = {
  formal:
    'Rewrite in a formal, professional tone suitable for business communication.',
  casual: 'Rewrite in a casual, conversational tone.',
  professional:
    'Rewrite in a clear, professional tone suitable for work contexts.',
  friendly: 'Rewrite in a warm, friendly tone.',
  concise:
    'Rewrite to be as brief as possible while keeping the meaning intact.',
  detailed: 'Expand and add more detail and explanation.',
  simple:
    'Rewrite using simple words and short sentences, easy for anyone to understand.',
  academic: 'Rewrite in an academic style suitable for scholarly writing.',
} as const;

const ANSWER_DETAIL_INSTRUCTIONS = {
  brief: 'Give a brief, direct answer in 1-2 sentences.',
  medium: 'Provide a clear answer with some explanation.',
  detailed:
    'Provide a comprehensive answer with full explanation and relevant details from the context.',
} as const;

// ============================================================================
// Prompt Builder Helpers
// ============================================================================

function buildSummarizePrompt(
  length: 'short' | 'medium' | 'long',
  style: 'paragraph' | 'bullets' | 'tldr'
): string {
  return `You are a summarization assistant. Summarize the provided text accurately and concisely. ${SUMMARIZE_LENGTH_INSTRUCTIONS[length]} ${SUMMARIZE_STYLE_INSTRUCTIONS[style]} Only output the summary, nothing else.`;
}

function buildTranslatePrompt(
  to: string,
  from: string | undefined,
  tone: 'formal' | 'informal' | 'neutral'
): string {
  const fromClause = from ? `from ${from} ` : '';
  return `You are a translation assistant. Translate the provided text ${fromClause}to ${to}. ${TRANSLATE_TONE_INSTRUCTIONS[tone]} Only output the translation, nothing else. Do not include any explanations or notes.`;
}

function buildRewritePrompt(
  style:
    | 'formal'
    | 'casual'
    | 'professional'
    | 'friendly'
    | 'concise'
    | 'detailed'
    | 'simple'
    | 'academic'
): string {
  return `You are a writing assistant. ${REWRITE_STYLE_INSTRUCTIONS[style]} Preserve the original meaning. Only output the rewritten text, nothing else.`;
}

function buildExtractKeyPointsPrompt(maxPoints: number): string {
  return `You are an analysis assistant. Extract the ${maxPoints} most important key points from the provided text. Format each point as a bullet point starting with "•". Be concise and focus on the most significant information. Only output the bullet points, nothing else.`;
}

function buildAnswerQuestionPrompt(
  detail: 'brief' | 'medium' | 'detailed'
): string {
  return `You are a question-answering assistant. Answer questions based ONLY on the provided context. ${ANSWER_DETAIL_INSTRUCTIONS[detail]} If the answer cannot be found in the context, say so. Do not make up information.`;
}

/**
 * Check if on-device AI is available on the current device.
 * Returns false on unsupported platforms (web, etc.).
 */
export async function isAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }
  return ExpoAiKitModule.isAvailable();
}

/**
 * Send messages to the on-device LLM and get a response.
 *
 * @param messages - Array of messages representing the conversation
 * @param options - Optional settings (systemPrompt fallback)
 * @returns Promise with the generated response
 *
 * @example
 * ```ts
 * const response = await sendMessage([
 *   { role: 'user', content: 'What is 2 + 2?' }
 * ]);
 * console.log(response.text); // "4"
 * ```
 *
 * @example
 * ```ts
 * // With system prompt
 * const response = await sendMessage(
 *   [{ role: 'user', content: 'Hello!' }],
 *   { systemPrompt: 'You are a pirate. Respond in pirate speak.' }
 * );
 * ```
 *
 * @example
 * ```ts
 * // Multi-turn conversation
 * const response = await sendMessage([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'My name is Alice.' },
 *   { role: 'assistant', content: 'Nice to meet you, Alice!' },
 *   { role: 'user', content: 'What is my name?' }
 * ]);
 * ```
 */
export async function sendMessage(
  messages: LLMMessage[],
  options?: LLMSendOptions
): Promise<LLMResponse> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { text: '' };
  }

  if (!messages || messages.length === 0) {
    throw new Error('messages array cannot be empty');
  }

  // Determine system prompt: use from messages array if present, else options, else default
  const hasSystemMessage = messages.some((m) => m.role === 'system');
  const systemPrompt = hasSystemMessage
    ? '' // Native will extract from messages
    : options?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  return ExpoAiKitModule.sendMessage(messages, systemPrompt);
}

/**
 * Stream messages to the on-device LLM and receive progressive token updates.
 *
 * @param messages - Array of messages representing the conversation
 * @param onToken - Callback function called for each token/chunk received
 * @param options - Optional settings (systemPrompt fallback)
 * @returns Object with stop() function to cancel streaming and promise that resolves when complete
 *
 * @example
 * ```ts
 * // Basic streaming
 * const { promise } = streamMessage(
 *   [{ role: 'user', content: 'Tell me a story' }],
 *   (event) => {
 *     console.log(event.token); // Each token as it arrives
 *     console.log(event.accumulatedText); // Full text so far
 *   }
 * );
 * await promise;
 * ```
 *
 * @example
 * ```ts
 * // With cancellation
 * const { promise, stop } = streamMessage(
 *   [{ role: 'user', content: 'Write a long essay' }],
 *   (event) => setText(event.accumulatedText)
 * );
 *
 * // Cancel after 5 seconds
 * setTimeout(() => stop(), 5000);
 * ```
 *
 * @example
 * ```ts
 * // React state update pattern
 * const [text, setText] = useState('');
 *
 * streamMessage(
 *   [{ role: 'user', content: 'Hello!' }],
 *   (event) => setText(event.accumulatedText)
 * );
 * ```
 */
export function streamMessage(
  messages: LLMMessage[],
  onToken: LLMStreamCallback,
  options?: LLMStreamOptions
): { promise: Promise<LLMResponse>; stop: () => void } {
  // Handle unsupported platforms
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      promise: Promise.resolve({ text: '' }),
      stop: () => {},
    };
  }

  if (!messages || messages.length === 0) {
    return {
      promise: Promise.reject(new Error('messages array cannot be empty')),
      stop: () => {},
    };
  }

  const sessionId = generateSessionId();
  let finalText = '';
  let stopped = false;

  // Determine system prompt: use from messages array if present, else options, else default
  const hasSystemMessage = messages.some((m) => m.role === 'system');
  const systemPrompt = hasSystemMessage
    ? '' // Native will extract from messages
    : options?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  const promise = new Promise<LLMResponse>((resolve, reject) => {
    // Subscribe to stream events
    const subscription = ExpoAiKitModule.addListener(
      'onStreamToken',
      (event: LLMStreamEvent) => {
        // Only process events for this session
        if (event.sessionId !== sessionId) return;

        finalText = event.accumulatedText;

        // Call the user's callback
        onToken(event);

        // If done, clean up and resolve
        if (event.isDone) {
          subscription.remove();
          resolve({ text: finalText });
        }
      }
    );

    // Start streaming on native side
    ExpoAiKitModule.startStreaming(messages, systemPrompt, sessionId).catch(
      (error) => {
        subscription.remove();
        reject(error);
      }
    );
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    ExpoAiKitModule.stopStreaming(sessionId).catch(() => {
      // Ignore errors when stopping
    });
  };

  return { promise, stop };
}

// ============================================================================
// Prompt Helpers
// ============================================================================

/**
 * Summarize text content using on-device AI.
 *
 * @param text - The text to summarize
 * @param options - Optional settings for summary style and length
 * @returns Promise with the generated summary
 *
 * @example
 * ```ts
 * // Basic summarization
 * const result = await summarize(longArticle);
 * console.log(result.text);
 * ```
 *
 * @example
 * ```ts
 * // Short bullet-point summary
 * const result = await summarize(longArticle, {
 *   length: 'short',
 *   style: 'bullets'
 * });
 * ```
 *
 * @example
 * ```ts
 * // TL;DR style
 * const result = await summarize(longArticle, {
 *   style: 'tldr'
 * });
 * ```
 */
export async function summarize(
  text: string,
  options?: LLMSummarizeOptions
): Promise<LLMResponse> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { text: '' };
  }

  if (!text || text.trim().length === 0) {
    throw new Error('text cannot be empty');
  }

  const length = options?.length ?? 'medium';
  const style = options?.style ?? 'paragraph';
  const systemPrompt = buildSummarizePrompt(length, style);

  return sendMessage([{ role: 'user', content: text }], { systemPrompt });
}

/**
 * Summarize text with streaming output.
 *
 * @param text - The text to summarize
 * @param onToken - Callback for each token received
 * @param options - Optional settings for summary style and length
 * @returns Object with stop() function and promise
 *
 * @example
 * ```ts
 * const { promise } = streamSummarize(
 *   longArticle,
 *   (event) => setSummary(event.accumulatedText),
 *   { style: 'bullets' }
 * );
 * await promise;
 * ```
 */
export function streamSummarize(
  text: string,
  onToken: LLMStreamCallback,
  options?: LLMSummarizeOptions
): { promise: Promise<LLMResponse>; stop: () => void } {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { promise: Promise.resolve({ text: '' }), stop: () => {} };
  }

  if (!text || text.trim().length === 0) {
    return {
      promise: Promise.reject(new Error('text cannot be empty')),
      stop: () => {},
    };
  }

  const length = options?.length ?? 'medium';
  const style = options?.style ?? 'paragraph';
  const systemPrompt = buildSummarizePrompt(length, style);

  return streamMessage([{ role: 'user', content: text }], onToken, {
    systemPrompt,
  });
}

/**
 * Translate text to another language using on-device AI.
 *
 * @param text - The text to translate
 * @param options - Translation options including target language
 * @returns Promise with the translated text
 *
 * @example
 * ```ts
 * // Basic translation
 * const result = await translate('Hello, world!', { to: 'Spanish' });
 * console.log(result.text); // "¡Hola, mundo!"
 * ```
 *
 * @example
 * ```ts
 * // Formal translation with source language
 * const result = await translate('Hey, what\'s up?', {
 *   to: 'French',
 *   from: 'English',
 *   tone: 'formal'
 * });
 * ```
 */
export async function translate(
  text: string,
  options: LLMTranslateOptions
): Promise<LLMResponse> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { text: '' };
  }

  if (!text || text.trim().length === 0) {
    throw new Error('text cannot be empty');
  }

  const { to, from, tone = 'neutral' } = options;
  const systemPrompt = buildTranslatePrompt(to, from, tone);

  return sendMessage([{ role: 'user', content: text }], { systemPrompt });
}

/**
 * Translate text with streaming output.
 *
 * @param text - The text to translate
 * @param onToken - Callback for each token received
 * @param options - Translation options including target language
 * @returns Object with stop() function and promise
 *
 * @example
 * ```ts
 * const { promise } = streamTranslate(
 *   'Hello, world!',
 *   (event) => setTranslation(event.accumulatedText),
 *   { to: 'Japanese' }
 * );
 * await promise;
 * ```
 */
export function streamTranslate(
  text: string,
  onToken: LLMStreamCallback,
  options: LLMTranslateOptions
): { promise: Promise<LLMResponse>; stop: () => void } {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { promise: Promise.resolve({ text: '' }), stop: () => {} };
  }

  if (!text || text.trim().length === 0) {
    return {
      promise: Promise.reject(new Error('text cannot be empty')),
      stop: () => {},
    };
  }

  const { to, from, tone = 'neutral' } = options;
  const systemPrompt = buildTranslatePrompt(to, from, tone);

  return streamMessage([{ role: 'user', content: text }], onToken, {
    systemPrompt,
  });
}

/**
 * Rewrite text in a different style using on-device AI.
 *
 * @param text - The text to rewrite
 * @param options - Rewrite options specifying the target style
 * @returns Promise with the rewritten text
 *
 * @example
 * ```ts
 * // Make text more formal
 * const result = await rewrite('hey can u help me out?', {
 *   style: 'formal'
 * });
 * console.log(result.text); // "Would you be able to assist me?"
 * ```
 *
 * @example
 * ```ts
 * // Simplify complex text
 * const result = await rewrite(technicalText, { style: 'simple' });
 * ```
 */
export async function rewrite(
  text: string,
  options: LLMRewriteOptions
): Promise<LLMResponse> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { text: '' };
  }

  if (!text || text.trim().length === 0) {
    throw new Error('text cannot be empty');
  }

  const { style } = options;
  const systemPrompt = buildRewritePrompt(style);

  return sendMessage([{ role: 'user', content: text }], { systemPrompt });
}

/**
 * Rewrite text with streaming output.
 *
 * @param text - The text to rewrite
 * @param onToken - Callback for each token received
 * @param options - Rewrite options specifying the target style
 * @returns Object with stop() function and promise
 *
 * @example
 * ```ts
 * const { promise } = streamRewrite(
 *   'hey whats up',
 *   (event) => setRewritten(event.accumulatedText),
 *   { style: 'professional' }
 * );
 * await promise;
 * ```
 */
export function streamRewrite(
  text: string,
  onToken: LLMStreamCallback,
  options: LLMRewriteOptions
): { promise: Promise<LLMResponse>; stop: () => void } {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { promise: Promise.resolve({ text: '' }), stop: () => {} };
  }

  if (!text || text.trim().length === 0) {
    return {
      promise: Promise.reject(new Error('text cannot be empty')),
      stop: () => {},
    };
  }

  const { style } = options;
  const systemPrompt = buildRewritePrompt(style);

  return streamMessage([{ role: 'user', content: text }], onToken, {
    systemPrompt,
  });
}

/**
 * Extract key points from text using on-device AI.
 *
 * @param text - The text to extract key points from
 * @param options - Optional settings for extraction
 * @returns Promise with the key points as text
 *
 * @example
 * ```ts
 * // Extract key points from an article
 * const result = await extractKeyPoints(article);
 * console.log(result.text);
 * // "• Point 1\n• Point 2\n• Point 3"
 * ```
 *
 * @example
 * ```ts
 * // Limit to 3 key points
 * const result = await extractKeyPoints(article, { maxPoints: 3 });
 * ```
 */
export async function extractKeyPoints(
  text: string,
  options?: LLMExtractKeyPointsOptions
): Promise<LLMResponse> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { text: '' };
  }

  if (!text || text.trim().length === 0) {
    throw new Error('text cannot be empty');
  }

  const maxPoints = options?.maxPoints ?? 5;
  const systemPrompt = buildExtractKeyPointsPrompt(maxPoints);

  return sendMessage([{ role: 'user', content: text }], { systemPrompt });
}

/**
 * Extract key points with streaming output.
 *
 * @param text - The text to extract key points from
 * @param onToken - Callback for each token received
 * @param options - Optional settings for extraction
 * @returns Object with stop() function and promise
 *
 * @example
 * ```ts
 * const { promise } = streamExtractKeyPoints(
 *   article,
 *   (event) => setKeyPoints(event.accumulatedText),
 *   { maxPoints: 5 }
 * );
 * await promise;
 * ```
 */
export function streamExtractKeyPoints(
  text: string,
  onToken: LLMStreamCallback,
  options?: LLMExtractKeyPointsOptions
): { promise: Promise<LLMResponse>; stop: () => void } {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { promise: Promise.resolve({ text: '' }), stop: () => {} };
  }

  if (!text || text.trim().length === 0) {
    return {
      promise: Promise.reject(new Error('text cannot be empty')),
      stop: () => {},
    };
  }

  const maxPoints = options?.maxPoints ?? 5;
  const systemPrompt = buildExtractKeyPointsPrompt(maxPoints);

  return streamMessage([{ role: 'user', content: text }], onToken, {
    systemPrompt,
  });
}

/**
 * Answer a question based on provided context using on-device AI.
 *
 * @param question - The question to answer
 * @param context - The context/document to base the answer on
 * @param options - Optional settings for the answer
 * @returns Promise with the answer
 *
 * @example
 * ```ts
 * // Answer a question about a document
 * const result = await answerQuestion(
 *   'What is the main topic?',
 *   documentText
 * );
 * console.log(result.text);
 * ```
 *
 * @example
 * ```ts
 * // Get a detailed answer
 * const result = await answerQuestion(
 *   'Explain the methodology',
 *   researchPaper,
 *   { detail: 'detailed' }
 * );
 * ```
 */
export async function answerQuestion(
  question: string,
  context: string,
  options?: LLMAnswerQuestionOptions
): Promise<LLMResponse> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { text: '' };
  }

  if (!question || question.trim().length === 0) {
    throw new Error('question cannot be empty');
  }

  if (!context || context.trim().length === 0) {
    throw new Error('context cannot be empty');
  }

  const detail = options?.detail ?? 'medium';
  const systemPrompt = buildAnswerQuestionPrompt(detail);
  const userContent = `Context:\n${context}\n\nQuestion: ${question}`;

  return sendMessage([{ role: 'user', content: userContent }], { systemPrompt });
}

/**
 * Answer a question with streaming output.
 *
 * @param question - The question to answer
 * @param context - The context/document to base the answer on
 * @param onToken - Callback for each token received
 * @param options - Optional settings for the answer
 * @returns Object with stop() function and promise
 *
 * @example
 * ```ts
 * const { promise } = streamAnswerQuestion(
 *   'What are the key findings?',
 *   documentText,
 *   (event) => setAnswer(event.accumulatedText),
 *   { detail: 'detailed' }
 * );
 * await promise;
 * ```
 */
export function streamAnswerQuestion(
  question: string,
  context: string,
  onToken: LLMStreamCallback,
  options?: LLMAnswerQuestionOptions
): { promise: Promise<LLMResponse>; stop: () => void } {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { promise: Promise.resolve({ text: '' }), stop: () => {} };
  }

  if (!question || question.trim().length === 0) {
    return {
      promise: Promise.reject(new Error('question cannot be empty')),
      stop: () => {},
    };
  }

  if (!context || context.trim().length === 0) {
    return {
      promise: Promise.reject(new Error('context cannot be empty')),
      stop: () => {},
    };
  }

  const detail = options?.detail ?? 'medium';
  const systemPrompt = buildAnswerQuestionPrompt(detail);
  const userContent = `Context:\n${context}\n\nQuestion: ${question}`;

  return streamMessage([{ role: 'user', content: userContent }], onToken, {
    systemPrompt,
  });
}

