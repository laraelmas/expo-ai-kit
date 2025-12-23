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

const { isAvailable, sendMessage, streamMessage } = require('../index');
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
});
