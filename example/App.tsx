// example/App.tsx
import React, { useState } from 'react';
import { SafeAreaView, TextInput, Button, Text, View } from 'react-native';
import { createSession, sendMessage, type LLMMessage } from 'expo-llm';
export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [reply, setReply] = useState('');

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const id = await createSession({ systemPrompt: 'You are a mock assistant' });
    setSessionId(id);
    return id;
  };

  const onSend = async () => {
    if (!input.trim()) return;
    const id = await ensureSession();

    const newMsg: LLMMessage = { role: 'user', content: input.trim() };
    const allMessages = [...messages, newMsg];

    setMessages(allMessages);
    setInput('');

    const res = await sendMessage(id, allMessages, {
      temperature: 0.7,
    });

    setReply(res.reply);
    setMessages([...allMessages, { role: 'assistant', content: res.reply }]);
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <View style={{ flex: 1 }}>
        {messages.map((m, idx) => (
          <Text key={idx}>
            {m.role}: {m.content}
          </Text>
        ))}
      </View>

      <Text>Son cevap: {reply}</Text>

      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Mesaj yaz"
        style={{
          borderWidth: 1,
          padding: 8,
          marginTop: 8,
          marginBottom: 8,
        }}
      />
      <Button title="Gönder" onPress={onSend} />
    </SafeAreaView>
  );
}