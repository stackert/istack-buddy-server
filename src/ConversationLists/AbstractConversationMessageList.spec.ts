/**
 * Unit tests for AbstractConversationMessageList
 *
 * This test suite comprehensively tests the AbstractConversationMessageList class which provides
 * core functionality for managing conversation message envelopes with timestamps and unique IDs.
 *
 * Key functionality tested:
 * - Message envelope addition with unique ID generation
 * - Message retrieval by ID
 * - Chronological sorting (both ascending and descending)
 * - Edge cases like empty lists, duplicate timestamps, and non-existent IDs
 * - Data integrity across all access methods
 *
 * Test coverage includes:
 * - Constructor and initialization
 * - addMessageEnvelope() - Adding messages with metadata
 * - getMessageEnvelopeById() - Individual message retrieval
 * - getLastAddedEnvelopes() - Chronological retrieval (newest first)
 * - getFirstAddedEnvelope() - Finding oldest message
 * - Integration scenarios and data integrity verification
 *
 * The tests use mocked UUID generation and Date.now() for predictable results.
 */

import { AbstractConversationMessageList } from './AbstractConversationMessageList';
import type {
  TConversationTextMessage,
  TConversationTextMessageEnvelope,
  TConversationMessageContentString,
} from './types';

// Mock UUID to have predictable test values
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

// Test implementation that extends the abstract class
class TestConversationMessageList extends AbstractConversationMessageList<TConversationTextMessageEnvelope> {
  constructor() {
    super();
  }
}

// Helper function to create test message envelope
function createTestMessageEnvelope(
  messageId: string = 'test-message-id',
  content: string = 'Test message content',
): TConversationTextMessageEnvelope {
  const textContent: TConversationMessageContentString = {
    type: 'text/plain',
    payload: content,
  };

  const message: TConversationTextMessage = {
    messageId,
    author_role: 'user',
    content: textContent,
    created_at: new Date().toISOString(),
    estimated_token_count: 10,
  };

  return {
    messageId,
    requestOrResponse: 'request',
    envelopePayload: message,
  };
}

describe('AbstractConversationMessageList', () => {
  let messageList: TestConversationMessageList;
  let mockDateNow: jest.SpyInstance;

  beforeEach(() => {
    messageList = new TestConversationMessageList();
    // Mock Date.now() to have predictable timestamps
    mockDateNow = jest.spyOn(Date, 'now');
  });

  afterEach(() => {
    mockDateNow.mockRestore();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance successfully', () => {
      expect(messageList).toBeDefined();
      expect(messageList).toBeInstanceOf(AbstractConversationMessageList);
    });

    it('should initialize with empty message list', () => {
      const envelopes = messageList.getLastAddedEnvelopes();
      expect(envelopes).toEqual([]);
    });
  });

  describe('addMessageEnvelope', () => {
    it('should add a message envelope and return unique ID', () => {
      const testEnvelope = createTestMessageEnvelope();
      mockDateNow.mockReturnValue(1000);

      const envelopeId = messageList.addMessageEnvelope(testEnvelope);

      expect(envelopeId).toBeDefined();
      expect(typeof envelopeId).toBe('string');
      expect(envelopeId).toMatch(/^mocked-uuid-/);
    });

    it('should store the message envelope with correct metadata', () => {
      const testEnvelope = createTestMessageEnvelope('msg-1', 'Hello World');
      const timestamp = 1234567890;
      mockDateNow.mockReturnValue(timestamp);

      const envelopeId = messageList.addMessageEnvelope(testEnvelope);
      const storedEnvelope = messageList.getMessageEnvelopeById(envelopeId);

      expect(storedEnvelope).toBeDefined();
      expect(storedEnvelope.envelopeId).toBe(envelopeId);
      expect(storedEnvelope.addedAtMs).toBe(timestamp);
      expect(storedEnvelope.envelope).toEqual(testEnvelope);
    });

    it('should generate unique IDs for multiple messages', () => {
      const envelope1 = createTestMessageEnvelope('msg-1');
      const envelope2 = createTestMessageEnvelope('msg-2');

      const id1 = messageList.addMessageEnvelope(envelope1);
      const id2 = messageList.addMessageEnvelope(envelope2);

      expect(id1).not.toBe(id2);
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });

    it('should handle multiple message envelopes with different timestamps', () => {
      const envelope1 = createTestMessageEnvelope('msg-1');
      const envelope2 = createTestMessageEnvelope('msg-2');

      mockDateNow.mockReturnValueOnce(1000);
      const id1 = messageList.addMessageEnvelope(envelope1);

      mockDateNow.mockReturnValueOnce(2000);
      const id2 = messageList.addMessageEnvelope(envelope2);

      const stored1 = messageList.getMessageEnvelopeById(id1);
      const stored2 = messageList.getMessageEnvelopeById(id2);

      expect(stored1.addedAtMs).toBe(1000);
      expect(stored2.addedAtMs).toBe(2000);
    });
  });

  describe('getMessageEnvelopeById', () => {
    it('should return undefined for non-existent envelope ID', () => {
      const result = messageList.getMessageEnvelopeById('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('should return the correct envelope for existing ID', () => {
      const testEnvelope = createTestMessageEnvelope('test-msg');
      const timestamp = 5000;
      mockDateNow.mockReturnValue(timestamp);

      const envelopeId = messageList.addMessageEnvelope(testEnvelope);
      const retrievedEnvelope = messageList.getMessageEnvelopeById(envelopeId);

      expect(retrievedEnvelope).toBeDefined();
      expect(retrievedEnvelope.envelopeId).toBe(envelopeId);
      expect(retrievedEnvelope.addedAtMs).toBe(timestamp);
      expect(retrievedEnvelope.envelope).toEqual(testEnvelope);
    });

    it('should return different envelopes for different IDs', () => {
      const envelope1 = createTestMessageEnvelope('msg-1', 'First message');
      const envelope2 = createTestMessageEnvelope('msg-2', 'Second message');

      const id1 = messageList.addMessageEnvelope(envelope1);
      const id2 = messageList.addMessageEnvelope(envelope2);

      const retrieved1 = messageList.getMessageEnvelopeById(id1);
      const retrieved2 = messageList.getMessageEnvelopeById(id2);

      expect(retrieved1).toBeDefined();
      expect(retrieved2).toBeDefined();
      expect(retrieved1!.envelope.envelopePayload.content.payload).toBe(
        'First message',
      );
      expect(retrieved2!.envelope.envelopePayload.content.payload).toBe(
        'Second message',
      );
    });
  });

  describe('getLastAddedEnvelopes', () => {
    it('should return empty array when no messages exist', () => {
      const result = messageList.getLastAddedEnvelopes();
      expect(result).toEqual([]);
    });

    it('should return single envelope when only one message exists', () => {
      const testEnvelope = createTestMessageEnvelope();
      mockDateNow.mockReturnValue(1000);

      const envelopeId = messageList.addMessageEnvelope(testEnvelope);
      const results = messageList.getLastAddedEnvelopes();

      expect(results).toHaveLength(1);
      expect(results[0].envelopeId).toBe(envelopeId);
      expect(results[0].addedAtMs).toBe(1000);
    });

    it('should return envelopes sorted by most recent first (descending)', () => {
      const envelope1 = createTestMessageEnvelope('msg-1');
      const envelope2 = createTestMessageEnvelope('msg-2');
      const envelope3 = createTestMessageEnvelope('msg-3');

      // Add with increasing timestamps
      mockDateNow.mockReturnValueOnce(1000);
      const id1 = messageList.addMessageEnvelope(envelope1);

      mockDateNow.mockReturnValueOnce(2000);
      const id2 = messageList.addMessageEnvelope(envelope2);

      mockDateNow.mockReturnValueOnce(3000);
      const id3 = messageList.addMessageEnvelope(envelope3);

      const results = messageList.getLastAddedEnvelopes();

      expect(results).toHaveLength(3);
      // Should be sorted by most recent first
      expect(results[0].envelopeId).toBe(id3); // timestamp 3000
      expect(results[1].envelopeId).toBe(id2); // timestamp 2000
      expect(results[2].envelopeId).toBe(id1); // timestamp 1000

      expect(results[0].addedAtMs).toBe(3000);
      expect(results[1].addedAtMs).toBe(2000);
      expect(results[2].addedAtMs).toBe(1000);
    });

    it('should handle messages with same timestamp correctly', () => {
      const envelope1 = createTestMessageEnvelope('msg-1');
      const envelope2 = createTestMessageEnvelope('msg-2');

      const sameTimestamp = 5000;
      mockDateNow.mockReturnValue(sameTimestamp);

      const id1 = messageList.addMessageEnvelope(envelope1);
      const id2 = messageList.addMessageEnvelope(envelope2);

      const results = messageList.getLastAddedEnvelopes();

      expect(results).toHaveLength(2);
      expect(results[0].addedAtMs).toBe(sameTimestamp);
      expect(results[1].addedAtMs).toBe(sameTimestamp);

      // Both should be present regardless of order
      const resultIds = results.map((r) => r.envelopeId);
      expect(resultIds).toContain(id1);
      expect(resultIds).toContain(id2);
    });
  });

  describe('getFirstAddedEnvelope', () => {
    it('should return undefined when no messages exist', () => {
      const result = messageList.getFirstAddedEnvelope();
      expect(result).toBeUndefined();
    });

    it('should return the single envelope when only one message exists', () => {
      const testEnvelope = createTestMessageEnvelope();
      mockDateNow.mockReturnValue(1000);

      const envelopeId = messageList.addMessageEnvelope(testEnvelope);
      const result = messageList.getFirstAddedEnvelope();

      expect(result).toBeDefined();
      expect(result.envelopeId).toBe(envelopeId);
      expect(result.addedAtMs).toBe(1000);
    });

    it('should return the earliest added envelope when multiple exist', () => {
      const envelope1 = createTestMessageEnvelope('msg-1');
      const envelope2 = createTestMessageEnvelope('msg-2');
      const envelope3 = createTestMessageEnvelope('msg-3');

      // Add with increasing timestamps
      mockDateNow.mockReturnValueOnce(3000); // Third chronologically
      const id1 = messageList.addMessageEnvelope(envelope1);

      mockDateNow.mockReturnValueOnce(1000); // First chronologically
      const id2 = messageList.addMessageEnvelope(envelope2);

      mockDateNow.mockReturnValueOnce(2000); // Second chronologically
      const id3 = messageList.addMessageEnvelope(envelope3);

      const result = messageList.getFirstAddedEnvelope();

      expect(result).toBeDefined();
      expect(result.envelopeId).toBe(id2); // Should be the one with timestamp 1000
      expect(result.addedAtMs).toBe(1000);
    });

    it('should handle messages with same timestamp correctly', () => {
      const envelope1 = createTestMessageEnvelope('msg-1');
      const envelope2 = createTestMessageEnvelope('msg-2');

      const sameTimestamp = 5000;
      mockDateNow.mockReturnValue(sameTimestamp);

      const id1 = messageList.addMessageEnvelope(envelope1);
      const id2 = messageList.addMessageEnvelope(envelope2);

      const result = messageList.getFirstAddedEnvelope();

      expect(result).toBeDefined();
      expect(result.addedAtMs).toBe(sameTimestamp);
      // Should be one of the two envelopes
      expect([id1, id2]).toContain(result.envelopeId);
    });
  });

  describe('integration scenarios', () => {
    it('should handle a complete message lifecycle', () => {
      // Add multiple messages at different times
      const messages = [
        {
          envelope: createTestMessageEnvelope('msg-1', 'First'),
          timestamp: 1000,
        },
        {
          envelope: createTestMessageEnvelope('msg-2', 'Second'),
          timestamp: 3000,
        },
        {
          envelope: createTestMessageEnvelope('msg-3', 'Third'),
          timestamp: 2000,
        },
      ];

      const addedIds: string[] = [];

      messages.forEach(({ envelope, timestamp }) => {
        mockDateNow.mockReturnValueOnce(timestamp);
        const id = messageList.addMessageEnvelope(envelope);
        addedIds.push(id);
      });

      // Test getFirstAddedEnvelope returns the earliest (timestamp 1000)
      const firstEnvelope = messageList.getFirstAddedEnvelope();
      expect(firstEnvelope.addedAtMs).toBe(1000);
      expect(firstEnvelope.envelope.envelopePayload.content.payload).toBe(
        'First',
      );

      // Test getLastAddedEnvelopes returns in descending order
      const allEnvelopes = messageList.getLastAddedEnvelopes();
      expect(allEnvelopes).toHaveLength(3);
      expect(allEnvelopes[0].addedAtMs).toBe(3000); // 'Second' message
      expect(allEnvelopes[1].addedAtMs).toBe(2000); // 'Third' message
      expect(allEnvelopes[2].addedAtMs).toBe(1000); // 'First' message

      // Test individual retrieval
      addedIds.forEach((id) => {
        const retrieved = messageList.getMessageEnvelopeById(id);
        expect(retrieved).toBeDefined();
        expect(retrieved!.envelopeId).toBe(id);
      });
    });

    it('should maintain data integrity across operations', () => {
      const testEnvelope = createTestMessageEnvelope(
        'integrity-test',
        'Test content',
      );
      mockDateNow.mockReturnValue(12345);

      const envelopeId = messageList.addMessageEnvelope(testEnvelope);

      // Verify the same data is returned through different access methods
      const byId = messageList.getMessageEnvelopeById(envelopeId);
      const inLastAdded = messageList.getLastAddedEnvelopes()[0];
      const asFirstAdded = messageList.getFirstAddedEnvelope();

      expect(byId).toBeDefined();
      expect(byId).toEqual(inLastAdded);
      expect(byId).toEqual(asFirstAdded);
      expect(byId!.envelope).toEqual(testEnvelope);
      expect(byId!.addedAtMs).toBe(12345);
    });
  });
});
