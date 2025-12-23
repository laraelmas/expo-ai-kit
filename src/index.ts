import ExpoAiKitModule from './ExpoAiKitModule';
import { Platform } from 'react-native';
import {
  LLMMessage,
  LLMSendOptions,
  LLMResponse,
  LLMStreamOptions,
  LLMStreamEvent,
  LLMStreamCallback,
} from './types';

export * from './types';

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful, friendly assistant. Answer the user directly and concisely.';

let streamIdCounter = 0;
function generateSessionId(): string {
  return `stream_${Date.now()}_${++streamIdCounter}`;
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

