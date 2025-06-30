import { AbstractConversationMessageList } from './AbstractConversationMessageList';
import type {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  TConversationMessageContentString,
} from './types';

/**
 * Specialized conversation list for Slack app text message handling
 * Extends the base functionality with Slack-specific text message methods
 * This class handles only text messages, no image support
 */
class ConversationListSlackApp extends AbstractConversationMessageList<TConversationTextMessageEnvelope> {
  constructor() {
    super();
  }

  /**
   * Add a text message envelope to the Slack conversation list
   * @param textMessageEnvelope - The text message envelope to add
   * @returns The unique ID assigned to the envelope
   */
  public addTextMessageEnvelope(
    textMessageEnvelope: TConversationTextMessageEnvelope,
  ): string {
    return super.addMessageEnvelope(textMessageEnvelope);
  }

  /**
   * Create and add a text message from individual components
   * This is the primary method for adding messages in Slack app context
   * @param messageId - Unique identifier for the message (e.g., Slack message timestamp)
   * @param authorRole - Role of the message author (e.g., 'user', 'bot', 'admin')
   * @param text - The text content of the message
   * @param estimatedTokenCount - Estimated token count for the message (defaults to text.length / 4)
   * @returns The unique envelope ID
   */
  public addMessage(
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
   * Add a user message to the Slack conversation
   * Convenience method with default author role
   * @param messageId - Unique identifier for the message
   * @param text - The message text
   * @param estimatedTokenCount - Optional token count override
   * @returns The unique envelope ID
   */
  public addUserMessage(
    messageId: string,
    text: string,
    estimatedTokenCount?: number,
  ): string {
    return this.addMessage(messageId, 'user', text, estimatedTokenCount);
  }

  /**
   * Add a bot message to the Slack conversation
   * Convenience method with default author role
   * @param messageId - Unique identifier for the message
   * @param text - The message text
   * @param estimatedTokenCount - Optional token count override
   * @returns The unique envelope ID
   */
  public addBotMessage(
    messageId: string,
    text: string,
    estimatedTokenCount?: number,
  ): string {
    return this.addMessage(messageId, 'bot', text, estimatedTokenCount);
  }

  /**
   * Get all messages sorted by most recent first
   * @returns Array of text message envelopes with metadata
   */
  public getLatestMessages() {
    return this.getLastAddedEnvelopes();
  }

  /**
   * Get the oldest message in the conversation
   * @returns The first message envelope with metadata or null if empty
   */
  public getFirstMessage() {
    return this.getFirstAddedEnvelope();
  }

  /**
   * Get messages by author role
   * @param authorRole - The role to filter by (e.g., 'user', 'bot', 'admin')
   * @returns Array of messages from the specified author role
   */
  public getMessagesByAuthorRole(authorRole: string) {
    return this.getLastAddedEnvelopes().filter(
      (container) =>
        container.envelope.envelopePayload.author_role === authorRole,
    );
  }

  /**
   * Get all user messages
   * @returns Array of user messages sorted by most recent first
   */
  public getUserMessages() {
    return this.getMessagesByAuthorRole('user');
  }

  /**
   * Get all bot messages
   * @returns Array of bot messages sorted by most recent first
   */
  public getBotMessages() {
    return this.getMessagesByAuthorRole('bot');
  }

  /**
   * Check if the conversation has any messages
   * @returns True if there are messages, false otherwise
   */
  public hasMessages(): boolean {
    return this.getMessageCount() > 0;
  }

  /**
   * Check if the conversation has messages from a specific author role
   * @param authorRole - The role to check for
   * @returns True if there are messages from that role, false otherwise
   */
  public hasMessagesFromRole(authorRole: string): boolean {
    return this.getMessagesByAuthorRole(authorRole).length > 0;
  }

  /**
   * Get the latest message from a specific author role
   * @param authorRole - The role to get the latest message from
   * @returns The most recent message from that role or null if none exist
   */
  public getLatestMessageFromRole(authorRole: string) {
    const messages = this.getMessagesByAuthorRole(authorRole);
    return messages.length > 0 ? messages[0] : null;
  }

  /**
   * Get total character count of all messages
   * @returns Total number of characters across all message content
   */
  public getTotalCharacterCount(): number {
    return this.getLastAddedEnvelopes().reduce(
      (total, container) =>
        total + container.envelope.envelopePayload.content.payload.length,
      0,
    );
  }

  /**
   * Get total estimated token count of all messages
   * @returns Total estimated tokens across all messages
   */
  public getTotalEstimatedTokenCount(): number {
    return this.getLastAddedEnvelopes().reduce(
      (total, container) =>
        total + container.envelope.envelopePayload.estimated_token_count,
      0,
    );
  }
}

export { ConversationListSlackApp };
