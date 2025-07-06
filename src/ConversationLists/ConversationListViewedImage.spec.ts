/**
 * Unit tests for ConversationListViewedImage
 *
 * This test suite comprehensively tests the ConversationListViewedImage class which provides
 * specialized functionality for managing image message conversations.
 *
 * Key functionality tested:
 * - Image message envelope handling
 * - Image message creation from components
 * - Specialized image retrieval methods
 * - Integration with base AbstractConversationMessageList functionality
 * - Buffer handling and default parameter usage
 * - Edge cases and error scenarios
 *
 * Test coverage includes:
 * - Constructor and inheritance verification
 * - addImageMessageEnvelope() - Direct envelope addition
 * - addImageMessage() - Helper method for creating image messages
 * - getLatestImageMessages() - Chronological retrieval (newest first)
 * - getFirstImageMessage() - Oldest image retrieval
 * - Integration with inherited base class methods
 * - Data integrity and type safety verification
 */

import { ConversationListViewedImage } from './ConversationListViewedImage';
import { AbstractConversationMessageList } from './AbstractConversationMessageList';
import type {
  TConversationImageMessageEnvelope,
  TConversationImageMessage,
  TConversationMessageContentImageBuffer,
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  TConversationMessageContentString,
} from './types';

// Mock UUID to have predictable test values
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

// Helper function to create test image message envelope
function createTestImageMessageEnvelope(
  messageId: string = 'test-image-msg-id',
  authorRole: string = 'user',
  imageData: string = 'fake-image-data',
  estimatedTokenCount: number = 50,
): TConversationImageMessageEnvelope {
  const imageContent: TConversationMessageContentImageBuffer = {
    type: 'image/*',
    payload: Buffer.from(imageData),
  };

  const imageMessage: TConversationImageMessage = {
    messageId,
    author_role: authorRole,
    content: imageContent,
    created_at: new Date().toISOString(),
    estimated_token_count: estimatedTokenCount,
  };

  return {
    messageId,
    requestOrResponse: 'request',
    envelopePayload: imageMessage,
  };
}

// Helper function to create test text message envelope
function createTestTextMessageEnvelope(
  messageId: string = 'test-text-msg-id',
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

describe('ConversationListViewedImage', () => {
  let imageList: ConversationListViewedImage;
  let mockDateNow: jest.SpyInstance;

  beforeEach(() => {
    imageList = new ConversationListViewedImage();
    // Mock Date.now() to have predictable timestamps
    mockDateNow = jest.spyOn(Date, 'now');
  });

  afterEach(() => {
    mockDateNow.mockRestore();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance successfully', () => {
      expect(imageList).toBeDefined();
      expect(imageList).toBeInstanceOf(ConversationListViewedImage);
      expect(imageList).toBeInstanceOf(AbstractConversationMessageList);
    });

    it('should initialize with empty image list', () => {
      const images = imageList.getLatestImageMessages();
      expect(images).toEqual([]);
      expect(imageList.getMessageCount()).toBe(0);
    });
  });

  describe('addImageMessageEnvelope', () => {
    it('(dev/debug)should add an image message envelope and return unique ID', () => {
      const testEnvelope = createTestImageMessageEnvelope();
      mockDateNow.mockReturnValue(1000);

      const envelopeId = imageList.addImageMessageEnvelope(testEnvelope);
      expect(envelopeId).toBeDefined();
      expect(typeof envelopeId).toBe('string');
      expect(envelopeId).toMatch(/^mocked-uuid-/);
      expect(imageList.getMessageCount()).toBe(1);
    });

    it('should add an image message envelope and return unique ID', () => {
      const testEnvelope = createTestImageMessageEnvelope();
      mockDateNow.mockReturnValue(1000);

      const envelopeId = imageList.addImageMessageEnvelope(testEnvelope);

      expect(envelopeId).toBeDefined();
      expect(typeof envelopeId).toBe('string');
      expect(envelopeId).toMatch(/^mocked-uuid-/);
      expect(imageList.getMessageCount()).toBe(1);
    });

    it('should store the image envelope with correct metadata', () => {
      const testEnvelope = createTestImageMessageEnvelope(
        'img-1',
        'photographer',
        'camera-shot',
      );
      const timestamp = 1234567890;
      mockDateNow.mockReturnValue(timestamp);

      const envelopeId = imageList.addImageMessageEnvelope(testEnvelope);
      const storedEnvelope = imageList.getMessageEnvelopeById(envelopeId);

      expect(storedEnvelope).toBeDefined();
      expect(storedEnvelope!.envelopeId).toBe(envelopeId);
      expect(storedEnvelope!.addedAtMs).toBe(timestamp);
      expect(storedEnvelope!.envelope).toEqual(testEnvelope);
      expect(storedEnvelope!.envelope.envelopePayload.author_role).toBe(
        'photographer',
      );
      expect(storedEnvelope!.envelope.envelopePayload.content.type).toBe(
        'image/*',
      );
    });

    it('should handle multiple image envelopes', () => {
      const envelope1 = createTestImageMessageEnvelope(
        'img-1',
        'user',
        'image1',
      );
      const envelope2 = createTestImageMessageEnvelope(
        'img-2',
        'admin',
        'image2',
      );

      mockDateNow.mockReturnValueOnce(1000);
      const id1 = imageList.addImageMessageEnvelope(envelope1);

      mockDateNow.mockReturnValueOnce(2000);
      const id2 = imageList.addImageMessageEnvelope(envelope2);

      expect(id1).not.toBe(id2);
      expect(imageList.getMessageCount()).toBe(2);

      const stored1 = imageList.getMessageEnvelopeById(id1);
      const stored2 = imageList.getMessageEnvelopeById(id2);

      expect(stored1!.addedAtMs).toBe(1000);
      expect(stored2!.addedAtMs).toBe(2000);
      expect(stored1!.envelope.envelopePayload.content.payload.toString()).toBe(
        'image1',
      );
      expect(stored2!.envelope.envelopePayload.content.payload.toString()).toBe(
        'image2',
      );
    });
  });

  describe('addImageMessage', () => {
    it('should create and add an image message with all parameters', () => {
      const messageId = 'custom-img-1';
      const authorRole = 'photographer';
      const imageBuffer = Buffer.from('high-res-photo-data');
      const estimatedTokenCount = 75;

      mockDateNow.mockReturnValue(5000);

      const envelopeId = imageList.addImageMessage(
        messageId,
        authorRole,
        imageBuffer,
        estimatedTokenCount,
      );

      expect(envelopeId).toBeDefined();
      expect(imageList.getMessageCount()).toBe(1);

      const stored = imageList.getMessageEnvelopeById(envelopeId);
      expect(stored).toBeDefined();

      const message = stored!.envelope.envelopePayload;
      expect(message.messageId).toBe(messageId);
      expect(message.author_role).toBe(authorRole);
      expect(message.content.type).toBe('image/*');
      expect(message.content.payload).toEqual(imageBuffer);
      expect(message.estimated_token_count).toBe(estimatedTokenCount);
      expect(message.created_at).toBeDefined();
      expect(new Date(message.created_at)).toBeInstanceOf(Date);
    });

    it('should use default estimated token count when not provided', () => {
      const messageId = 'default-token-img';
      const authorRole = 'user';
      const imageBuffer = Buffer.from('simple-image');

      const envelopeId = imageList.addImageMessage(
        messageId,
        authorRole,
        imageBuffer,
      );
      const stored = imageList.getMessageEnvelopeById(envelopeId);

      expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(50); // Default value
    });

    it('should handle different buffer sizes and content', () => {
      const scenarios = [
        { name: 'small', data: 'tiny', tokens: 10 },
        { name: 'medium', data: 'medium-sized-image-data', tokens: 25 },
        {
          name: 'large',
          data: 'very-large-high-resolution-image-data-with-lots-of-content',
          tokens: 100,
        },
      ];

      scenarios.forEach((scenario, index) => {
        mockDateNow.mockReturnValueOnce(1000 + index);

        const envelopeId = imageList.addImageMessage(
          `img-${scenario.name}`,
          'user',
          Buffer.from(scenario.data),
          scenario.tokens,
        );

        const stored = imageList.getMessageEnvelopeById(envelopeId);
        expect(
          stored!.envelope.envelopePayload.content.payload.toString(),
        ).toBe(scenario.data);
        expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(
          scenario.tokens,
        );
      });

      expect(imageList.getMessageCount()).toBe(3);
    });

    it('should create proper envelope structure', () => {
      const messageId = 'structure-test';
      const authorRole = 'admin';
      const imageBuffer = Buffer.from('test-structure');

      const envelopeId = imageList.addImageMessage(
        messageId,
        authorRole,
        imageBuffer,
      );
      const stored = imageList.getMessageEnvelopeById(envelopeId);

      // Verify the envelope structure
      expect(stored!.envelope.messageId).toBe(messageId);
      expect(stored!.envelope.envelopePayload).toBeDefined();

      // Verify the message structure
      const message = stored!.envelope.envelopePayload;
      expect(message).toHaveProperty('messageId');
      expect(message).toHaveProperty('author_role');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('created_at');
      expect(message).toHaveProperty('estimated_token_count');

      // Verify content structure
      expect(message.content).toHaveProperty('type');
      expect(message.content).toHaveProperty('payload');
      expect(message.content.type).toBe('image/*');
      expect(Buffer.isBuffer(message.content.payload)).toBe(true);
    });
  });

  describe('getLatestImageMessages', () => {
    it('should return empty array when no images exist', () => {
      const result = imageList.getLatestImageMessages();
      expect(result).toEqual([]);
    });

    it('should return single image when only one exists', () => {
      const envelope = createTestImageMessageEnvelope('single-img');
      mockDateNow.mockReturnValue(1000);

      const envelopeId = imageList.addImageMessageEnvelope(envelope);
      const results = imageList.getLatestImageMessages();

      expect(results).toHaveLength(1);
      expect(results[0].envelopeId).toBe(envelopeId);
      expect(results[0].addedAtMs).toBe(1000);
      expect(results[0].envelope.envelopePayload.content.type).toBe('image/*');
    });

    it('should return images sorted by most recent first', () => {
      const image1 = createTestImageMessageEnvelope(
        'img-1',
        'user',
        'first-image',
      );
      const image2 = createTestImageMessageEnvelope(
        'img-2',
        'user',
        'second-image',
      );
      const image3 = createTestImageMessageEnvelope(
        'img-3',
        'user',
        'third-image',
      );

      // Add with increasing timestamps
      mockDateNow.mockReturnValueOnce(1000);
      const id1 = imageList.addImageMessageEnvelope(image1);

      mockDateNow.mockReturnValueOnce(2000);
      const id2 = imageList.addImageMessageEnvelope(image2);

      mockDateNow.mockReturnValueOnce(3000);
      const id3 = imageList.addImageMessageEnvelope(image3);

      const results = imageList.getLatestImageMessages();

      expect(results).toHaveLength(3);
      // Should be sorted by most recent first
      expect(results[0].envelopeId).toBe(id3); // timestamp 3000
      expect(results[1].envelopeId).toBe(id2); // timestamp 2000
      expect(results[2].envelopeId).toBe(id1); // timestamp 1000

      expect(results[0].addedAtMs).toBe(3000);
      expect(results[1].addedAtMs).toBe(2000);
      expect(results[2].addedAtMs).toBe(1000);

      // Verify content order
      expect(
        results[0].envelope.envelopePayload.content.payload.toString(),
      ).toBe('third-image');
      expect(
        results[1].envelope.envelopePayload.content.payload.toString(),
      ).toBe('second-image');
      expect(
        results[2].envelope.envelopePayload.content.payload.toString(),
      ).toBe('first-image');
    });

    it('should handle mixed creation methods in chronological order', () => {
      // Mix addImageMessage and addImageMessageEnvelope
      mockDateNow.mockReturnValueOnce(1000);
      const id1 = imageList.addImageMessage(
        'method-img-1',
        'user',
        Buffer.from('method1'),
      );

      mockDateNow.mockReturnValueOnce(2000);
      const envelope = createTestImageMessageEnvelope(
        'envelope-img-1',
        'admin',
        'envelope1',
      );
      const id2 = imageList.addImageMessageEnvelope(envelope);

      mockDateNow.mockReturnValueOnce(3000);
      const id3 = imageList.addImageMessage(
        'method-img-2',
        'user',
        Buffer.from('method2'),
      );

      const results = imageList.getLatestImageMessages();

      expect(results).toHaveLength(3);
      expect(results[0].envelopeId).toBe(id3); // Most recent
      expect(results[1].envelopeId).toBe(id2);
      expect(results[2].envelopeId).toBe(id1); // Oldest
    });
  });

  describe('getFirstImageMessage', () => {
    it('should return null when no images exist', () => {
      const result = imageList.getFirstImageMessage();
      expect(result).toBeNull();
    });

    it('should return the single image when only one exists', () => {
      const envelope = createTestImageMessageEnvelope('only-img');
      mockDateNow.mockReturnValue(1000);

      const envelopeId = imageList.addImageMessageEnvelope(envelope);
      const result = imageList.getFirstImageMessage();

      expect(result).toBeDefined();
      expect(result!.envelopeId).toBe(envelopeId);
      expect(result!.addedAtMs).toBe(1000);
    });

    it('should return the earliest added image when multiple exist', () => {
      const image1 = createTestImageMessageEnvelope('img-1', 'user', 'first');
      const image2 = createTestImageMessageEnvelope('img-2', 'user', 'second');
      const image3 = createTestImageMessageEnvelope('img-3', 'user', 'third');

      // Add with non-sequential timestamps to test sorting
      mockDateNow.mockReturnValueOnce(3000); // Third chronologically
      const id1 = imageList.addImageMessageEnvelope(image1);

      mockDateNow.mockReturnValueOnce(1000); // First chronologically
      const id2 = imageList.addImageMessageEnvelope(image2);

      mockDateNow.mockReturnValueOnce(2000); // Second chronologically
      const id3 = imageList.addImageMessageEnvelope(image3);

      const result = imageList.getFirstImageMessage();

      expect(result).toBeDefined();
      expect(result!.envelopeId).toBe(id2); // Should be the one with timestamp 1000
      expect(result!.addedAtMs).toBe(1000);
      expect(result!.envelope.envelopePayload.content.payload.toString()).toBe(
        'second',
      );
    });
  });

  describe('inheritance and integration', () => {
    it('should properly inherit from AbstractConversationMessageList', () => {
      // Test that inherited methods work correctly
      expect(imageList.getMessageCount()).toBe(0);
      expect(imageList.getAllMessageEnvelopeIds()).toEqual([]);

      const envelopeId = imageList.addImageMessage(
        'inherit-test',
        'user',
        Buffer.from('test'),
      );

      expect(imageList.getMessageCount()).toBe(1);
      expect(imageList.getAllMessageEnvelopeIds()).toEqual([envelopeId]);
      expect(imageList.hasMessageEnvelope(envelopeId)).toBe(true);
      expect(imageList.hasMessageEnvelope('non-existent')).toBe(false);
    });

    it('should support base class operations on image messages', () => {
      const envelopeId1 = imageList.addImageMessage(
        'base-test-1',
        'user',
        Buffer.from('image1'),
      );
      const envelopeId2 = imageList.addImageMessage(
        'base-test-2',
        'admin',
        Buffer.from('image2'),
      );

      // Test removal
      expect(imageList.removeMessageEnvelope(envelopeId1)).toBe(true);
      expect(imageList.getMessageCount()).toBe(1);
      expect(imageList.hasMessageEnvelope(envelopeId1)).toBe(false);
      expect(imageList.hasMessageEnvelope(envelopeId2)).toBe(true);

      // Test clear all
      imageList.clearAllMessages();
      expect(imageList.getMessageCount()).toBe(0);
      expect(imageList.getLatestImageMessages()).toEqual([]);
    });

    it('should maintain type safety with specialized methods', () => {
      const envelopeId = imageList.addImageMessage(
        'type-safety',
        'user',
        Buffer.from('safe-image'),
      );

      // Both base and specialized methods should return same data
      const fromBase = imageList.getMessageEnvelopeById(envelopeId);
      const fromSpecialized = imageList.getLatestImageMessages()[0];

      expect(fromBase).toEqual(fromSpecialized);
      expect(fromBase!.envelope.envelopePayload.content.type).toBe('image/*');
      expect(
        Buffer.isBuffer(fromBase!.envelope.envelopePayload.content.payload),
      ).toBe(true);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle empty buffers', () => {
      const emptyBuffer = Buffer.alloc(0);
      const envelopeId = imageList.addImageMessage(
        'empty-buffer',
        'user',
        emptyBuffer,
      );

      const stored = imageList.getMessageEnvelopeById(envelopeId);
      expect(stored!.envelope.envelopePayload.content.payload).toEqual(
        emptyBuffer,
      );
      expect(stored!.envelope.envelopePayload.content.payload.length).toBe(0);
    });

    it('should handle special characters in message IDs and author roles', () => {
      const specialMessageId = 'img-with-special-chars!@#$%^&*()';
      const specialAuthorRole = 'author@domain.com';
      const buffer = Buffer.from('special-test');

      const envelopeId = imageList.addImageMessage(
        specialMessageId,
        specialAuthorRole,
        buffer,
      );
      const stored = imageList.getMessageEnvelopeById(envelopeId);

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
        const envelopeId = imageList.addImageMessage(
          `tokens-${scenario.name}`,
          'user',
          Buffer.from('test'),
          scenario.tokens,
        );

        const stored = imageList.getMessageEnvelopeById(envelopeId);
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
        const id = imageList.addImageMessage(
          `rapid-${i}`,
          'user',
          Buffer.from(`image-${i}`),
        );
        ids.push(id);
      }

      expect(imageList.getMessageCount()).toBe(5);
      expect(new Set(ids).size).toBe(5); // All IDs should be unique

      const latest = imageList.getLatestImageMessages();
      expect(latest).toHaveLength(5);
      latest.forEach((container) => {
        expect(container.addedAtMs).toBe(sameTimestamp);
      });
    });
  });

  describe('text message functionality', () => {
    describe('addTextMessageEnvelope', () => {
      it('should add a text message envelope and return unique ID', () => {
        const testEnvelope = createTestTextMessageEnvelope();
        mockDateNow.mockReturnValue(1000);

        const envelopeId = imageList.addTextMessageEnvelope(testEnvelope);

        expect(envelopeId).toBeDefined();
        expect(typeof envelopeId).toBe('string');
        expect(envelopeId).toMatch(/^mocked-uuid-/);
        expect(imageList.getMessageCount()).toBe(1);
      });

      it('should store the text envelope with correct metadata', () => {
        const testEnvelope = createTestTextMessageEnvelope(
          'txt-1',
          'assistant',
          'This is a test message',
        );
        const timestamp = 1234567890;
        mockDateNow.mockReturnValue(timestamp);

        const envelopeId = imageList.addTextMessageEnvelope(testEnvelope);
        const storedEnvelope = imageList.getMessageEnvelopeById(envelopeId);

        expect(storedEnvelope).toBeDefined();
        expect(storedEnvelope!.envelopeId).toBe(envelopeId);
        expect(storedEnvelope!.addedAtMs).toBe(timestamp);
        expect(storedEnvelope!.envelope).toEqual(testEnvelope);
        expect(storedEnvelope!.envelope.envelopePayload.author_role).toBe(
          'assistant',
        );
        expect(storedEnvelope!.envelope.envelopePayload.content.type).toBe(
          'text/plain',
        );
        expect(storedEnvelope!.envelope.envelopePayload.content.payload).toBe(
          'This is a test message',
        );
      });

      it('should handle multiple text envelopes', () => {
        const envelope1 = createTestTextMessageEnvelope(
          'txt-1',
          'user',
          'First message',
        );
        const envelope2 = createTestTextMessageEnvelope(
          'txt-2',
          'assistant',
          'Second message',
        );

        mockDateNow.mockReturnValueOnce(1000);
        const id1 = imageList.addTextMessageEnvelope(envelope1);

        mockDateNow.mockReturnValueOnce(2000);
        const id2 = imageList.addTextMessageEnvelope(envelope2);

        expect(id1).not.toBe(id2);
        expect(imageList.getMessageCount()).toBe(2);

        const stored1 = imageList.getMessageEnvelopeById(id1);
        const stored2 = imageList.getMessageEnvelopeById(id2);

        expect(stored1!.addedAtMs).toBe(1000);
        expect(stored2!.addedAtMs).toBe(2000);
        expect(stored1!.envelope.envelopePayload.content.payload).toBe(
          'First message',
        );
        expect(stored2!.envelope.envelopePayload.content.payload).toBe(
          'Second message',
        );
      });
    });

    describe('addTextMessage', () => {
      it('should create and add a text message with all parameters', () => {
        const messageId = 'custom-txt-1';
        const authorRole = 'assistant';
        const textContent = 'Hello, this is a custom message!';
        const estimatedTokenCount = 10;

        mockDateNow.mockReturnValue(5000);

        const envelopeId = imageList.addTextMessage(
          messageId,
          authorRole,
          textContent,
          estimatedTokenCount,
        );

        expect(envelopeId).toBeDefined();
        expect(imageList.getMessageCount()).toBe(1);

        const stored = imageList.getMessageEnvelopeById(envelopeId);
        expect(stored).toBeDefined();

        const message = stored!.envelope.envelopePayload;
        expect(message.messageId).toBe(messageId);
        expect(message.author_role).toBe(authorRole);
        expect(message.content.payload).toBe(textContent);
        expect(message.estimated_token_count).toBe(estimatedTokenCount);
        expect(message.content.type).toBe('text/plain');
      });

      it('should use default token estimation when not provided', () => {
        const testText = 'This is exactly 16 chars';
        const expectedTokens = Math.ceil(testText.length / 4); // 4

        const envelopeId = imageList.addTextMessage(
          'token-default',
          'user',
          testText,
        );

        const stored = imageList.getMessageEnvelopeById(envelopeId);
        expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(
          expectedTokens,
        );
      });

      it('should generate valid timestamps', () => {
        const currentTime = new Date();
        mockDateNow.mockReturnValue(currentTime.getTime());

        const envelopeId = imageList.addTextMessage(
          'timestamp-test',
          'user',
          'Test message',
        );

        const stored = imageList.getMessageEnvelopeById(envelopeId);
        const messageTime = new Date(
          stored!.envelope.envelopePayload.created_at,
        );

        const currentTimeMs = currentTime.getTime();
        expect(messageTime.getTime()).toBeLessThanOrEqual(currentTimeMs);
        expect(messageTime.getTime()).toBeGreaterThanOrEqual(
          currentTimeMs - 1000,
        );
      });

      it('should handle empty text content', () => {
        const envelopeId = imageList.addTextMessage('empty-text', 'user', '');

        const stored = imageList.getMessageEnvelopeById(envelopeId);
        expect(stored!.envelope.envelopePayload.content.payload).toBe('');
        expect(stored!.envelope.envelopePayload.estimated_token_count).toBe(0);
      });
    });

    describe('mixed message type functionality', () => {
      it('should handle both text and image messages', () => {
        // Add text message
        mockDateNow.mockReturnValueOnce(1000);
        const textId = imageList.addTextMessage('txt-1', 'user', 'Hello world');

        // Add image message
        mockDateNow.mockReturnValueOnce(2000);
        const imageId = imageList.addImageMessage(
          'img-1',
          'user',
          Buffer.from('image-data'),
        );

        expect(imageList.getMessageCount()).toBe(2);
        expect(imageList.getTextMessageCount()).toBe(1);
        expect(imageList.getImageMessageCount()).toBe(1);
      });

      it('should filter messages correctly by type', () => {
        // Add mixed messages
        imageList.addTextMessage('txt-1', 'user', 'Text message 1');
        imageList.addImageMessage('img-1', 'user', Buffer.from('image1'));
        imageList.addTextMessage('txt-2', 'assistant', 'Text message 2');
        imageList.addImageMessage('img-2', 'user', Buffer.from('image2'));

        const allMessages = imageList.getLatestMessages();
        const textMessages = imageList.getLatestTextMessages();
        const imageMessages = imageList.getLatestImageMessages();

        expect(allMessages).toHaveLength(4);
        expect(textMessages).toHaveLength(2);
        expect(imageMessages).toHaveLength(2);

        // Verify text messages contain only text
        textMessages.forEach((container) => {
          expect(container.envelope.envelopePayload.content.type).toBe(
            'text/plain',
          );
        });

        // Verify image messages contain only images
        imageMessages.forEach((container) => {
          expect(container.envelope.envelopePayload.content.type).toBe(
            'image/*',
          );
        });
      });
    });

    describe('getLatestTextMessages', () => {
      it('should return empty array when no text messages exist', () => {
        const result = imageList.getLatestTextMessages();
        expect(result).toEqual([]);
      });

      it('should return text messages in reverse chronological order', () => {
        // Add messages with specific timestamps
        mockDateNow.mockReturnValueOnce(1000);
        const id1 = imageList.addTextMessage('txt-1', 'user', 'First');

        mockDateNow.mockReturnValueOnce(3000);
        const id2 = imageList.addTextMessage('txt-2', 'user', 'Second');

        mockDateNow.mockReturnValueOnce(2000);
        const id3 = imageList.addTextMessage('txt-3', 'user', 'Third');

        const results = imageList.getLatestTextMessages();

        expect(results).toHaveLength(3);
        expect(results[0].envelopeId).toBe(id2); // Most recent (3000ms)
        expect(results[1].envelopeId).toBe(id3); // Middle (2000ms)
        expect(results[2].envelopeId).toBe(id1); // Oldest (1000ms)
      });

      it('should not include image messages in text results', () => {
        imageList.addTextMessage('txt-1', 'user', 'Text message');
        imageList.addImageMessage('img-1', 'user', Buffer.from('image'));

        const textResults = imageList.getLatestTextMessages();

        expect(textResults).toHaveLength(1);
        expect(textResults[0].envelope.envelopePayload.content.type).toBe(
          'text/plain',
        );
      });
    });

    describe('getFirstTextMessage', () => {
      it('should return null when no text messages exist', () => {
        const result = imageList.getFirstTextMessage();
        expect(result).toBeNull();
      });

      it('should return the single text message when only one exists', () => {
        const envelope = createTestTextMessageEnvelope('only-txt');
        mockDateNow.mockReturnValue(1000);

        const envelopeId = imageList.addTextMessageEnvelope(envelope);
        const result = imageList.getFirstTextMessage();

        expect(result).toBeDefined();
        expect(result!.envelopeId).toBe(envelopeId);
        expect(result!.addedAtMs).toBe(1000);
      });

      it('should return the earliest added text message when multiple exist', () => {
        const text1 = createTestTextMessageEnvelope('txt-1', 'user', 'first');
        const text2 = createTestTextMessageEnvelope('txt-2', 'user', 'second');
        const text3 = createTestTextMessageEnvelope('txt-3', 'user', 'third');

        // Add with non-sequential timestamps to test sorting
        mockDateNow.mockReturnValueOnce(3000); // Third chronologically
        const id1 = imageList.addTextMessageEnvelope(text1);

        mockDateNow.mockReturnValueOnce(1000); // First chronologically
        const id2 = imageList.addTextMessageEnvelope(text2);

        mockDateNow.mockReturnValueOnce(2000); // Second chronologically
        const id3 = imageList.addTextMessageEnvelope(text3);

        const result = imageList.getFirstTextMessage();

        expect(result).toBeDefined();
        expect(result!.envelopeId).toBe(id2); // Should be the one with timestamp 1000
        expect(result!.addedAtMs).toBe(1000);
        expect(result!.envelope.envelopePayload.content.payload).toBe('second');
      });

      it('should ignore image messages when finding first text message', () => {
        // Add image first
        mockDateNow.mockReturnValueOnce(500);
        imageList.addImageMessage('img-1', 'user', Buffer.from('image'));

        // Add text later
        mockDateNow.mockReturnValueOnce(1000);
        const textId = imageList.addTextMessage('txt-1', 'user', 'text');

        const result = imageList.getFirstTextMessage();

        expect(result).toBeDefined();
        expect(result!.envelopeId).toBe(textId);
        expect(result!.envelope.envelopePayload.content.type).toBe(
          'text/plain',
        );
      });
    });

    describe('helper methods', () => {
      describe('hasTextMessages', () => {
        it('should return false when no text messages exist', () => {
          expect(imageList.hasTextMessages()).toBe(false);
        });

        it('should return true when text messages exist', () => {
          imageList.addTextMessage('txt-1', 'user', 'Hello');
          expect(imageList.hasTextMessages()).toBe(true);
        });

        it('should return false when only image messages exist', () => {
          imageList.addImageMessage('img-1', 'user', Buffer.from('image'));
          expect(imageList.hasTextMessages()).toBe(false);
        });
      });

      describe('hasImageMessages', () => {
        it('should return false when no image messages exist', () => {
          expect(imageList.hasImageMessages()).toBe(false);
        });

        it('should return true when image messages exist', () => {
          imageList.addImageMessage('img-1', 'user', Buffer.from('image'));
          expect(imageList.hasImageMessages()).toBe(true);
        });

        it('should return false when only text messages exist', () => {
          imageList.addTextMessage('txt-1', 'user', 'Hello');
          expect(imageList.hasImageMessages()).toBe(false);
        });
      });

      describe('getTextMessageCount', () => {
        it('should return 0 when no text messages exist', () => {
          expect(imageList.getTextMessageCount()).toBe(0);
        });

        it('should return correct count for text messages', () => {
          imageList.addTextMessage('txt-1', 'user', 'Hello');
          expect(imageList.getTextMessageCount()).toBe(1);

          imageList.addTextMessage('txt-2', 'user', 'World');
          expect(imageList.getTextMessageCount()).toBe(2);
        });

        it('should not count image messages', () => {
          imageList.addTextMessage('txt-1', 'user', 'Hello');
          imageList.addImageMessage('img-1', 'user', Buffer.from('image'));

          expect(imageList.getTextMessageCount()).toBe(1);
        });
      });

      describe('getImageMessageCount', () => {
        it('should return 0 when no image messages exist', () => {
          expect(imageList.getImageMessageCount()).toBe(0);
        });

        it('should return correct count for image messages', () => {
          imageList.addImageMessage('img-1', 'user', Buffer.from('image1'));
          expect(imageList.getImageMessageCount()).toBe(1);

          imageList.addImageMessage('img-2', 'user', Buffer.from('image2'));
          expect(imageList.getImageMessageCount()).toBe(2);
        });

        it('should not count text messages', () => {
          imageList.addImageMessage('img-1', 'user', Buffer.from('image'));
          imageList.addTextMessage('txt-1', 'user', 'Hello');

          expect(imageList.getImageMessageCount()).toBe(1);
        });
      });
    });
  });
});
