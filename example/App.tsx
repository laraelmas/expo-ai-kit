// example/App.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createSession,
  sendMessage,
  type LLMMessage,
} from 'expo-ai-kit';

type ChatMessage = LLMMessage & { id: string };

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const id = await createSession({
      systemPrompt:
        'You are a helpful assistant running on-device inside an Expo app.',
    });
    setSessionId(id);
    return id;
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const id = await ensureSession();

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmed,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);

    try {
      const { reply } = await sendMessage(
        id,
        nextMessages.map(({ role, content }) => ({ role, content })),
        {},
      );

      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: reply,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: 'Bir hata oluştu, lütfen tekrar dener misin?',
      };
      setMessages((prev) => [...prev, errorMsg]);
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.bubbleRow,
          isUser ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.userBubbleText : styles.assistantBubbleText,
            ]}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        {/* Header */}
    <View style={styles.header}>
    <View>
      <Text style={styles.title}>expo-ai-kit</Text>
      <Text style={styles.subtitle}>On-device chat demo</Text>
    </View>
    </View>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesContent}
          />
        </View>

        {/* Input bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputInner}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Mesaj yaz..."
              placeholderTextColor="#8e8e93"
              style={styles.textInput}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => {
                if (!input.includes('\n')) {
                  handleSend();
                }
              }}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || isSending}
              style={[
                styles.sendButton,
                (!input.trim() || isSending) && styles.sendButtonDisabled,
              ]}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.sendButtonText}>Gönder</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f2f7', 
    paddingVertical: 16,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,          
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d1d6',
    backgroundColor: '#f9f9fb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bubbleRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#0a84ff', 
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#e5e5ea',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userBubbleText: {
    color: '#ffffff',
  },
  assistantBubbleText: {
    color: '#111827',
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
    backgroundColor: '#f2f2f7',
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 4,
    paddingRight: 8,
  },
  sendButton: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});