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
class ConversationListSimpleExample extends AbstractConversationMessageList<TConversationTextAndImageMessageEnvelope> {
  constructor() {
    super();
  }

  /**
   * Get all messages (text and images) sorted by most recent first
   * @returns Array of message envelopes with metadata
   */
  public getLatestMessages() {
    return this.getLastAddedEnvelopes();
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
   * Get the oldest message (text or image)
   * @returns The first message envelope with metadata or null if empty
   */
  public getFirstMessage() {
    return this.getFirstAddedEnvelope();
  }
}

export { ConversationListSimpleExample };
