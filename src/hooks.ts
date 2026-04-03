import { useState, useEffect, useRef, useCallback } from 'react';
import {
  isAvailable,
  streamMessage,
  getBuiltInModels as getBuiltInModelsApi,
  getDownloadableModels as getDownloadableModelsApi,
  downloadModel as downloadModelApi,
  deleteModel as deleteModelApi,
} from './index';
import { ChatMemoryManager } from './memory';
import ExpoAiKitModule from './ExpoAiKitModule';
import type {
  LLMMessage,
  UseChatOptions,
  UseChatReturn,
  UseCompletionOptions,
  UseCompletionReturn,
  UseOnDeviceAIReturn,
  BuiltInModel,
  DownloadableModel,
  DownloadableModelStatus,
  ModelError,
} from './types';

// Cache availability result across all hook instances
let availabilityCache: boolean | null = null;
let availabilityPromise: Promise<boolean> | null = null;

function checkAvailability(): Promise<boolean> {
  if (availabilityCache !== null) {
    return Promise.resolve(availabilityCache);
  }
  if (!availabilityPromise) {
    availabilityPromise = isAvailable().then((result) => {
      availabilityCache = result;
      return result;
    });
  }
  return availabilityPromise;
}

/**
 * React hook to check if on-device AI is available.
 *
 * Caches the result so multiple components don't re-check.
 *
 * @returns Object with isAvailable and isChecking states
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isAvailable, isChecking } = useOnDeviceAI();
 *
 *   if (isChecking) return <Text>Checking AI availability...</Text>;
 *   if (!isAvailable) return <Text>On-device AI not available</Text>;
 *
 *   return <ChatComponent />;
 * }
 * ```
 */
export function useOnDeviceAI(): UseOnDeviceAIReturn {
  const [available, setAvailable] = useState(availabilityCache ?? false);
  const [checking, setChecking] = useState(availabilityCache === null);

  useEffect(() => {
    if (availabilityCache !== null) {
      setAvailable(availabilityCache);
      setChecking(false);
      return;
    }

    let mounted = true;
    checkAvailability().then((result) => {
      if (mounted) {
        setAvailable(result);
        setChecking(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { isAvailable: available, isChecking: checking };
}

/**
 * React hook for building chat interfaces with on-device AI.
 *
 * Manages messages, input state, streaming, and conversation memory automatically.
 * Built on top of ChatMemoryManager and streamMessage.
 *
 * @param options - Configuration options for the chat
 * @returns Chat state and control functions
 *
 * @example
 * ```tsx
 * function ChatScreen() {
 *   const { messages, input, setInput, sendMessage, isStreaming, stop } = useChat({
 *     systemPrompt: 'You are a helpful assistant.',
 *   });
 *
 *   return (
 *     <View>
 *       <FlatList
 *         data={messages}
 *         renderItem={({ item }) => (
 *           <Text>{item.role}: {item.content}</Text>
 *         )}
 *       />
 *       <TextInput value={input} onChangeText={setInput} />
 *       {isStreaming ? (
 *         <Button title="Stop" onPress={stop} />
 *       ) : (
 *         <Button title="Send" onPress={() => sendMessage()} />
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { systemPrompt, maxTurns, initialMessages, onFinish, onError } = options;

  const memoryRef = useRef(new ChatMemoryManager({ maxTurns, systemPrompt }));

  // Initialize with initial messages
  const initializedRef = useRef(false);
  if (!initializedRef.current && initialMessages) {
    for (const msg of initialMessages) {
      memoryRef.current.addMessage(msg);
    }
    initializedRef.current = true;
  }

  const [messages, setMessages] = useState<LLMMessage[]>(memoryRef.current.getMessages());
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const inputRef = useRef(input);
  inputRef.current = input;
  const streamingRef = useRef(isStreaming);
  streamingRef.current = isStreaming;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopRef.current?.();
    };
  }, []);

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? inputRef.current).trim();
      if (!content || streamingRef.current) return;

      setError(null);

      // Add user message
      memoryRef.current.addUserMessage(content);
      setMessages([...memoryRef.current.getMessages()]);
      if (!text) setInput('');

      setIsStreaming(true);

      try {
        const allMessages = memoryRef.current.getAllMessages();

        // Use a temporary message for streaming display
        let accumulatedText = '';
        const { promise, stop } = streamMessage(allMessages, (event) => {
          if (!mountedRef.current) return;
          accumulatedText = event.accumulatedText;
          // Update messages with streaming assistant response
          const currentMessages = memoryRef.current.getMessages();
          setMessages([
            ...currentMessages,
            { role: 'assistant' as const, content: accumulatedText },
          ]);
        });

        stopRef.current = stop;
        const response = await promise;

        if (!mountedRef.current) return;

        // Add the final assistant message to memory
        memoryRef.current.addAssistantMessage(response.text);
        setMessages([...memoryRef.current.getMessages()]);
        onFinishRef.current?.(response);
      } catch (err) {
        if (!mountedRef.current) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onErrorRef.current?.(e);
      } finally {
        stopRef.current = null;
        if (mountedRef.current) {
          setIsStreaming(false);
        }
      }
    },
    []
  );

  const stop = useCallback(() => {
    stopRef.current?.();
  }, []);

  const clear = useCallback(() => {
    memoryRef.current.clear();
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    input,
    setInput,
    sendMessage: send,
    isStreaming,
    stop,
    clear,
    error,
  };
}

/**
 * React hook for single-shot AI completions.
 *
 * Unlike useChat (which manages a conversation), useCompletion is for
 * one-off tasks like summarization, translation, or content generation.
 *
 * @param options - Configuration options
 * @returns Completion state and control functions
 *
 * @example
 * ```tsx
 * function SummarizerScreen() {
 *   const { completion, isLoading, complete, stop } = useCompletion({
 *     systemPrompt: 'You are a summarization assistant. Summarize the given text concisely.',
 *   });
 *
 *   return (
 *     <View>
 *       <Button
 *         title="Summarize"
 *         onPress={() => complete('Long article text here...')}
 *       />
 *       {isLoading && <Button title="Stop" onPress={stop} />}
 *       <Text>{completion}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useCompletion(options: UseCompletionOptions = {}): UseCompletionReturn {
  const { systemPrompt, onFinish, onError } = options;

  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const loadingRef = useRef(isLoading);
  loadingRef.current = isLoading;
  const completionRef = useRef(completion);
  completionRef.current = completion;
  const systemPromptRef = useRef(systemPrompt);
  systemPromptRef.current = systemPrompt;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopRef.current?.();
    };
  }, []);

  const complete = useCallback(
    async (prompt: string) => {
      if (loadingRef.current) return completionRef.current;

      setError(null);
      setCompletion('');
      setIsLoading(true);

      try {
        const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
        const { promise, stop } = streamMessage(
          messages,
          (event) => {
            if (!mountedRef.current) return;
            setCompletion(event.accumulatedText);
          },
          systemPromptRef.current ? { systemPrompt: systemPromptRef.current } : undefined
        );

        stopRef.current = stop;
        const response = await promise;

        if (!mountedRef.current) return '';

        setCompletion(response.text);
        onFinishRef.current?.(response);
        return response.text;
      } catch (err) {
        if (!mountedRef.current) return '';
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onErrorRef.current?.(e);
        return '';
      } finally {
        stopRef.current = null;
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  const stop = useCallback(() => {
    stopRef.current?.();
  }, []);

  return {
    completion,
    isLoading,
    complete,
    stop,
    error,
  };
}

/**
 * React hook for managing a downloadable model's lifecycle.
 *
 * Tracks download status, progress, and provides download/delete controls.
 *
 * @param modelId - The downloadable model ID (e.g. 'gemma-e2b')
 * @returns Model status, progress, and control functions
 *
 * @example
 * ```tsx
 * function ModelManager() {
 *   const { status, progress, download, delete: remove, error } = useModel('gemma-e2b');
 *
 *   if (status === 'not-downloaded') {
 *     return <Button title="Download" onPress={download} />;
 *   }
 *   if (status === 'downloading') {
 *     return <Text>Downloading: {Math.round(progress * 100)}%</Text>;
 *   }
 *   if (status === 'loading') {
 *     return <Text>Loading model...</Text>;
 *   }
 *   return <Text>Model ready!</Text>;
 * }
 * ```
 */
export function useModel(modelId: string): {
  status: DownloadableModelStatus;
  progress: number;
  download: () => Promise<void>;
  delete: () => Promise<void>;
  error: ModelError | null;
} {
  const [status, setStatus] = useState<DownloadableModelStatus>('not-downloaded');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<ModelError | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Query initial status
    try {
      const initialStatus = ExpoAiKitModule.getDownloadableModelStatus(modelId);
      setStatus(initialStatus);
    } catch {
      // Model not found or native module not ready
    }

    // Listen for state changes
    const stateSubscription = ExpoAiKitModule.addListener(
      'onModelStateChange',
      (event) => {
        if (event.modelId === modelId && mountedRef.current) {
          setStatus(event.status);
        }
      }
    );

    // Listen for download progress
    const progressSubscription = ExpoAiKitModule.addListener(
      'onDownloadProgress',
      (event) => {
        if (event.modelId === modelId && mountedRef.current) {
          setProgress(event.progress);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      stateSubscription.remove();
      progressSubscription.remove();
    };
  }, [modelId]);

  const download = useCallback(async () => {
    setError(null);
    setProgress(0);
    try {
      await downloadModelApi(modelId, {
        onProgress: (p) => {
          if (mountedRef.current) setProgress(p);
        },
      });
    } catch (err) {
      if (mountedRef.current) {
        setError(err as ModelError);
      }
    }
  }, [modelId]);

  const del = useCallback(async () => {
    setError(null);
    try {
      await deleteModelApi(modelId);
      if (mountedRef.current) {
        setStatus('not-downloaded');
        setProgress(0);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as ModelError);
      }
    }
  }, [modelId]);

  return { status, progress, download, delete: del, error };
}

/**
 * React hook to discover all available models (built-in and downloadable).
 *
 * @returns Built-in models, downloadable models, and loading state
 *
 * @example
 * ```tsx
 * function ModelPicker() {
 *   const { builtIn, downloadable, isLoading } = useAvailableModels();
 *
 *   if (isLoading) return <Text>Loading models...</Text>;
 *
 *   return (
 *     <View>
 *       <Text>Built-in: {builtIn.map(m => m.name).join(', ')}</Text>
 *       <Text>Downloadable: {downloadable.map(m => m.name).join(', ')}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useAvailableModels(): {
  builtIn: BuiltInModel[];
  downloadable: DownloadableModel[];
  isLoading: boolean;
} {
  const [builtIn, setBuiltIn] = useState<BuiltInModel[]>([]);
  const [downloadable, setDownloadable] = useState<DownloadableModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([getBuiltInModelsApi(), getDownloadableModelsApi()]).then(
      ([bi, dl]) => {
        if (mounted) {
          setBuiltIn(bi);
          setDownloadable(dl);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
    };
  }, []);

  return { builtIn, downloadable, isLoading };
}
