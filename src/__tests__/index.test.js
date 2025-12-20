// Mock Platform before importing anything
let mockPlatformOS = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

// Mock the native module
jest.mock('../ExpoAiKitModule', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(() => true),
    sendMessage: jest.fn(() => Promise.resolve({ text: 'Mock response' })),
  },
}));

const { isAvailable, sendMessage } = require('../index');
const NativeModule = require('../ExpoAiKitModule').default;

describe('expo-ai-kit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOS = 'ios';
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
});
