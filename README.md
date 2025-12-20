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
- **Simple API** — Just 2 functions: `isAvailable()` and `sendMessage()`

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

For conversations with context, pass the full conversation history:

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

type LLMResponse = {
  /** The generated response text */
  text: string;
};
```

## Feature Comparison

| Feature | iOS 26+ | Android (Supported) |
|---------|---------|---------------------|
| `isAvailable()` | ✅ | ✅ |
| `sendMessage()` | ✅ | ✅ |
| System prompts | ✅ Native | ✅ Prepended |
| Multi-turn context | ✅ | ✅ |

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

## Migration from v0.1.x

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
