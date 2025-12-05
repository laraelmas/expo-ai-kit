# expo-ai-kit

On-device AI for Expo apps. Run language models locally on iOS using Apple's Foundation Models framework—no API keys, no cloud, just native intelligence.

## Features

- 🔒 **Privacy-first** — All inference happens on-device
- ⚡ **Zero latency** — No network round-trips
- 🆓 **Free** — No API costs or rate limits
- 📱 **Native** — Built on Apple's Foundation Models (iOS 26+)

## Requirements

- iOS 26.0 or later
- Expo SDK 54+
- A device with Apple Silicon (M-series or A17 Pro+)

## Installation

```bash
npx expo install expo-ai-kit
```

For bare React Native projects, run `npx pod-install` after installing.

## Quick Start

```tsx
import { createSession, sendMessage } from 'expo-ai-kit';

// Create a chat session
const sessionId = await createSession({
  systemPrompt: 'You are a helpful assistant.',
});

// Send a message and get a response
const { reply } = await sendMessage(
  sessionId,
  [{ role: 'user', content: 'Hello! What can you do?' }]
);

console.log(reply);
```

## Usage

### Creating a Session

Start by creating a session with an optional system prompt:

```tsx
import { createSession } from 'expo-ai-kit';

const sessionId = await createSession({
  systemPrompt: 'You are a friendly cooking assistant. Help users with recipes and meal planning.',
});
```

### Sending Messages

Send messages and receive AI responses:

```tsx
import { sendMessage, type LLMMessage } from 'expo-ai-kit';

const messages: LLMMessage[] = [
  { role: 'user', content: 'What can I make with eggs and cheese?' }
];

const { reply } = await sendMessage(sessionId, messages);
// reply: "You can make a delicious omelette! Here's how..."
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

Here's a full example of a chat component:

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, FlatList } from 'react-native';
import { createSession, sendMessage, type LLMMessage } from 'expo-ai-kit';

export default function ChatScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const id = await createSession({
      systemPrompt: 'You are a helpful assistant.',
    });
    setSessionId(id);
    return id;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const id = await ensureSession();
    const userMessage: LLMMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const { reply } = await sendMessage(id, updatedMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

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

### `createSession(options?)`

Creates a new chat session.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.systemPrompt` | `string` | Optional system prompt to guide the AI's behavior |

**Returns:** `Promise<string>` — A unique session ID

---

### `sendMessage(sessionId, messages, options?)`

Sends messages and gets a response from the on-device model.

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | The session ID from `createSession` |
| `messages` | `LLMMessage[]` | Array of conversation messages |
| `options.temperature` | `number` | Controls randomness (0-1) |
| `options.maxTokens` | `number` | Maximum response length |

**Returns:** `Promise<{ reply: string }>` — The AI's response

---

### `prepareModel(options?)`

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

## Platform Support

| Platform | Status |
|----------|--------|
| iOS 26+  | ✅ Full support |
| iOS < 26 | ⚠️ Returns mock responses |
| Android  | 🚧 Coming soon |

## License

MIT

## Contributing

Contributions are welcome! Please refer to guidelines described in the [contributing guide](https://github.com/expo/expo#contributing).
