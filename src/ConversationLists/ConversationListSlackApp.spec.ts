/**
 * Unit tests for ConversationListSlackApp
 *
 * This test suite comprehensively tests the ConversationListSlackApp class which provides
 * specialized functionality for managing Slack app text conversations.
 *
 * Key functionality tested:
 * - Text message envelope handling
 * - Text message creation from components
 * - Slack-specific role-based methods (user, bot, admin)
 * - Message filtering by author role
 * - Conversation statistics and utilities
 * - Integration with base AbstractConversationMessageList functionality
 * - Edge cases and error scenarios
 *
 * Test coverage includes:
 * - Constructor and inheritance verification
 * - addTextMessageEnvelope() - Direct envelope addition
 * - addMessage() - Primary method for creating text messages
 * - addUserMessage() / addBotMessage() - Convenience methods
 * - Role-based filtering and retrieval methods
 * - Conversation utility methods
 * - Data integrity and type safety verification
 */

import { ConversationListSlackApp } from './ConversationListSlackApp';
import { AbstractConversationMessageList } from './AbstractConversationMessageList';
import type {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  TConversationMessageContentString,
} from './types';

// Mock UUID to have predictable test values
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

// Helper function to create test text message envelope
function createTestTextMessageEnvelope(
  messageId: string = 'test-msg-id',
  authorRole: string = 'user',
  textContent: string = 'Hello, this is a test message',
  estimatedTokenCount: number = 7,
): TConversationTextMessageEnvelope {
  const textPayload: TConversationMessageContentString = {
    type: 'text/plain',
    payload: textContent,
  };

  const textMessage: TConversationTextMessage = {
    messageId,
    author_role: authorRole,
    content: textPayload,
    created_at: new Date().toISOString(),
    estimated_token_count: estimatedTokenCount,
  };

  return {
    messageId,
    requestOrResponse: 'request',
    envelopePayload: textMessage,
  };
}

describe('ConversationListSlackApp', () => {
  let slackApp: ConversationListSlackApp;
  let mockDateNow: jest.SpyInstance;

  beforeEach(() => {
    slackApp = new ConversationListSlackApp();
    // Mock Date.now() to have predictable timestamps
    mockDateNow = jest.spyOn(Date, 'now');
  });

  afterEach(() => {
    mockDateNow.mockRestore();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance successfully', () => {
      expect(slackApp).toBeDefined();
      expect(slackApp).toBeInstanceOf(ConversationListSlackApp);
      expect(slackApp).toBeInstanceOf(AbstractConversationMessageList);
    });

    it('should initialize with empty conversation', () => {
      const messages = slackApp.getLatestMessages();
      expect(messages).toEqual([]);
      expect(slackApp.getMessageCount()).toBe(0);
      expect(slackApp.hasMessages()).toBe(false);
    });
  });

  describe('addTextMessageEnvelope', () => {
    it('should add a text message envelope and return unique ID', () => {
      const testEnvelope = createTestTextMessageEnvelope();
      mockDateNow.mockReturnValue(1000);

      const envelopeId = slackApp.addTextMessageEnvelope(testEnvelope);

      expect(envelopeId).toBeDefined();
      expect(typeof envelopeId).toBe('string');
      expect(envelopeId).toMatch(/^mocked-uuid-/);
      expect(slackApp.getMessageCount()).toBe(1);
    });

    it('should store the text envelope with correct metadata', () => {
      const testEnvelope = createTestTextMessageEnvelope(
        'slack-msg-1',
        'bot',
        'Welcome to our Slack app!',
        12,
      );
      const timestamp = 1234567890;
      mockDateNow.mockReturnValue(timestamp);

      const envelopeId = slackApp.addTextMessageEnvelope(testEnvelope);
      const storedEnvelope = slackApp.getMessageEnvelopeById(envelopeId);

      expect(storedEnvelope).toBeDefined();
      expect(storedEnvelope!.envelopeId).toBe(envelopeId);
      expect(storedEnvelope!.addedAtMs).toBe(timestamp);
      expect(storedEnvelope!.envelope).toEqual(testEnvelope);
      expect(storedEnvelope!.envelope.envelopePayload.author_role).toBe('bot');
      expect(storedEnvelope!.envelope.envelopePayload.content.type).toBe(
        'text/plain',
      );
      expect(storedEnvelope!.envelope.envelopePayload.content.payload).toBe(
        'Welcome to our Slack app!',
      );
    });

    it('should handle multiple text envelopes', () => {
      const envelope1 = createTestTextMessageEnvelope(
        'msg-1',
        'user',
        'First message',
      );
      const envelope2 = createTestTextMessageEnvelope(
        'msg-2',
        'bot',
        'Bot response',
      );

      mockDateNow.mockReturnValueOnce(1000);
      const id1 = slackApp.addTextMessageEnvelope(envelope1);

      mockDateNow.mockReturnValueOnce(2000);
      const id2 = slackApp.addTextMessageEnvelope(envelope2);

      expect(id1).not.toBe(id2);
      expect(slackApp.getMessageCount()).toBe(2);

      const stored1 = slackApp.getMessageEnvelopeById(id1);
      const stored2 = slackApp.getMessageEnvelopeById(id2);

      expect(stored1!.addedAtMs).toBe(1000);
      expect(stored2!.addedAtMs).toBe(2000);
      expect(stored1!.envelope.envelopePayload.content.payload).toBe(
        'First message',
      );
      expect(stored2!.envelope.envelopePayload.content.payload).toBe(
        'Bot response',
      );
    });
  });

  describe('addMessage', () => {
    it('should create and add a message with all parameters', () => {
      const messageId = 'slack-ts-1234567890';
      const authorRole = 'admin';
      const textContent = 'This is an admin announcement!';
      const estimatedTokenCount = 15;

      mockDateNow.mockReturnValue(5000);

      const envelopeId = slackApp.addMessage(
        messageId,
        authorRole,
        textContent,
        estimatedTokenCount,
      );

      expect(envelopeId).toBeDefined();
      expect(slackApp.getMessageCount()).toBe(1);

      const stored = slackApp.getMessageEnvelopeById(envelopeId);
      expect(stored).toBeDefined();

      const message = stored!.envelope.envelopePayload;
      expect(message.messageId).toBe(messageId);
      expect(message.author_role).toBe(authorRole);
      expect(message.content.payload).toBe(textContent);
      expect(message.estimated_token_count).toBe(estimatedTokenCount);
      expect(message.content.type).toBe('text/plain');
    });

    it('should use default token estimation when not provided', () => {
      const testText = 'This message has exactly 32 chars!!';
      const expectedTokens = Math.ceil(testText.length / 4); // 8

      const envelopeId = slackApp.addMessage(
        'token-default-test',
        'user',
        testText,
      );

      const stored = slackApp.getMessageEnvelopeById(envelopeId);
      expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(
        expectedTokens,
      );
    });

    it('should generate valid timestamps', () => {
      const fixedTime = 1751270681000; // Fixed timestamp
      mockDateNow.mockReturnValue(fixedTime);

      const envelopeId = slackApp.addMessage(
        'timestamp-test',
        'user',
        'Test message',
      );

      const stored = slackApp.getMessageEnvelopeById(envelopeId);
      const messageTime = new Date(stored!.envelope.envelopePayload.created_at);

      expect(messageTime.getTime()).toBe(fixedTime);
    });

    it('should handle empty text content', () => {
      const envelopeId = slackApp.addMessage('empty-msg', 'user', '');

      const stored = slackApp.getMessageEnvelopeById(envelopeId);
      expect(stored!.envelope.envelopePayload.content.payload).toBe('');
      expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(0);
    });
  });

  describe('addUserMessage', () => {
    it('should create user message with default role', () => {
      const messageId = 'user-msg-1';
      const text = 'Hello from user!';

      const envelopeId = slackApp.addUserMessage(messageId, text);
      const stored = slackApp.getMessageEnvelopeById(envelopeId);

      expect(stored!.envelope.envelopePayload.author_role).toBe('user');
      expect(stored!.envelope.envelopePayload.content.payload).toBe(text);
      expect(stored!.envelope.envelopePayload.messageId).toBe(messageId);
    });

    it('should accept optional token count override', () => {
      const customTokenCount = 25;
      const envelopeId = slackApp.addUserMessage(
        'user-tokens',
        'Custom token count',
        customTokenCount,
      );

      const stored = slackApp.getMessageEnvelopeById(envelopeId);
      expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(
        customTokenCount,
      );
    });
  });

  describe('addBotMessage', () => {
    it('should create bot message with default role', () => {
      const messageId = 'bot-msg-1';
      const text = 'Hello from bot!';

      const envelopeId = slackApp.addBotMessage(messageId, text);
      const stored = slackApp.getMessageEnvelopeById(envelopeId);

      expect(stored!.envelope.envelopePayload.author_role).toBe('bot');
      expect(stored!.envelope.envelopePayload.content.payload).toBe(text);
      expect(stored!.envelope.envelopePayload.messageId).toBe(messageId);
    });

    it('should accept optional token count override', () => {
      const customTokenCount = 40;
      const envelopeId = slackApp.addBotMessage(
        'bot-tokens',
        'Bot response with custom tokens',
        customTokenCount,
      );

      const stored = slackApp.getMessageEnvelopeById(envelopeId);
      expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(
        customTokenCount,
      );
    });
  });

  describe('getLatestMessages', () => {
    it('should return empty array when no messages exist', () => {
      const result = slackApp.getLatestMessages();
      expect(result).toEqual([]);
    });

    it('should return messages in reverse chronological order', () => {
      // Add messages with specific timestamps (each call to addMessage uses Date.now() twice)
      mockDateNow
        .mockReturnValueOnce(1000) // for created_at
        .mockReturnValueOnce(1000); // for addedAtMs
      const id1 = slackApp.addMessage('msg-1', 'user', 'First message');

      mockDateNow
        .mockReturnValueOnce(3000) // for created_at
        .mockReturnValueOnce(3000); // for addedAtMs
      const id2 = slackApp.addMessage('msg-2', 'bot', 'Second message');

      mockDateNow
        .mockReturnValueOnce(2000) // for created_at
        .mockReturnValueOnce(2000); // for addedAtMs
      const id3 = slackApp.addMessage('msg-3', 'admin', 'Third message');

      const results = slackApp.getLatestMessages();

      expect(results).toHaveLength(3);
      expect(results[0].envelopeId).toBe(id2); // Most recent (3000ms)
      expect(results[1].envelopeId).toBe(id3); // Middle (2000ms)
      expect(results[2].envelopeId).toBe(id1); // Oldest (1000ms)
    });

    it('should return all messages regardless of author role', () => {
      slackApp.addUserMessage('user-1', 'User message');
      slackApp.addBotMessage('bot-1', 'Bot message');
      slackApp.addMessage('admin-1', 'admin', 'Admin message');

      const results = slackApp.getLatestMessages();
      expect(results).toHaveLength(3);

      const roles = results.map((r) => r.envelope.envelopePayload.author_role);
      expect(roles).toContain('user');
      expect(roles).toContain('bot');
      expect(roles).toContain('admin');
    });
  });

  describe('getFirstMessage', () => {
    it('should return undefined when no messages exist', () => {
      const result = slackApp.getFirstMessage();
      expect(result).toBeUndefined();
    });

    it('should return the single message when only one exists', () => {
      const envelope = createTestTextMessageEnvelope('only-msg');
      mockDateNow.mockReturnValue(1000);

      const envelopeId = slackApp.addTextMessageEnvelope(envelope);
      const result = slackApp.getFirstMessage();

      expect(result).toBeDefined();
      expect(result!.envelopeId).toBe(envelopeId);
      expect(result!.addedAtMs).toBe(1000);
    });

    it('should return the earliest added message when multiple exist', () => {
      // Add messages with non-sequential timestamps
      mockDateNow
        .mockReturnValueOnce(3000) // for created_at
        .mockReturnValueOnce(3000); // for addedAtMs
      const id1 = slackApp.addMessage('msg-1', 'user', 'first');

      mockDateNow
        .mockReturnValueOnce(1000) // for created_at
        .mockReturnValueOnce(1000); // for addedAtMs
      const id2 = slackApp.addMessage('msg-2', 'bot', 'second');

      mockDateNow
        .mockReturnValueOnce(2000) // for created_at
        .mockReturnValueOnce(2000); // for addedAtMs
      const id3 = slackApp.addMessage('msg-3', 'admin', 'third');

      const result = slackApp.getFirstMessage();

      expect(result).toBeDefined();
      expect(result!.envelopeId).toBe(id2); // Should be the one with timestamp 1000
      expect(result!.addedAtMs).toBe(1000);
      expect(result!.envelope.envelopePayload.content.payload).toBe('second');
    });
  });

  describe('getMessagesByAuthorRole', () => {
    beforeEach(() => {
      // Set up test messages with different roles
      slackApp.addMessage('msg-1', 'user', 'User message 1');
      slackApp.addMessage('msg-2', 'bot', 'Bot message 1');
      slackApp.addMessage('msg-3', 'user', 'User message 2');
      slackApp.addMessage('msg-4', 'admin', 'Admin message 1');
      slackApp.addMessage('msg-5', 'bot', 'Bot message 2');
    });

    it('should return empty array for non-existent role', () => {
      const result = slackApp.getMessagesByAuthorRole('nonexistent');
      expect(result).toEqual([]);
    });

    it('should return only user messages', () => {
      const userMessages = slackApp.getMessagesByAuthorRole('user');
      expect(userMessages).toHaveLength(2);

      userMessages.forEach((container) => {
        expect(container.envelope.envelopePayload.author_role).toBe('user');
      });

      const contents = userMessages.map(
        (c) => c.envelope.envelopePayload.content.payload,
      );
      expect(contents).toContain('User message 1');
      expect(contents).toContain('User message 2');
    });

    it('should return only bot messages', () => {
      const botMessages = slackApp.getMessagesByAuthorRole('bot');
      expect(botMessages).toHaveLength(2);

      botMessages.forEach((container) => {
        expect(container.envelope.envelopePayload.author_role).toBe('bot');
      });

      const contents = botMessages.map(
        (c) => c.envelope.envelopePayload.content.payload,
      );
      expect(contents).toContain('Bot message 1');
      expect(contents).toContain('Bot message 2');
    });

    it('should return only admin messages', () => {
      const adminMessages = slackApp.getMessagesByAuthorRole('admin');
      expect(adminMessages).toHaveLength(1);

      expect(adminMessages[0].envelope.envelopePayload.author_role).toBe(
        'admin',
      );
      expect(adminMessages[0].envelope.envelopePayload.content.payload).toBe(
        'Admin message 1',
      );
    });

    it('should return messages in chronological order (most recent first)', () => {
      // Add more user messages with specific timestamps
      mockDateNow
        .mockReturnValueOnce(1000) // for created_at
        .mockReturnValueOnce(1000); // for addedAtMs
      slackApp.addMessage('user-early', 'user', 'Early user message');

      mockDateNow
        .mockReturnValueOnce(3000) // for created_at
        .mockReturnValueOnce(3000); // for addedAtMs
      slackApp.addMessage('user-late', 'user', 'Late user message');

      const userMessages = slackApp.getMessagesByAuthorRole('user');

      // Should have at least 2 messages (the ones we just added)
      expect(userMessages.length).toBeGreaterThanOrEqual(2);

      // Find our specific test messages
      const earlyMessage = userMessages.find(
        (m) =>
          m.envelope.envelopePayload.content.payload === 'Early user message',
      );
      const lateMessage = userMessages.find(
        (m) =>
          m.envelope.envelopePayload.content.payload === 'Late user message',
      );

      expect(earlyMessage).toBeDefined();
      expect(lateMessage).toBeDefined();

      // Late message should come before early message in the array (reverse chronological)
      const lateIndex = userMessages.indexOf(lateMessage!);
      const earlyIndex = userMessages.indexOf(earlyMessage!);
      expect(lateIndex).toBeLessThan(earlyIndex);
    });
  });

  describe('getUserMessages', () => {
    it('should return empty array when no user messages', () => {
      slackApp.addBotMessage('bot-1', 'Bot only');
      const result = slackApp.getUserMessages();
      expect(result).toEqual([]);
    });

    it('should return only user messages', () => {
      slackApp.addUserMessage('user-1', 'User message 1');
      slackApp.addBotMessage('bot-1', 'Bot message');
      slackApp.addUserMessage('user-2', 'User message 2');

      const userMessages = slackApp.getUserMessages();
      expect(userMessages).toHaveLength(2);

      userMessages.forEach((container) => {
        expect(container.envelope.envelopePayload.author_role).toBe('user');
      });
    });
  });

  describe('getBotMessages', () => {
    it('should return empty array when no bot messages', () => {
      slackApp.addUserMessage('user-1', 'User only');
      const result = slackApp.getBotMessages();
      expect(result).toEqual([]);
    });

    it('should return only bot messages', () => {
      slackApp.addUserMessage('user-1', 'User message');
      slackApp.addBotMessage('bot-1', 'Bot message 1');
      slackApp.addBotMessage('bot-2', 'Bot message 2');

      const botMessages = slackApp.getBotMessages();
      expect(botMessages).toHaveLength(2);

      botMessages.forEach((container) => {
        expect(container.envelope.envelopePayload.author_role).toBe('bot');
      });
    });
  });

  describe('hasMessages', () => {
    it('should return false when no messages exist', () => {
      expect(slackApp.hasMessages()).toBe(false);
    });

    it('should return true when messages exist', () => {
      slackApp.addMessage('msg-1', 'user', 'Hello');
      expect(slackApp.hasMessages()).toBe(true);
    });
  });

  describe('hasMessagesFromRole', () => {
    beforeEach(() => {
      slackApp.addUserMessage('user-1', 'User message');
      slackApp.addMessage('admin-1', 'admin', 'Admin message');
    });

    it('should return false for non-existent role', () => {
      expect(slackApp.hasMessagesFromRole('nonexistent')).toBe(false);
    });

    it('should return true for existing user role', () => {
      expect(slackApp.hasMessagesFromRole('user')).toBe(true);
    });

    it('should return true for existing admin role', () => {
      expect(slackApp.hasMessagesFromRole('admin')).toBe(true);
    });

    it('should return false for bot role when no bot messages', () => {
      expect(slackApp.hasMessagesFromRole('bot')).toBe(false);
    });

    it('should return true for bot role after adding bot message', () => {
      slackApp.addBotMessage('bot-1', 'Bot message');
      expect(slackApp.hasMessagesFromRole('bot')).toBe(true);
    });
  });

  describe('getLatestMessageFromRole', () => {
    it('should return null for non-existent role', () => {
      const result = slackApp.getLatestMessageFromRole('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null when role has no messages', () => {
      slackApp.addUserMessage('user-1', 'User message');
      const result = slackApp.getLatestMessageFromRole('bot');
      expect(result).toBeNull();
    });

    it('should return the most recent message for the role', () => {
      // Add messages with specific timestamps
      mockDateNow
        .mockReturnValueOnce(1000) // for created_at
        .mockReturnValueOnce(1000); // for addedAtMs
      slackApp.addMessage('user-1', 'user', 'First user message');

      mockDateNow
        .mockReturnValueOnce(2000) // for created_at
        .mockReturnValueOnce(2000); // for addedAtMs
      slackApp.addBotMessage('bot-1', 'Bot message');

      mockDateNow
        .mockReturnValueOnce(3000) // for created_at
        .mockReturnValueOnce(3000); // for addedAtMs
      slackApp.addMessage('user-2', 'user', 'Latest user message');

      const latestUserMessage = slackApp.getLatestMessageFromRole('user');
      expect(latestUserMessage).toBeDefined();
      expect(latestUserMessage!.envelope.envelopePayload.content.payload).toBe(
        'Latest user message',
      );
      expect(latestUserMessage!.addedAtMs).toBe(3000);
    });

    it('should return single message when role has only one', () => {
      slackApp.addBotMessage('bot-only', 'Only bot message');

      const result = slackApp.getLatestMessageFromRole('bot');
      expect(result).toBeDefined();
      expect(result!.envelope.envelopePayload.content.payload).toBe(
        'Only bot message',
      );
    });
  });

  describe('getTotalCharacterCount', () => {
    it('should return 0 for empty conversation', () => {
      expect(slackApp.getTotalCharacterCount()).toBe(0);
    });

    it('should return correct count for single message', () => {
      const text = 'Hello, world!'; // 13 characters
      slackApp.addMessage('msg-1', 'user', text);

      expect(slackApp.getTotalCharacterCount()).toBe(13);
    });

    it('should return sum for multiple messages', () => {
      slackApp.addMessage('msg-1', 'user', 'Hi'); // 2 characters
      slackApp.addMessage('msg-2', 'bot', 'Hello there!'); // 12 characters
      slackApp.addMessage('msg-3', 'admin', 'Test'); // 4 characters

      expect(slackApp.getTotalCharacterCount()).toBe(18); // 2 + 12 + 4
    });

    it('should handle empty messages', () => {
      slackApp.addMessage('msg-1', 'user', 'Hello'); // 5 characters
      slackApp.addMessage('msg-2', 'bot', ''); // 0 characters
      slackApp.addMessage('msg-3', 'user', 'World'); // 5 characters

      expect(slackApp.getTotalCharacterCount()).toBe(10); // 5 + 0 + 5
    });
  });

  describe('getTotalEstimatedTokenCount', () => {
    it('should return 0 for empty conversation', () => {
      expect(slackApp.getTotalEstimatedTokenCount()).toBe(0);
    });

    it('should return correct count for single message', () => {
      slackApp.addMessage('msg-1', 'user', 'Test message', 10);

      expect(slackApp.getTotalEstimatedTokenCount()).toBe(10);
    });

    it('should return sum for multiple messages', () => {
      slackApp.addMessage('msg-1', 'user', 'Message 1', 5);
      slackApp.addMessage('msg-2', 'bot', 'Message 2', 8);
      slackApp.addMessage('msg-3', 'admin', 'Message 3', 12);

      expect(slackApp.getTotalEstimatedTokenCount()).toBe(25); // 5 + 8 + 12
    });

    it('should use default token estimation when not specified', () => {
      const text = 'This is exactly 20 c'; // 20 characters, should be 5 tokens (20/4)
      slackApp.addMessage('msg-1', 'user', text);

      expect(slackApp.getTotalEstimatedTokenCount()).toBe(5);
    });

    it('should handle zero token counts', () => {
      slackApp.addMessage('msg-1', 'user', 'Normal message', 10);
      slackApp.addMessage('msg-2', 'bot', 'Zero tokens', 0);
      slackApp.addMessage('msg-3', 'admin', 'Another message', 5);

      expect(slackApp.getTotalEstimatedTokenCount()).toBe(15); // 10 + 0 + 5
    });
  });

  describe('inheritance and integration', () => {
    it('should properly inherit from AbstractConversationMessageList', () => {
      // Test that inherited methods work correctly
      expect(slackApp.getMessageCount()).toBe(0);
      expect(slackApp.getAllMessageEnvelopeIds()).toEqual([]);

      const envelopeId = slackApp.addMessage(
        'inherit-test',
        'user',
        'Test message',
      );

      expect(slackApp.getMessageCount()).toBe(1);
      expect(slackApp.getAllMessageEnvelopeIds()).toEqual([envelopeId]);
      expect(slackApp.hasMessageEnvelope(envelopeId)).toBe(true);
      expect(slackApp.hasMessageEnvelope('non-existent')).toBe(false);
    });

    it('should support base class operations on text messages', () => {
      const envelopeId1 = slackApp.addUserMessage('user-1', 'User message');
      const envelopeId2 = slackApp.addBotMessage('bot-1', 'Bot message');

      // Test removal
      expect(slackApp.removeMessageEnvelope(envelopeId1)).toBe(true);
      expect(slackApp.getMessageCount()).toBe(1);
      expect(slackApp.hasMessageEnvelope(envelopeId1)).toBe(false);
      expect(slackApp.hasMessageEnvelope(envelopeId2)).toBe(true);

      // Test clear all
      slackApp.clearAllMessages();
      expect(slackApp.getMessageCount()).toBe(0);
      expect(slackApp.getLatestMessages()).toEqual([]);
      expect(slackApp.hasMessages()).toBe(false);
    });

    it('should maintain type safety with specialized methods', () => {
      const envelopeId = slackApp.addMessage(
        'type-safety',
        'user',
        'Safe text message',
      );

      // Both base and specialized methods should return same data
      const fromBase = slackApp.getMessageEnvelopeById(envelopeId);
      const fromSpecialized = slackApp.getLatestMessages()[0];

      expect(fromBase).toEqual(fromSpecialized);
      expect(fromBase!.envelope.envelopePayload.content.type).toBe(
        'text/plain',
      );
      expect(typeof fromBase!.envelope.envelopePayload.content.payload).toBe(
        'string',
      );
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle special characters in message IDs and author roles', () => {
      const specialMessageId = 'slack-msg-with-special!@#$%^&*()';
      const specialAuthorRole = 'bot@domain.com';
      const text = 'Message with special characters';

      const envelopeId = slackApp.addMessage(
        specialMessageId,
        specialAuthorRole,
        text,
      );
      const stored = slackApp.getMessageEnvelopeById(envelopeId);

      expect(stored!.envelope.envelopePayload.messageId).toBe(specialMessageId);
      expect(stored!.envelope.envelopePayload.author_role).toBe(
        specialAuthorRole,
      );
    });

    it('should handle zero and negative estimated token counts', () => {
      const scenarios = [
        { tokens: 0, name: 'zero' },
        { tokens: -1, name: 'negative' },
        { tokens: 1, name: 'minimal' },
      ];

      scenarios.forEach((scenario) => {
        const envelopeId = slackApp.addMessage(
          `tokens-${scenario.name}`,
          'user',
          'Test message',
          scenario.tokens,
        );

        const stored = slackApp.getMessageEnvelopeById(envelopeId);
        expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(
          scenario.tokens,
        );
      });
    });

    it('should handle rapid successive additions', () => {
      const sameTimestamp = 5000;
      mockDateNow.mockReturnValue(sameTimestamp);

      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = slackApp.addMessage(`rapid-${i}`, 'user', `Message ${i}`);
        ids.push(id);
      }

      expect(slackApp.getMessageCount()).toBe(5);
      expect(new Set(ids).size).toBe(5); // All IDs should be unique

      const latest = slackApp.getLatestMessages();
      expect(latest).toHaveLength(5);
      latest.forEach((container) => {
        expect(container.addedAtMs).toBe(sameTimestamp);
      });
    });

    it('should handle very long messages', () => {
      const longText = 'A'.repeat(10000); // 10,000 characters
      const expectedTokens = Math.ceil(longText.length / 4); // 2,500 tokens

      const envelopeId = slackApp.addMessage('long-msg', 'user', longText);
      const stored = slackApp.getMessageEnvelopeById(envelopeId);

      expect(stored!.envelope.envelopePayload.content.payload).toBe(longText);
      expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(
        expectedTokens,
      );
      expect(slackApp.getTotalCharacterCount()).toBe(10000);
      expect(slackApp.getTotalEstimatedTokenCount()).toBe(2500);
    });

    it('should handle mixed role case sensitivity', () => {
      slackApp.addMessage('msg-1', 'User', 'Message with capital U');
      slackApp.addMessage('msg-2', 'user', 'Message with lowercase u');

      // These should be treated as different roles
      expect(slackApp.getMessagesByAuthorRole('User')).toHaveLength(1);
      expect(slackApp.getMessagesByAuthorRole('user')).toHaveLength(1);
      expect(slackApp.hasMessagesFromRole('User')).toBe(true);
      expect(slackApp.hasMessagesFromRole('user')).toBe(true);
    });
  });
});
