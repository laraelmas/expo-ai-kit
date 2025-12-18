# expo-ai-kit

On-device AI for Expo apps. Run language models locally—no API keys, no cloud, just native intelligence.

[![npm version](https://img.shields.io/npm/v/expo-ai-kit.svg)](https://www.npmjs.com/package/expo-ai-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Platform Support

| Platform | Status | Details |
|----------|--------|---------|
| iOS 26+  | ✅ Full support | Apple Foundation Models |
| Android  | ✅ Full support | [ML Kit Prompt API](https://developers.google.com/ml-kit/genai#prompt-device) |
| iOS < 26 | ⚠️ Limited | Returns mock responses |
| Android (unsupported) | ⚠️ Limited | Returns empty string |

## Features

- 🔒 **Privacy-first** — All inference happens on-device; no data leaves the user's device
- ⚡ **Zero latency** — No network round-trips required
- 🆓 **Free forever** — No API costs, rate limits, or subscriptions
- 📱 **Native performance** — Built on Apple Foundation Models (iOS) and Google ML Kit Prompt API (Android)
- 💬 **Multi-turn conversations** — Session-based chat with full conversation context
- 🎛️ **Configurable** — Temperature and max tokens control for response generation

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

### Session-based Chat

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

### Multi-turn Conversations

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

### `createSession(options?)` — iOS, Android

Creates a new chat session for multi-turn conversations.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.systemPrompt` | `string` | Optional system prompt to guide the AI's behavior |

**Returns:** `Promise<string>` — A unique session ID

---

### `sendMessage(sessionId, messages, options?)` — iOS, Android

Sends messages and gets a response from the on-device model with conversation context.

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | The session ID from `createSession` |
| `messages` | `LLMMessage[]` | Array of conversation messages |
| `options.temperature` | `number` | Controls randomness (0-1) |
| `options.maxTokens` | `number` | Maximum response length |

**Returns:** `Promise<{ reply: string }>` — The AI's response

---

### `prepareModel(options?)` — iOS, Android

Pre-loads the model for faster first response.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.model` | `string` | Model identifier (optional) |

**Returns:** `Promise<void>`

---

### Types

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

## Feature Comparison

| Feature | iOS 26+ | Android (Supported) |
|---------|---------|---------------------|
| `isAvailable()` | ✅ | ✅ |
| `sendPrompt()` | ✅ | ✅ |
| `createSession()` | ✅ Full context | ✅ Basic |
| `sendMessage()` | ✅ Full context | ✅ Basic |
| `prepareModel()` | ✅ | ✅ No-op |
| System prompts | ✅ | ✅ |
| Temperature control | ✅ | ✅ |
| Max tokens control | ✅ | ✅ |

## How It Works

### iOS
Uses Apple's Foundation Models framework introduced in iOS 26. The on-device language model runs entirely locally with no internet connection required.

### Android
Uses Google's ML Kit Prompt API. The model may need to be downloaded on first use on supported devices. Check [supported devices](https://developers.google.com/ml-kit/genai#prompt-device) for compatibility.

## Troubleshooting

### iOS
- **AI not available**: Ensure you're running iOS 26.0 or later on a supported device
- **Mock responses**: On iOS < 26, the module returns mock responses for testing

### Android
- **Empty responses**: The device may not support ML Kit Prompt API. Check the [supported devices list](https://developers.google.com/ml-kit/genai#prompt-device)
- **Model downloading**: On first use, the model may need to download. Use `isAvailable()` to check status

## License

MIT

## Contributing

Contributions are welcome! Please refer to guidelines described in the [contributing guide](https://github.com/expo/expo#contributing).

## Links

- [npm package](https://www.npmjs.com/package/expo-ai-kit)
- [GitHub repository](https://github.com/laraelmas/expo-ai-kit)
- [Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels)
- [Google ML Kit Prompt API](https://developers.google.com/ml-kit/genai)
