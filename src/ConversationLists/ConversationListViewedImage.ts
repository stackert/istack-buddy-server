import { AbstractConversationMessageList } from './AbstractConversationMessageList';
import type {
  TConversationImageMessageEnvelope,
  TConversationImageMessage,
  TConversationMessageContentImageBuffer,
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  TConversationMessageContentString,
} from './types';

// Union type for text and image message envelopes
type TConversationTextAndImageMessageEnvelope =
  | TConversationTextMessageEnvelope
  | TConversationImageMessageEnvelope;

/**
 * Specialized conversation list for handling both text and image messages
 * Extends the base functionality with text and image-specific methods
 */
class ConversationListViewedImage extends AbstractConversationMessageList<TConversationTextAndImageMessageEnvelope> {
  constructor() {
    super();
  }

  /**
   * Add an image message envelope to the list
   * @param imageMessageEnvelope - The image message envelope to add
   * @returns The unique ID assigned to the envelope
   */
  public addImageMessageEnvelope(
    imageMessageEnvelope: TConversationImageMessageEnvelope,
  ): string {
    return super.addMessageEnvelope(imageMessageEnvelope);
  }

  /**
   * Add a text message envelope to the list
   * @param textMessageEnvelope - The text message envelope to add
   * @returns The unique ID assigned to the envelope
   */
  public addTextMessageEnvelope(
    textMessageEnvelope: TConversationTextMessageEnvelope,
  ): string {
    return super.addMessageEnvelope(textMessageEnvelope);
  }

  /**
   * Create and add an image message from individual components
   * @param messageId - Unique identifier for the message
   * @param authorRole - Role of the message author
   * @param imageBuffer - The image buffer content
   * @param estimatedTokenCount - Estimated token count for the message
   * @returns The unique envelope ID
   */
  public addImageMessage(
    messageId: string,
    authorRole: string,
    imageBuffer: Buffer,
    estimatedTokenCount: number = 50, // Default estimate for images
  ): string {
    const imageContent: TConversationMessageContentImageBuffer = {
      type: 'image/*',
      payload: imageBuffer,
    };

    const imageMessage: TConversationImageMessage = {
      messageId,
      author_role: authorRole,
      content: imageContent,
      created_at: new Date().toISOString(),
      estimated_token_count: estimatedTokenCount,
    };

    const imageEnvelope: TConversationImageMessageEnvelope = {
      messageId,
      envelopePayload: imageMessage,
    };

    return this.addImageMessageEnvelope(imageEnvelope);
  }

  /**
   * Create and add a text message from individual components
   * @param messageId - Unique identifier for the message
   * @param authorRole - Role of the message author
   * @param text - The text content
   * @param estimatedTokenCount - Estimated token count for the message
   * @returns The unique envelope ID
   */
  public addTextMessage(
    messageId: string,
    authorRole: string,
    text: string,
    estimatedTokenCount: number = Math.ceil(text.length / 4), // Default estimate
  ): string {
    const textContent: TConversationMessageContentString = {
      type: 'text/plain',
      payload: text,
    };

    const textMessage: TConversationTextMessage = {
      messageId,
      author_role: authorRole,
      content: textContent,
      created_at: new Date().toISOString(),
      estimated_token_count: estimatedTokenCount,
    };

    const textEnvelope: TConversationTextMessageEnvelope = {
      messageId,
      envelopePayload: textMessage,
    };

    return this.addTextMessageEnvelope(textEnvelope);
  }

  /**
   * Get all messages (text and images) sorted by most recent first
   * @returns Array of message envelopes with metadata
   */
  public getLatestMessages() {
    return this.getLastAddedEnvelopes();
  }

  /**
   * Get all image messages sorted by most recent first
   * @returns Array of image message envelopes with metadata
   */
  public getLatestImageMessages() {
    return this.getLastAddedEnvelopes().filter(
      (container) =>
        container.envelope.envelopePayload.content.type === 'image/*',
    );
  }

  /**
   * Get all text messages sorted by most recent first
   * @returns Array of text message envelopes with metadata
   */
  public getLatestTextMessages() {
    return this.getLastAddedEnvelopes().filter(
      (container) =>
        container.envelope.envelopePayload.content.type === 'text/plain',
    );
  }

  /**
   * Get the oldest image message
   * @returns The first image message envelope with metadata or null if no image messages
   */
  public getFirstImageMessage() {
    const imageMessages = this.getLatestImageMessages();
    return imageMessages.length > 0
      ? imageMessages[imageMessages.length - 1]
      : null;
  }

  /**
   * Get the oldest text message
   * @returns The first text message envelope with metadata or null if no text messages
   */
  public getFirstTextMessage() {
    const textMessages = this.getLatestTextMessages();
    return textMessages.length > 0
      ? textMessages[textMessages.length - 1]
      : null;
  }

  /**
   * Get the oldest message (text or image)
   * @returns The first message envelope with metadata or null if empty
   */
  public getFirstMessage() {
    return this.getFirstAddedEnvelope();
  }

  /**
   * Check if the list contains any image messages
   * @returns True if there are image messages, false otherwise
   */
  public hasImageMessages(): boolean {
    return this.getLatestImageMessages().length > 0;
  }

  /**
   * Check if the list contains any text messages
   * @returns True if there are text messages, false otherwise
   */
  public hasTextMessages(): boolean {
    return this.getLatestTextMessages().length > 0;
  }

  /**
   * Get count of image messages
   * @returns Number of image messages in the list
   */
  public getImageMessageCount(): number {
    return this.getLatestImageMessages().length;
  }

  /**
   * Get count of text messages
   * @returns Number of text messages in the list
   */
  public getTextMessageCount(): number {
    return this.getLatestTextMessages().length;
  }
}

export { ConversationListViewedImage };
