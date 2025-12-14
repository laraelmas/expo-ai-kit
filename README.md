# expo-ai-kit

On-device AI for Expo apps. Run language models locally—no API keys, no cloud, just native intelligence.

## Platform Support

| Platform | Status |
|----------|--------|
| iOS 26+  | ✅ Full support |
| Android  | ✅ [Supported devices](https://developers.google.com/ml-kit/genai#prompt-device) |
| iOS < 26 | ⚠️ Returns mock responses |
| Android (unsupported devices) | ⚠️ Returns empty string |

## Features

- 🔒 **Privacy-first** — All inference happens on-device
- ⚡ **Zero latency** — No network round-trips
- 🆓 **Free** — No API costs or rate limits
- 📱 **Native** — Built on Apple Foundation Models (iOS) and ML Kit Prompt API (Android)

## Requirements

- Expo SDK 54+
- **iOS:** iOS 26.0+
- **Android:** API 26+, [Supported devices](https://developers.google.com/ml-kit/genai#prompt-device)

## Installation

```bash
npx expo install expo-ai-kit
```

For bare React Native projects, run `npx pod-install` after installing.

## Quick Start

```tsx
import { isAvailable, sendPrompt } from 'expo-ai-kit';

// Check if on-device AI is available
const available = await isAvailable();

if (available) {
  const response = await sendPrompt('Hello! What can you do?');
  console.log(response);
}
```

## Usage

### Simple Prompt (Cross-platform)

The simplest way to use on-device AI:

```tsx
import { isAvailable, sendPrompt } from 'expo-ai-kit';

async function askAI(question: string) {
  const available = await isAvailable();

  if (!available) {
    console.log('On-device AI not available');
    return null;
  }

  return await sendPrompt(question);
}

const answer = await askAI('What is the capital of France?');
```

### Session-based Chat (iOS only)

For multi-turn conversations with context, use sessions:

```tsx
import { createSession, sendMessage } from 'expo-ai-kit';

// Create a chat session
const sessionId = await createSession({
  systemPrompt: 'You are a friendly cooking assistant.',
});

// Send messages with conversation history
const { reply } = await sendMessage(sessionId, [
  { role: 'user', content: 'What can I make with eggs and cheese?' }
]);
```

### Multi-turn Conversations (iOS only)

Keep track of the conversation history for context-aware responses:

```tsx
const [messages, setMessages] = useState<LLMMessage[]>([]);

async function chat(userMessage: string) {
  const newMessages = [
    ...messages,
    { role: 'user', content: userMessage }
  ];

  const { reply } = await sendMessage(sessionId, newMessages);

  setMessages([
    ...newMessages,
    { role: 'assistant', content: reply }
  ]);

  return reply;
}
```

### Complete Chat Example

Here's a full cross-platform chat component:

```tsx
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, FlatList } from 'react-native';
import { isAvailable, sendPrompt } from 'expo-ai-kit';

export default function ChatScreen() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    isAvailable().then(setAvailable);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading || !available) return;

    const userMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendPrompt(input.trim());
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
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

### `isAvailable()` — iOS, Android

Checks if on-device AI is available on the current device.

**Returns:** `Promise<boolean>` — `true` if on-device AI is supported and ready

---

### `sendPrompt(prompt)` — iOS, Android

Sends a prompt and gets a response from the on-device model.

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `string` | The text prompt to send |

**Returns:** `Promise<string>` — The AI's response (empty string if unavailable)

---

### `createSession(options?)` — iOS only

Creates a new chat session for multi-turn conversations.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.systemPrompt` | `string` | Optional system prompt to guide the AI's behavior |

**Returns:** `Promise<string>` — A unique session ID

---

### `sendMessage(sessionId, messages, options?)` — iOS only

Sends messages and gets a response from the on-device model with conversation context.

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | The session ID from `createSession` |
| `messages` | `LLMMessage[]` | Array of conversation messages |
| `options.temperature` | `number` | Controls randomness (0-1) |
| `options.maxTokens` | `number` | Maximum response length |

**Returns:** `Promise<{ reply: string }>` — The AI's response

---

### `prepareModel(options?)` — iOS only

Pre-loads the model for faster first response.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.model` | `string` | Model identifier (optional) |

**Returns:** `Promise<void>`

---

### Types (iOS only)

```typescript
type LLMRole = 'system' | 'user' | 'assistant';

type LLMMessage = {
  role: LLMRole;
  content: string;
};

type LLMOptions = {
  temperature?: number;
  maxTokens?: number;
  model?: string;
};
```

## License

MIT

## Contributing

Contributions are welcome! Please refer to guidelines described in the [contributing guide](https://github.com/expo/expo#contributing).
