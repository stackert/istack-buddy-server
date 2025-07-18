import { Injectable } from '@nestjs/common';
import { ChatConversationList } from './ChatConversationList';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';

/**
 * Service for managing chat conversation lists
 * Maintains an in-memory dictionary of chat conversations by their ID
 * Provides filtering and message management capabilities for chat conversations
 */
@Injectable()
export class ChatConversationListService {
  private conversations: Record<string, ChatConversationList> = {};

  constructor() {}

  /**
   * Get a conversation by its ID
   * @param conversationId The unique identifier of the conversation
   * @returns The conversation if found, undefined otherwise
   */
  getConversationById(
    conversationId: string,
  ): ChatConversationList | undefined {
    return this.conversations[conversationId];
  }

  /**
   * Get a conversation by ID, or create it if it doesn't exist
   * @param conversationId The unique identifier of the conversation
   * @returns The existing or newly created conversation
   */
  getConversationOrCreate(conversationId: string): ChatConversationList {
    // Check if conversation already exists
    const existingConversation = this.conversations[conversationId];
    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const newConversation = new ChatConversationList();
    this.conversations[conversationId] = newConversation;

    return newConversation;
  }

  /**
   * Check if a conversation exists
   * @param conversationId The unique identifier of the conversation
   * @returns True if the conversation exists, false otherwise
   */
  hasConversation(conversationId: string): boolean {
    return conversationId in this.conversations;
  }

  /**
   * Remove a conversation from the service
   * @param conversationId The unique identifier of the conversation to remove
   * @returns True if the conversation was removed, false if it didn't exist
   */
  removeConversation(conversationId: string): boolean {
    if (conversationId in this.conversations) {
      delete this.conversations[conversationId];
      return true;
    }
    return false;
  }

  /**
   * Get all conversation IDs
   * @returns Array of all conversation IDs
   */
  getAllConversationIds(): string[] {
    return Object.keys(this.conversations);
  }

  /**
   * Get all conversations
   * @returns Array of all conversation instances
   */
  getAllConversations(): ChatConversationList[] {
    return Object.values(this.conversations);
  }

  /**
   * Get the number of conversations currently managed
   * @returns The count of conversations
   */
  getConversationCount(): number {
    return Object.keys(this.conversations).length;
  }

  /**
   * Clear all conversations from the service
   * Use with caution - this will remove all conversation data
   */
  clearAllConversations(): void {
    this.conversations = {};
  }

  /**
   * Add a message to a conversation list
   * @param conversationId The conversation ID to add the message to
   * @param message The message to add
   * @returns The message ID
   */
  addMessageToConversation(
    conversationId: string,
    message: IConversationMessage,
  ): string {
    const conversation = this.getConversationOrCreate(conversationId);
    return conversation.addChatMessage(message);
  }

  /**
   * Get filtered messages from a conversation
   * @param conversationId The conversation ID
   * @param filterOptions Filter criteria for messages
   * @returns Array of messages matching the filter criteria
   */
  getFilteredMessages(
    conversationId: string,
    filterOptions: Partial<Omit<IConversationMessage, 'conversationId'>>,
  ): IConversationMessage[] {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.getFilteredMessages(filterOptions);
  }

  /**
   * Get robot messages from a conversation
   * @param conversationId The conversation ID
   * @returns Array of robot messages
   */
  getFilteredRobotMessages(conversationId: string): IConversationMessage[] {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.getFilteredRobotMessages();
  }

  /**
   * Get messages visible to a specific user role
   * @param conversationId The conversation ID
   * @param role The user role to filter for
   * @returns Array of messages visible to the specified role
   */
  getMessagesVisibleToRole(
    conversationId: string,
    role: UserRole,
  ): IConversationMessage[] {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.getMessagesVisibleToRole(role);
  }

  /**
   * Get messages for robot processing from a conversation
   * @param conversationId The conversation ID
   * @returns Array of messages suitable for robot processing
   */
  getMessagesForRobotProcessing(
    conversationId: string,
  ): IConversationMessage[] {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.getMessagesForRobotProcessing();
  }

  /**
   * Get recent messages within a token limit
   * @param conversationId The conversation ID
   * @param maxTokens Maximum number of tokens allowed
   * @param estimateTokens Function to estimate tokens for message content
   * @returns Array of recent messages within token limit
   */
  getRecentMessagesWithinTokenLimit(
    conversationId: string,
    maxTokens: number,
    estimateTokens: (content: string) => number,
  ): IConversationMessage[] {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.getRecentMessagesWithinTokenLimit(
      maxTokens,
      estimateTokens,
    );
  }

  /**
   * Get messages by user from a conversation
   * @param conversationId The conversation ID
   * @param userId The user ID to filter by
   * @returns Array of messages from the specified user
   */
  getMessagesByUser(
    conversationId: string,
    userId: string,
  ): IConversationMessage[] {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.getMessagesByUser(userId);
  }

  /**
   * Get messages by type from a conversation
   * @param conversationId The conversation ID
   * @param messageType The message type to filter by
   * @returns Array of messages of the specified type
   */
  getMessagesByType(
    conversationId: string,
    messageType: MessageType,
  ): IConversationMessage[] {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.getMessagesByType(messageType);
  }

  /**
   * Get the latest message from a conversation
   * @param conversationId The conversation ID
   * @returns The most recent message or undefined if no messages exist
   */
  getLatestMessage(conversationId: string): IConversationMessage | undefined {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return undefined;
    }

    return conversation.getLatestMessage();
  }

  /**
   * Get message counts by type for a conversation
   * @param conversationId The conversation ID
   * @returns Object with counts for each message type
   */
  getMessageCountsByType(conversationId: string): Record<MessageType, number> {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return {
        [MessageType.TEXT]: 0,
        [MessageType.SYSTEM]: 0,
        [MessageType.ROBOT]: 0,
      };
    }

    return conversation.getMessageCountsByType();
  }

  /**
   * Get the message count for a conversation
   * @param conversationId The conversation ID
   * @returns The number of messages in the conversation
   */
  getMessageCount(conversationId: string): number {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) {
      return 0;
    }

    return conversation.getMessageCount();
  }
}
