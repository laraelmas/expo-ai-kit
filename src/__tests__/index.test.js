// Mock Platform before importing anything
let mockPlatformOS = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

// Store event listeners for testing - must be prefixed with 'mock' for jest
let mockEventListeners = {};

// Mock the native module
jest.mock('../ExpoAiKitModule', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(() => true),
    sendMessage: jest.fn(() => Promise.resolve({ text: 'Mock response' })),
    startStreaming: jest.fn(() => Promise.resolve()),
    stopStreaming: jest.fn(() => Promise.resolve()),
    addListener: jest.fn((eventName, callback) => {
      if (!mockEventListeners[eventName]) {
        mockEventListeners[eventName] = [];
      }
      mockEventListeners[eventName].push(callback);
      return {
        remove: () => {
          mockEventListeners[eventName] = mockEventListeners[eventName].filter(
            (cb) => cb !== callback
          );
        },
      };
    }),
  },
}));

// Helper to simulate native events
const simulateStreamEvent = (event) => {
  const listeners = mockEventListeners['onStreamToken'] || [];
  listeners.forEach((cb) => cb(event));
};

const {
  isAvailable,
  sendMessage,
  streamMessage,
  summarize,
  streamSummarize,
  translate,
  streamTranslate,
  rewrite,
  streamRewrite,
  extractKeyPoints,
  streamExtractKeyPoints,
  answerQuestion,
  streamAnswerQuestion,
} = require('../index');
const NativeModule = require('../ExpoAiKitModule').default;

describe('expo-ai-kit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOS = 'ios';
    mockEventListeners = {};
  });

  describe('isAvailable', () => {
    it('returns native module result on iOS', async () => {
      const result = await isAvailable();
      expect(result).toBe(true);
      expect(NativeModule.isAvailable).toHaveBeenCalled();
    });

    it('returns native module result on Android', async () => {
      mockPlatformOS = 'android';
      const result = await isAvailable();
      expect(result).toBe(true);
      expect(NativeModule.isAvailable).toHaveBeenCalled();
    });

    it('returns false on web', async () => {
      mockPlatformOS = 'web';
      const result = await isAvailable();
      expect(result).toBe(false);
      expect(NativeModule.isAvailable).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('throws error for empty messages array', async () => {
      await expect(sendMessage([])).rejects.toThrow(
        'messages array cannot be empty'
      );
    });

    it('calls native module with messages and default system prompt', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];

      const result = await sendMessage(messages);

      expect(result).toEqual({ text: 'Mock response' });
      expect(NativeModule.sendMessage).toHaveBeenCalledWith(
        messages,
        'You are a helpful, friendly assistant. Answer the user directly and concisely.'
      );
    });

    it('uses custom system prompt from options', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];

      await sendMessage(messages, { systemPrompt: 'You are a pirate.' });

      expect(NativeModule.sendMessage).toHaveBeenCalledWith(
        messages,
        'You are a pirate.'
      );
    });

    it('passes empty string for system prompt when messages contain system message', async () => {
      const messages = [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Hello' },
      ];

      await sendMessage(messages, { systemPrompt: 'This should be ignored' });

      expect(NativeModule.sendMessage).toHaveBeenCalledWith(
        messages,
        '' // Empty because system message exists in array
      );
    });

    it('returns empty response on unsupported platforms', async () => {
      mockPlatformOS = 'web';

      const result = await sendMessage([{ role: 'user', content: 'Hi' }]);

      expect(result).toEqual({ text: '' });
      expect(NativeModule.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('message validation', () => {
    it('accepts valid user message', async () => {
      await expect(
        sendMessage([{ role: 'user', content: 'Test' }])
      ).resolves.not.toThrow();
    });

    it('accepts valid multi-turn conversation', async () => {
      await expect(
        sendMessage([
          { role: 'system', content: 'Be helpful.' },
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
          { role: 'user', content: 'How are you?' },
        ])
      ).resolves.not.toThrow();
    });
  });

  describe('streamMessage', () => {
    it('returns promise and stop function', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const onToken = jest.fn();

      const result = streamMessage(messages, onToken);

      expect(result).toHaveProperty('promise');
      expect(result).toHaveProperty('stop');
      expect(typeof result.stop).toBe('function');
    });

    it('calls native startStreaming with correct arguments', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const onToken = jest.fn();

      streamMessage(messages, onToken);

      expect(NativeModule.startStreaming).toHaveBeenCalledWith(
        messages,
        'You are a helpful, friendly assistant. Answer the user directly and concisely.',
        expect.stringMatching(/^stream_\d+_\d+$/)
      );
    });

    it('uses custom system prompt from options', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const onToken = jest.fn();

      streamMessage(messages, onToken, { systemPrompt: 'Be a pirate.' });

      expect(NativeModule.startStreaming).toHaveBeenCalledWith(
        messages,
        'Be a pirate.',
        expect.any(String)
      );
    });

    it('passes empty string when messages contain system message', () => {
      const messages = [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Hello' },
      ];
      const onToken = jest.fn();

      streamMessage(messages, onToken, { systemPrompt: 'This should be ignored' });

      expect(NativeModule.startStreaming).toHaveBeenCalledWith(
        messages,
        '',
        expect.any(String)
      );
    });

    it('calls onToken callback for each stream event', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const onToken = jest.fn();

      const { promise } = streamMessage(messages, onToken);

      // Get the sessionId that was used
      const sessionId = NativeModule.startStreaming.mock.calls[0][2];

      // Simulate streaming events
      simulateStreamEvent({
        sessionId,
        token: 'Hello',
        accumulatedText: 'Hello',
        isDone: false,
      });

      simulateStreamEvent({
        sessionId,
        token: ' world',
        accumulatedText: 'Hello world',
        isDone: false,
      });

      simulateStreamEvent({
        sessionId,
        token: '',
        accumulatedText: 'Hello world',
        isDone: true,
      });

      const result = await promise;

      expect(onToken).toHaveBeenCalledTimes(3);
      expect(onToken).toHaveBeenNthCalledWith(1, {
        sessionId,
        token: 'Hello',
        accumulatedText: 'Hello',
        isDone: false,
      });
      expect(result).toEqual({ text: 'Hello world' });
    });

    it('ignores events from other sessions', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const onToken = jest.fn();

      streamMessage(messages, onToken);

      // Simulate event from different session
      simulateStreamEvent({
        sessionId: 'other_session',
        token: 'Other',
        accumulatedText: 'Other',
        isDone: false,
      });

      expect(onToken).not.toHaveBeenCalled();
    });

    it('calls stopStreaming when stop() is called', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const onToken = jest.fn();

      const { stop } = streamMessage(messages, onToken);
      const sessionId = NativeModule.startStreaming.mock.calls[0][2];

      stop();

      expect(NativeModule.stopStreaming).toHaveBeenCalledWith(sessionId);
    });

    it('returns empty response on unsupported platforms', () => {
      mockPlatformOS = 'web';

      const messages = [{ role: 'user', content: 'Hello' }];
      const onToken = jest.fn();

      const { promise, stop } = streamMessage(messages, onToken);

      expect(NativeModule.startStreaming).not.toHaveBeenCalled();
      expect(promise).resolves.toEqual({ text: '' });
      expect(stop).toBeDefined();
    });

    it('rejects promise for empty messages array', () => {
      const onToken = jest.fn();

      const { promise } = streamMessage([], onToken);

      expect(promise).rejects.toThrow('messages array cannot be empty');
    });
  });

  // ============================================================================
  // Prompt Helper Tests
  // ============================================================================

  describe('summarize', () => {
    it('throws error for empty text', async () => {
      await expect(summarize('')).rejects.toThrow('text cannot be empty');
      await expect(summarize('   ')).rejects.toThrow('text cannot be empty');
    });

    it('calls sendMessage with summarization system prompt', async () => {
      await summarize('Some long text to summarize');

      expect(NativeModule.sendMessage).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Some long text to summarize' }],
        expect.stringContaining('summarization assistant')
      );
    });

    it('uses default options (medium length, paragraph style)', async () => {
      await summarize('Text');

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('3-5 sentences');
      expect(systemPrompt).toContain('flowing paragraph');
    });

    it('respects length option', async () => {
      await summarize('Text', { length: 'short' });

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('1-2 sentences');
    });

    it('respects style option', async () => {
      await summarize('Text', { style: 'bullets' });

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('bullet points');
    });

    it('returns empty response on unsupported platforms', async () => {
      mockPlatformOS = 'web';

      const result = await summarize('Text');

      expect(result).toEqual({ text: '' });
      expect(NativeModule.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('streamSummarize', () => {
    it('returns promise and stop function', () => {
      const onToken = jest.fn();
      const result = streamSummarize('Text', onToken);

      expect(result).toHaveProperty('promise');
      expect(result).toHaveProperty('stop');
    });

    it('rejects for empty text', () => {
      const onToken = jest.fn();
      const { promise } = streamSummarize('', onToken);

      expect(promise).rejects.toThrow('text cannot be empty');
    });

    it('calls native startStreaming with summarization prompt', () => {
      const onToken = jest.fn();
      streamSummarize('Text', onToken, { style: 'tldr' });

      const systemPrompt = NativeModule.startStreaming.mock.calls[0][1];
      expect(systemPrompt).toContain('TL;DR');
    });
  });

  describe('translate', () => {
    it('throws error for empty text', async () => {
      await expect(translate('', { to: 'Spanish' })).rejects.toThrow(
        'text cannot be empty'
      );
    });

    it('calls sendMessage with translation system prompt', async () => {
      await translate('Hello', { to: 'Spanish' });

      expect(NativeModule.sendMessage).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Hello' }],
        expect.stringContaining('translation assistant')
      );
    });

    it('includes target language in prompt', async () => {
      await translate('Hello', { to: 'Japanese' });

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('to Japanese');
    });

    it('includes source language when provided', async () => {
      await translate('Hello', { to: 'Spanish', from: 'English' });

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('from English');
    });

    it('respects tone option', async () => {
      await translate('Hello', { to: 'Spanish', tone: 'formal' });

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('formal language');
    });

    it('returns empty response on unsupported platforms', async () => {
      mockPlatformOS = 'web';

      const result = await translate('Hello', { to: 'Spanish' });

      expect(result).toEqual({ text: '' });
    });
  });

  describe('streamTranslate', () => {
    it('returns promise and stop function', () => {
      const onToken = jest.fn();
      const result = streamTranslate('Hello', onToken, { to: 'Spanish' });

      expect(result).toHaveProperty('promise');
      expect(result).toHaveProperty('stop');
    });

    it('rejects for empty text', () => {
      const onToken = jest.fn();
      const { promise } = streamTranslate('', onToken, { to: 'Spanish' });

      expect(promise).rejects.toThrow('text cannot be empty');
    });
  });

  describe('rewrite', () => {
    it('throws error for empty text', async () => {
      await expect(rewrite('', { style: 'formal' })).rejects.toThrow(
        'text cannot be empty'
      );
    });

    it('calls sendMessage with rewrite system prompt', async () => {
      await rewrite('hey whats up', { style: 'formal' });

      expect(NativeModule.sendMessage).toHaveBeenCalledWith(
        [{ role: 'user', content: 'hey whats up' }],
        expect.stringContaining('writing assistant')
      );
    });

    it('includes style instruction in prompt', async () => {
      await rewrite('Text', { style: 'academic' });

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('academic');
    });

    it('returns empty response on unsupported platforms', async () => {
      mockPlatformOS = 'web';

      const result = await rewrite('Text', { style: 'formal' });

      expect(result).toEqual({ text: '' });
    });
  });

  describe('streamRewrite', () => {
    it('returns promise and stop function', () => {
      const onToken = jest.fn();
      const result = streamRewrite('Text', onToken, { style: 'formal' });

      expect(result).toHaveProperty('promise');
      expect(result).toHaveProperty('stop');
    });

    it('rejects for empty text', () => {
      const onToken = jest.fn();
      const { promise } = streamRewrite('', onToken, { style: 'formal' });

      expect(promise).rejects.toThrow('text cannot be empty');
    });
  });

  describe('extractKeyPoints', () => {
    it('throws error for empty text', async () => {
      await expect(extractKeyPoints('')).rejects.toThrow('text cannot be empty');
    });

    it('calls sendMessage with extraction system prompt', async () => {
      await extractKeyPoints('Some article text');

      expect(NativeModule.sendMessage).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Some article text' }],
        expect.stringContaining('analysis assistant')
      );
    });

    it('uses default maxPoints of 5', async () => {
      await extractKeyPoints('Text');

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('5 most important');
    });

    it('respects maxPoints option', async () => {
      await extractKeyPoints('Text', { maxPoints: 3 });

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('3 most important');
    });

    it('returns empty response on unsupported platforms', async () => {
      mockPlatformOS = 'web';

      const result = await extractKeyPoints('Text');

      expect(result).toEqual({ text: '' });
    });
  });

  describe('streamExtractKeyPoints', () => {
    it('returns promise and stop function', () => {
      const onToken = jest.fn();
      const result = streamExtractKeyPoints('Text', onToken);

      expect(result).toHaveProperty('promise');
      expect(result).toHaveProperty('stop');
    });

    it('rejects for empty text', () => {
      const onToken = jest.fn();
      const { promise } = streamExtractKeyPoints('', onToken);

      expect(promise).rejects.toThrow('text cannot be empty');
    });
  });

  describe('answerQuestion', () => {
    it('throws error for empty question', async () => {
      await expect(answerQuestion('', 'Some context')).rejects.toThrow(
        'question cannot be empty'
      );
    });

    it('throws error for empty context', async () => {
      await expect(answerQuestion('What is it?', '')).rejects.toThrow(
        'context cannot be empty'
      );
    });

    it('calls sendMessage with QA system prompt', async () => {
      await answerQuestion('What is the topic?', 'The topic is AI.');

      expect(NativeModule.sendMessage).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('Context:') }],
        expect.stringContaining('question-answering assistant')
      );
    });

    it('includes question and context in user message', async () => {
      await answerQuestion('What is X?', 'X is a variable.');

      const userMessage = NativeModule.sendMessage.mock.calls[0][0][0].content;
      expect(userMessage).toContain('Context:\nX is a variable.');
      expect(userMessage).toContain('Question: What is X?');
    });

    it('uses default detail level of medium', async () => {
      await answerQuestion('Q?', 'Context');

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('clear answer with some explanation');
    });

    it('respects detail option', async () => {
      await answerQuestion('Q?', 'Context', { detail: 'brief' });

      const systemPrompt = NativeModule.sendMessage.mock.calls[0][1];
      expect(systemPrompt).toContain('brief, direct answer');
    });

    it('returns empty response on unsupported platforms', async () => {
      mockPlatformOS = 'web';

      const result = await answerQuestion('Q?', 'Context');

      expect(result).toEqual({ text: '' });
    });
  });

  describe('streamAnswerQuestion', () => {
    it('returns promise and stop function', () => {
      const onToken = jest.fn();
      const result = streamAnswerQuestion('Q?', 'Context', onToken);

      expect(result).toHaveProperty('promise');
      expect(result).toHaveProperty('stop');
    });

    it('rejects for empty question', () => {
      const onToken = jest.fn();
      const { promise } = streamAnswerQuestion('', 'Context', onToken);

      expect(promise).rejects.toThrow('question cannot be empty');
    });

    it('rejects for empty context', () => {
      const onToken = jest.fn();
      const { promise } = streamAnswerQuestion('Q?', '', onToken);

      expect(promise).rejects.toThrow('context cannot be empty');
    });
  });
});
