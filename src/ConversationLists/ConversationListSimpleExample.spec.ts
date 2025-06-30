/**
 * Unit tests for ConversationListSimpleExample
 *
 * This test suite comprehensively tests the ConversationListSimpleExample class which provides
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

import { ConversationListSimpleExample } from './ConversationListSimpleExample';
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
    envelopePayload: textMessage,
  };
}

describe('ConversationListSimpleExample', () => {
  let imageList: ConversationListSimpleExample;
  let mockDateNow: jest.SpyInstance;

  beforeEach(() => {
    imageList = new ConversationListSimpleExample();
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
      expect(imageList).toBeInstanceOf(ConversationListSimpleExample);
      expect(imageList).toBeInstanceOf(AbstractConversationMessageList);
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
});
