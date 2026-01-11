# expo-ai-kit

On-device AI for Expo apps. Run language models locally—no API keys, no cloud, just native intelligence.

[![npm version](https://img.shields.io/npm/v/expo-ai-kit.svg)](https://www.npmjs.com/package/expo-ai-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Platform Support

### Supported

| Platform | Details |
|----------|---------|
| iOS 26+ | [Apple Foundation Models](https://developer.apple.com/documentation/FoundationModels) |
| Android (supported devices) | [ML Kit Prompt API](https://developers.google.com/ml-kit/genai#prompt-device) |

### Unsupported

| Platform | Fallback Behavior |
|----------|-------------------|
| iOS < 26 | Returns fallback message |
| Android (unsupported devices) | Returns empty string |

## Features

- **Privacy-first** — All inference happens on-device; no data leaves the user's device
- **Zero latency** — No network round-trips required
- **Free forever** — No API costs, rate limits, or subscriptions
- **Native performance** — Built on Apple Foundation Models (iOS) and Google ML Kit Prompt API (Android)
- **Multi-turn conversations** — Full conversation context support
- **Streaming support** — Progressive token streaming for responsive UIs
- **Simple API** — Core functions plus prompt helpers for common tasks
- **Prompt helpers** — Built-in `summarize()`, `translate()`, `rewrite()`, and more
- **Chat memory** — Built-in `ChatMemoryManager` for managing conversation history

## Requirements

- Expo SDK 54+
- **iOS:** iOS 26.0+ (full support), iOS 15.1+ (limited)
- **Android:** API 26+, [Supported devices](https://developers.google.com/ml-kit/genai#prompt-device)

## Installation

```bash
npx expo install expo-ai-kit
```

For bare React Native projects, run `npx pod-install` after installing.

### Android Configuration

For Android, ensure your `app.json` includes the minimum SDK version:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 26
          }
        }
      ]
    ]
  }
}
```

## Quick Start

```tsx
import { isAvailable, sendMessage } from 'expo-ai-kit';

// Check if on-device AI is available
const available = await isAvailable();

if (available) {
  const response = await sendMessage([
    { role: 'user', content: 'Hello! What can you do?' }
  ]);
  console.log(response.text);
}
```

## Usage

### Simple Prompt

The simplest way to use on-device AI:

```tsx
import { isAvailable, sendMessage } from 'expo-ai-kit';

async function askAI(question: string) {
  const available = await isAvailable();

  if (!available) {
    console.log('On-device AI not available');
    return null;
  }

  const response = await sendMessage([
    { role: 'user', content: question }
  ]);
  return response.text;
}

const answer = await askAI('What is the capital of France?');
```

### With Custom System Prompt

Customize the AI's behavior with a system prompt:

```tsx
import { sendMessage } from 'expo-ai-kit';

const response = await sendMessage(
  [{ role: 'user', content: 'Tell me a joke' }],
  { systemPrompt: 'You are a comedian who specializes in dad jokes.' }
);

console.log(response.text);
```

### Multi-turn Conversations

For conversations with context, use `ChatMemoryManager` to manage history:

```tsx
import { ChatMemoryManager, streamMessage } from 'expo-ai-kit';

// Create a memory manager (handles history automatically)
const memory = new ChatMemoryManager({
  maxTurns: 10,
  systemPrompt: 'You are a helpful assistant.',
});

// Add user message and get response
memory.addUserMessage('My name is Alice.');
const { promise } = streamMessage(
  memory.getAllMessages(),
  (event) => console.log(event.accumulatedText)
);
const response = await promise;

// Store assistant response in memory
memory.addAssistantMessage(response.text);

// Continue the conversation (memory includes full history)
memory.addUserMessage('What is my name?');
const { promise: p2 } = streamMessage(
  memory.getAllMessages(),
  (event) => console.log(event.accumulatedText)
);
// Response: "Your name is Alice."
```

Or manually manage the conversation array:

```tsx
import { sendMessage, type LLMMessage } from 'expo-ai-kit';

const conversation: LLMMessage[] = [
  { role: 'user', content: 'My name is Alice.' },
  { role: 'assistant', content: 'Nice to meet you, Alice!' },
  { role: 'user', content: 'What is my name?' },
];

const response = await sendMessage(conversation, {
  systemPrompt: 'You are a helpful assistant.',
});

console.log(response.text); // "Your name is Alice."
```

### Streaming Responses

For a ChatGPT-like experience where text appears progressively:

```tsx
import { streamMessage } from 'expo-ai-kit';

const [responseText, setResponseText] = useState('');

const { promise, stop } = streamMessage(
  [{ role: 'user', content: 'Tell me a story' }],
  (event) => {
    // Update UI with each token
    setResponseText(event.accumulatedText);

    // event.token - the new token/chunk
    // event.accumulatedText - full text so far
    // event.isDone - whether streaming is complete
  },
  { systemPrompt: 'You are a creative storyteller.' }
);

// Optionally cancel the stream
// stop();

// Wait for completion
await promise;
```

### Prompt Helpers

Use built-in helpers for common AI tasks without crafting prompts:

```tsx
import { summarize, translate, rewrite, extractKeyPoints, answerQuestion } from 'expo-ai-kit';

// Summarize text
const summary = await summarize(longArticle, { length: 'short', style: 'bullets' });

// Translate text
const translated = await translate('Hello, world!', { to: 'Spanish' });

// Rewrite in a different style
const formal = await rewrite('hey whats up', { style: 'formal' });

// Extract key points
const points = await extractKeyPoints(article, { maxPoints: 5 });

// Answer questions about content
const answer = await answerQuestion('What is the main topic?', documentText);
```

All helpers also have streaming variants (`streamSummarize`, `streamTranslate`, etc.):

```tsx
const { promise, stop } = streamSummarize(
  longArticle,
  (event) => setSummary(event.accumulatedText),
  { style: 'bullets' }
);
```

### Streaming with Cancel Button

```tsx
import { useState, useRef } from 'react';
import { streamMessage } from 'expo-ai-kit';

function ChatWithStreaming() {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const handleSend = async () => {
    setIsStreaming(true);
    setText('');

    const { promise, stop } = streamMessage(
      [{ role: 'user', content: 'Write a long story' }],
      (event) => setText(event.accumulatedText)
    );

    stopRef.current = stop;
    await promise;
    stopRef.current = null;
    setIsStreaming(false);
  };

  const handleStop = () => {
    stopRef.current?.();
    setIsStreaming(false);
  };

  return (
    <View>
      <Text>{text}</Text>
      {isStreaming ? (
        <Button title="Stop" onPress={handleStop} />
      ) : (
        <Button title="Send" onPress={handleSend} />
      )}
    </View>
  );
}
```

### Complete Chat Example

Here's a full cross-platform chat component:

```tsx
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, FlatList } from 'react-native';
import { isAvailable, sendMessage, type LLMMessage } from 'expo-ai-kit';

export default function ChatScreen() {
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    isAvailable().then(setAvailable);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading || !available) return;

    const userMessage: LLMMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await sendMessage(newMessages, {
        systemPrompt: 'You are a helpful assistant.',
      });
      setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!available) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>On-device AI is not available on this device</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={{
            padding: 12,
            marginVertical: 4,
            backgroundColor: item.role === 'user' ? '#007AFF' : '#E5E5EA',
            borderRadius: 16,
            alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
          }}>
            <Text style={{ color: item.role === 'user' ? '#fff' : '#000' }}>
              {item.content}
            </Text>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          style={{ flex: 1, borderWidth: 1, borderRadius: 8, padding: 12 }}
        />
        <Button title={loading ? '...' : 'Send'} onPress={handleSend} />
      </View>
    </View>
  );
}
```

## API Reference

### `isAvailable()`

Checks if on-device AI is available on the current device.

```typescript
function isAvailable(): Promise<boolean>
```

**Returns:** `Promise<boolean>` — `true` if on-device AI is supported and ready

---

### `sendMessage(messages, options?)`

Sends a conversation and gets a response from the on-device model.

```typescript
function sendMessage(messages: LLMMessage[], options?: LLMSendOptions): Promise<LLMResponse>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | `LLMMessage[]` | Array of conversation messages |
| `options.systemPrompt` | `string` | Fallback system prompt (ignored if messages contain a system message) |

**Returns:** `Promise<LLMResponse>` — Object with `text` property containing the response

**Example:**
```tsx
const response = await sendMessage([
  { role: 'system', content: 'You are a pirate.' },
  { role: 'user', content: 'Hello!' },
]);
console.log(response.text); // "Ahoy, matey!"
```

---

### `streamMessage(messages, onToken, options?)`

Streams a conversation response with progressive token updates. Ideal for responsive chat UIs.

```typescript
function streamMessage(
  messages: LLMMessage[],
  onToken: LLMStreamCallback,
  options?: LLMStreamOptions
): { promise: Promise<LLMResponse>; stop: () => void }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | `LLMMessage[]` | Array of conversation messages |
| `onToken` | `LLMStreamCallback` | Callback called for each token received |
| `options.systemPrompt` | `string` | Fallback system prompt (ignored if messages contain a system message) |

**Returns:** Object with:
- `promise: Promise<LLMResponse>` — Resolves when streaming completes
- `stop: () => void` — Function to cancel the stream

**Example:**
```tsx
const { promise, stop } = streamMessage(
  [{ role: 'user', content: 'Hello!' }],
  (event) => {
    console.log(event.token);           // New token: "Hi"
    console.log(event.accumulatedText); // Full text: "Hi there!"
    console.log(event.isDone);          // false until complete
  }
);

// Cancel if needed
setTimeout(() => stop(), 5000);

// Wait for completion
const response = await promise;
```

---

### `summarize(text, options?)`

Summarizes text using on-device AI.

```typescript
function summarize(text: string, options?: LLMSummarizeOptions): Promise<LLMResponse>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to summarize |
| `options.length` | `'short' \| 'medium' \| 'long'` | Summary length (default: `'medium'`) |
| `options.style` | `'paragraph' \| 'bullets' \| 'tldr'` | Output format (default: `'paragraph'`) |

**Streaming:** `streamSummarize(text, onToken, options?)`

---

### `translate(text, options)`

Translates text to another language.

```typescript
function translate(text: string, options: LLMTranslateOptions): Promise<LLMResponse>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to translate |
| `options.to` | `string` | Target language (required) |
| `options.from` | `string` | Source language (auto-detected if omitted) |
| `options.tone` | `'formal' \| 'informal' \| 'neutral'` | Translation tone (default: `'neutral'`) |

**Streaming:** `streamTranslate(text, onToken, options)`

---

### `rewrite(text, options)`

Rewrites text in a different style.

```typescript
function rewrite(text: string, options: LLMRewriteOptions): Promise<LLMResponse>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to rewrite |
| `options.style` | `string` | Target style (required) |

**Available styles:** `'formal'`, `'casual'`, `'professional'`, `'friendly'`, `'concise'`, `'detailed'`, `'simple'`, `'academic'`

**Streaming:** `streamRewrite(text, onToken, options)`

---

### `extractKeyPoints(text, options?)`

Extracts key points from text as bullet points.

```typescript
function extractKeyPoints(text: string, options?: LLMExtractKeyPointsOptions): Promise<LLMResponse>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to analyze |
| `options.maxPoints` | `number` | Maximum points to extract (default: `5`) |

**Streaming:** `streamExtractKeyPoints(text, onToken, options?)`

---

### `answerQuestion(question, context, options?)`

Answers a question based on provided context.

```typescript
function answerQuestion(question: string, context: string, options?: LLMAnswerQuestionOptions): Promise<LLMResponse>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `question` | `string` | Question to answer |
| `context` | `string` | Context/document to base answer on |
| `options.detail` | `'brief' \| 'medium' \| 'detailed'` | Answer detail level (default: `'medium'`) |

**Streaming:** `streamAnswerQuestion(question, context, onToken, options?)`

---

### `ChatMemoryManager`

Manages conversation history for stateless on-device AI models. Automatically handles turn limits and provides the full message array for each request.

```typescript
class ChatMemoryManager {
  constructor(options?: ChatMemoryOptions);

  addUserMessage(content: string): void;
  addAssistantMessage(content: string): void;
  addMessage(message: LLMMessage): void;

  getAllMessages(): LLMMessage[];
  getMessages(): LLMMessage[];
  getPrompt(): string;
  getSnapshot(): ChatMemorySnapshot;
  getTurnCount(): number;

  setSystemPrompt(prompt: string | undefined): void;
  getSystemPrompt(): string | undefined;
  setMaxTurns(maxTurns: number): void;

  clear(): void;
  reset(): void;
}
```

| Option | Type | Description |
|--------|------|-------------|
| `maxTurns` | `number` | Maximum conversation turns to keep (default: `10`) |
| `systemPrompt` | `string` | System prompt to include in every request |

**Why use ChatMemoryManager?**

On-device models are stateless — they have no built-in memory. Each request must include the full conversation history. `ChatMemoryManager` handles this automatically:

- Stores messages client-side
- Automatically trims old messages when limit is reached
- Preserves the system prompt (never trimmed)
- Provides `getAllMessages()` for API calls

**Example with React:**

```tsx
import { useRef } from 'react';
import { ChatMemoryManager, streamMessage } from 'expo-ai-kit';

function Chat() {
  const memoryRef = useRef(new ChatMemoryManager({
    maxTurns: 10,
    systemPrompt: 'You are a helpful assistant.',
  }));

  const sendMessage = async (text: string) => {
    memoryRef.current.addUserMessage(text);

    const { promise } = streamMessage(
      memoryRef.current.getAllMessages(),
      (event) => setResponse(event.accumulatedText)
    );

    const response = await promise;
    memoryRef.current.addAssistantMessage(response.text);
  };

  const clearChat = () => memoryRef.current.clear();
}
```

---

### `buildPrompt(messages)`

Converts a message array to a single prompt string. Useful for debugging or custom implementations.

```typescript
function buildPrompt(messages: LLMMessage[]): string
```

**Example:**
```tsx
import { buildPrompt } from 'expo-ai-kit';

const prompt = buildPrompt([
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hi!' },
  { role: 'assistant', content: 'Hello!' },
]);
// "SYSTEM: You are helpful.\nUSER: Hi!\nASSISTANT: Hello!"
```

---

### Types

```typescript
type LLMRole = 'system' | 'user' | 'assistant';

type LLMMessage = {
  role: LLMRole;
  content: string;
};

type LLMSendOptions = {
  /** Fallback system prompt if no system message in messages array */
  systemPrompt?: string;
};

type LLMStreamOptions = {
  /** Fallback system prompt if no system message in messages array */
  systemPrompt?: string;
};

type LLMResponse = {
  /** The generated response text */
  text: string;
};

type LLMStreamEvent = {
  /** Unique identifier for this streaming session */
  sessionId: string;
  /** The token/chunk of text received */
  token: string;
  /** Accumulated text so far */
  accumulatedText: string;
  /** Whether this is the final chunk */
  isDone: boolean;
};

type LLMStreamCallback = (event: LLMStreamEvent) => void;

// Prompt Helper Types
type LLMSummarizeOptions = {
  length?: 'short' | 'medium' | 'long';
  style?: 'paragraph' | 'bullets' | 'tldr';
};

type LLMTranslateOptions = {
  to: string;
  from?: string;
  tone?: 'formal' | 'informal' | 'neutral';
};

type LLMRewriteOptions = {
  style: 'formal' | 'casual' | 'professional' | 'friendly' | 'concise' | 'detailed' | 'simple' | 'academic';
};

type LLMExtractKeyPointsOptions = {
  maxPoints?: number;
};

type LLMAnswerQuestionOptions = {
  detail?: 'brief' | 'medium' | 'detailed';
};

// Chat Memory Types
type ChatMemoryOptions = {
  /** Maximum conversation turns to keep (default: 10) */
  maxTurns?: number;
  /** System prompt to include in every request */
  systemPrompt?: string;
};

type ChatMemorySnapshot = {
  messages: LLMMessage[];
  systemPrompt: string | undefined;
  turnCount: number;
  maxTurns: number;
};
```

## Feature Comparison

| Feature | iOS 26+ | Android (Supported) |
|---------|---------|---------------------|
| `isAvailable()` | ✅ | ✅ |
| `sendMessage()` | ✅ | ✅ |
| `streamMessage()` | ✅ | ✅ |
| Prompt helpers | ✅ | ✅ |
| `ChatMemoryManager` | ✅ | ✅ |
| System prompts | ✅ Native | ✅ Prepended |
| Multi-turn context | ✅ | ✅ |
| Cancel streaming | ✅ | ✅ |

## How It Works

### iOS
Uses Apple's Foundation Models framework introduced in iOS 26. The on-device language model runs entirely locally with no internet connection required.

### Android
Uses Google's ML Kit Prompt API. The model may need to be downloaded on first use on supported devices. Check [supported devices](https://developers.google.com/ml-kit/genai#prompt-device) for compatibility.

## Troubleshooting

### iOS
- **AI not available**: Ensure you're running iOS 26.0 or later on a supported device
- **Fallback responses**: On iOS < 26, the module returns a fallback message

### Android
- **Empty responses**: The device may not support ML Kit Prompt API. Check the [supported devices list](https://developers.google.com/ml-kit/genai#prompt-device)
- **Model downloading**: On first use, the model may need to download. Use `isAvailable()` to check status

## Migration from v0.1.4

If you're upgrading from an earlier version, here are the breaking changes:

| Old API | New API |
|---------|---------|
| `sendPrompt(prompt)` | `sendMessage([{ role: 'user', content: prompt }])` |
| `createSession(options)` | **Removed** — no longer needed |
| `sendMessage(sessionId, messages, options)` | `sendMessage(messages, options)` — no session ID |
| `prepareModel(options)` | **Removed** |
| `{ reply: string }` | `{ text: string }` |

**Before:**
```tsx
const sessionId = await createSession({ systemPrompt: '...' });
const { reply } = await sendMessage(sessionId, messages, {});
```

**After:**
```tsx
const { text } = await sendMessage(messages, { systemPrompt: '...' });
```

## Roadmap

| Feature | Status | Priority |
|---------|--------|----------|
| ✅ Streaming responses | Done | - |
| ✅ Prompt helpers (summarize, translate, etc.) | Done | - |
| ✅ Chat memory management | Done | - |
| Web/generic fallback | Idea | Medium |
| Configurable hyperparameters (temperature, etc.) | Idea | Low |

Have a feature request? [Open an issue](https://github.com/laraelmas/expo-ai-kit/issues)!

## License

MIT

## Contributing

Contributions are welcome! Please refer to guidelines described in the [contributing guide](https://github.com/expo/expo#contributing).

## Links

- [Documentation](https://expo-ai-kit.com)
- [npm package](https://www.npmjs.com/package/expo-ai-kit)
- [GitHub repository](https://github.com/laraelmas/expo-ai-kit)
- [Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels)
- [Google ML Kit Prompt API](https://developers.google.com/ml-kit/genai)
