/**
 * Chat Memory Management for On-Device AI Models
 *
 * WHY CLIENT-MANAGED MEMORY IS REQUIRED:
 * --------------------------------------
 * On-device AI models (Apple Foundation Models, local LLMs) are stateless.
 * Unlike cloud-based APIs that may maintain server-side conversation state,
 * on-device models have no session persistence or built-in memory.
 *
 * Each generation call accepts a single prompt string and returns a response
 * with no knowledge of previous interactions. To enable multi-turn conversations,
 * the client must:
 *
 * 1. Store all messages locally (this module handles that)
 * 2. Build a complete prompt containing the full conversation history
 * 3. Send the entire context on every generation request
 * 4. Manage memory limits to avoid exceeding model context windows
 *
 * This approach is framework-agnostic and works with React, React Native,
 * Expo, or any JavaScript/TypeScript environment.
 */

import { LLMMessage, LLMRole, ChatMemoryOptions, ChatMemorySnapshot } from './types';

// Default maximum turns if not specified
const DEFAULT_MAX_TURNS = 10;

/**
 * Build a single prompt string from an array of messages.
 *
 * Uses a simple, deterministic format optimized for on-device models:
 *
 * ```
 * SYSTEM: You are a helpful assistant.
 * USER: Hello!
 * ASSISTANT: Hi there!
 * USER: How are you?
 * ```
 *
 * This format is:
 * - Human-readable for debugging
 * - Token-efficient (minimal overhead)
 * - Deterministic (same input = same output)
 * - Compatible with most instruction-following models
 *
 * @param messages - Array of messages to convert to a prompt
 * @returns A single prompt string ready for generation
 *
 * @example
 * ```ts
 * const prompt = buildPrompt([
 *   { role: 'system', content: 'You are helpful.' },
 *   { role: 'user', content: 'Hi!' },
 *   { role: 'assistant', content: 'Hello!' },
 *   { role: 'user', content: 'What is 2+2?' }
 * ]);
 * // Returns:
 * // "SYSTEM: You are helpful.\nUSER: Hi!\nASSISTANT: Hello!\nUSER: What is 2+2?"
 * ```
 */
export function buildPrompt(messages: LLMMessage[]): string {
  if (!messages || messages.length === 0) {
    return '';
  }

  // Map role to uppercase label for clarity
  const roleLabels: Record<LLMRole, string> = {
    system: 'SYSTEM',
    user: 'USER',
    assistant: 'ASSISTANT',
  };

  return messages
    .map((msg) => `${roleLabels[msg.role]}: ${msg.content}`)
    .join('\n');
}

/**
 * ChatMemoryManager - Manages conversation history for stateless on-device AI models.
 *
 * IMPORTANT: On-device models have no built-in memory or session state.
 * This class stores messages client-side and provides methods to:
 * - Add user and assistant messages
 * - Build a complete prompt from conversation history
 * - Limit history to prevent context overflow
 * - Clear or reset the conversation
 *
 * The manager automatically trims old messages when the turn limit is exceeded,
 * keeping the most recent exchanges while preserving the system prompt.
 *
 * @example
 * ```ts
 * // Create a memory manager with a system prompt
 * const memory = new ChatMemoryManager({
 *   maxTurns: 5,
 *   systemPrompt: 'You are a helpful coding assistant.'
 * });
 *
 * // Add a user message
 * memory.addUserMessage('How do I reverse a string in JavaScript?');
 *
 * // Get the full prompt for generation
 * const prompt = memory.getPrompt();
 * // "SYSTEM: You are a helpful coding assistant.\nUSER: How do I reverse a string in JavaScript?"
 *
 * // After generation, add the assistant's response
 * const response = await generate(prompt);
 * memory.addAssistantMessage(response);
 *
 * // Continue the conversation
 * memory.addUserMessage('Can you show me with an arrow function?');
 * const nextPrompt = memory.getPrompt();
 * // Now includes the full conversation history
 * ```
 */
export class ChatMemoryManager {
  // Internal storage for conversation messages (excluding system prompt)
  private messages: LLMMessage[] = [];

  // Optional system prompt, stored separately to ensure it's never trimmed
  private systemPrompt: string | undefined;

  // Maximum conversation turns to retain
  private maxTurns: number;

  /**
   * Create a new ChatMemoryManager.
   *
   * @param options - Configuration options
   * @param options.maxTurns - Max turns to keep (default: 10). A turn = 1 user + 1 assistant message.
   * @param options.systemPrompt - Optional system prompt to include in every prompt.
   */
  constructor(options: ChatMemoryOptions = {}) {
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.systemPrompt = options.systemPrompt;
  }

  /**
   * Add a user message to the conversation history.
   *
   * @param content - The user's message content
   */
  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
    this.trimHistory();
  }

  /**
   * Add an assistant message to the conversation history.
   * Call this after receiving a response from the model.
   *
   * @param content - The assistant's response content
   */
  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content });
    this.trimHistory();
  }

  /**
   * Add a message with any role to the conversation history.
   *
   * @param message - The message to add
   */
  addMessage(message: LLMMessage): void {
    // System messages update the system prompt instead of adding to history
    if (message.role === 'system') {
      this.systemPrompt = message.content;
      return;
    }
    this.messages.push(message);
    this.trimHistory();
  }

  /**
   * Get the complete prompt string for the current conversation.
   *
   * This method builds a single prompt containing:
   * 1. The system prompt (if set)
   * 2. All conversation messages within the turn limit
   *
   * Send this prompt to the on-device model for generation.
   *
   * @returns The complete prompt string
   */
  getPrompt(): string {
    const allMessages = this.getAllMessages();
    return buildPrompt(allMessages);
  }

  /**
   * Get all messages including the system prompt as an LLMMessage array.
   *
   * Useful if you need to pass messages to an API that accepts message arrays
   * rather than a single prompt string.
   *
   * @returns Array of all messages including system prompt
   */
  getAllMessages(): LLMMessage[] {
    const result: LLMMessage[] = [];

    // System prompt always comes first (if present)
    if (this.systemPrompt) {
      result.push({ role: 'system', content: this.systemPrompt });
    }

    result.push(...this.messages);
    return result;
  }

  /**
   * Get only the conversation messages (excludes system prompt).
   *
   * @returns Array of user and assistant messages
   */
  getMessages(): LLMMessage[] {
    return [...this.messages];
  }

  /**
   * Get a snapshot of the current memory state.
   *
   * Useful for debugging, persistence, or UI display.
   *
   * @returns Current memory state snapshot
   */
  getSnapshot(): ChatMemorySnapshot {
    return {
      messages: this.getAllMessages(),
      systemPrompt: this.systemPrompt,
      turnCount: this.getTurnCount(),
      maxTurns: this.maxTurns,
    };
  }

  /**
   * Get the current number of conversation turns.
   *
   * A turn is counted as a user message (assistant responses don't add turns).
   * This reflects how many user interactions have occurred.
   *
   * @returns Number of turns in the current conversation
   */
  getTurnCount(): number {
    return this.messages.filter((m) => m.role === 'user').length;
  }

  /**
   * Update the system prompt.
   *
   * The system prompt is preserved separately and never trimmed by turn limits.
   *
   * @param prompt - New system prompt, or undefined to clear
   */
  setSystemPrompt(prompt: string | undefined): void {
    this.systemPrompt = prompt;
  }

  /**
   * Get the current system prompt.
   *
   * @returns The system prompt or undefined if not set
   */
  getSystemPrompt(): string | undefined {
    return this.systemPrompt;
  }

  /**
   * Update the maximum number of turns to retain.
   *
   * If the new limit is lower than current turn count, older messages
   * will be trimmed immediately.
   *
   * @param maxTurns - New maximum turns
   */
  setMaxTurns(maxTurns: number): void {
    this.maxTurns = maxTurns;
    this.trimHistory();
  }

  /**
   * Clear all conversation messages but keep the system prompt.
   *
   * Use this to start a new conversation with the same assistant persona.
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Reset everything including the system prompt.
   *
   * Use this for a complete fresh start.
   */
  reset(): void {
    this.messages = [];
    this.systemPrompt = undefined;
  }

  /**
   * Trim conversation history to stay within the turn limit.
   *
   * This preserves the most recent messages while removing older ones.
   * The system prompt is never affected by trimming.
   *
   * Trimming strategy:
   * - Count turns (user messages)
   * - If over limit, remove oldest user+assistant pairs
   * - Always keep complete pairs to maintain conversation coherence
   */
  private trimHistory(): void {
    // Count current turns (user messages)
    const userMessageIndices: number[] = [];
    this.messages.forEach((msg, idx) => {
      if (msg.role === 'user') {
        userMessageIndices.push(idx);
      }
    });

    const turnsToRemove = userMessageIndices.length - this.maxTurns;

    if (turnsToRemove <= 0) {
      return; // Within limits, no trimming needed
    }

    // Find the index after the last turn we need to remove
    // This removes complete turns (user + any following assistant messages)
    const lastTurnToRemoveIdx = userMessageIndices[turnsToRemove - 1];

    // Find where to cut: after the assistant response following this user message
    // (or at the next user message if no assistant response)
    let cutIndex = lastTurnToRemoveIdx + 1;
    while (
      cutIndex < this.messages.length &&
      this.messages[cutIndex].role === 'assistant'
    ) {
      cutIndex++;
    }

    // Remove the oldest messages
    this.messages = this.messages.slice(cutIndex);
  }
}
