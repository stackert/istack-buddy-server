import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import {
  MessageType,
  UserRole,
  ConversationParticipantRole,
} from '../chat-manager/dto/create-message.dto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Concrete conversation list implementation for chat messages
 * Provides specialized filtering methods for chat functionality
 * Maintains its own storage for IConversationMessage objects
 */
export class ChatConversationList {
  private messages: IConversationMessage[] = [];
  private conversationId?: string;

  constructor() {}

  /**
   * Add a chat message to the conversation list
   * @param message - The IConversationMessage to add
   * @returns The message ID
   */
  addChatMessage(message: IConversationMessage): string {
    this.messages.push(message);

    // Set conversationId from first message if not set
    if (!this.conversationId && message.conversationId) {
      this.conversationId = message.conversationId;
    }

    // Log all messages to file for debugging
    this.logMessagesToFile();

    return message.id;
  }

  /**
   * Get all chat messages in chronological order
   * @returns Array of IConversationMessage objects
   */
  getAllChatMessages(): IConversationMessage[] {
    return [...this.messages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  /**
   * Get messages visible to robots
   * Uses participantVisibility to determine which messages robots should see
   * Falls back to role-based filtering if participantVisibility is not set
   * @returns Array of messages visible to robots
   */
  getFilteredRobotMessages(): IConversationMessage[] {
    return this.getAllChatMessages().filter((msg: IConversationMessage) => {
      // ALWAYS include context documents regardless of visibility/roles
      if (msg.content.type === 'context/document') {
        return true;
      }

      // If participantVisibility is explicitly set, use it
      if (msg.participantVisibility && msg.participantVisibility.length > 0) {
        return (
          msg.participantVisibility.includes(
            ConversationParticipantRole.ROBOT_ALL,
          ) ||
          msg.participantVisibility.includes(
            ConversationParticipantRole.VISIBLE_TO_ALL,
          )
        );
      }

      // Fallback to role-based filtering for backward compatibility
      return (
        // User messages (original requests)
        (msg.fromRole === UserRole.USER && msg.toRole === UserRole.USER) ||
        // Context messages for robots
        (msg.fromRole === UserRole.SYSTEM && msg.toRole === UserRole.ROBOT) ||
        // Messages directed to robots
        (msg.fromRole === UserRole.USER && msg.toRole === UserRole.ROBOT) ||
        // Previous robot responses (for continuity)
        (msg.fromRole === UserRole.ROBOT && msg.toRole === UserRole.USER)
      );
    });
  }

  /**
   * Get messages filtered by multiple criteria
   * @param filterOptions - Object with optional filter criteria
   * @returns Array of messages matching the filter criteria
   */
  getFilteredMessages(
    filterOptions: Partial<Omit<IConversationMessage, 'conversationId'>>,
  ): IConversationMessage[] {
    return this.getAllChatMessages().filter((msg: IConversationMessage) => {
      return Object.entries(filterOptions).every(([key, value]) => {
        if (value === undefined) return true;
        return msg[key as keyof IConversationMessage] === value;
      });
    });
  }

  /**
   * Get the most recent messages up to a token limit
   * Useful for robot context windows
   * @param maxTokens - Maximum number of tokens allowed
   * @param estimateTokens - Function to estimate tokens for a message content
   * @returns Array of recent messages within token limit, in chronological order
   */
  getRecentMessagesWithinTokenLimit(
    maxTokens: number,
    estimateTokens: (content: string) => number,
  ): IConversationMessage[] {
    const messages = this.getAllChatMessages().reverse(); // Most recent first
    const result: IConversationMessage[] = [];
    let totalTokens = 0;

    for (const message of messages) {
      const contentStr = (message.content as any).payload || message.content;
      const messageTokens = estimateTokens(
        typeof contentStr === 'string' ? contentStr : String(contentStr),
      );
      if (totalTokens + messageTokens > maxTokens) {
        break;
      }

      result.unshift(message); // Add to beginning to maintain chronological order
      totalTokens += messageTokens;
    }

    return result;
  }

  /**
   * Get messages sent by a specific user
   * @param userId - The user ID to filter by
   * @returns Array of messages from the specified user
   */
  getMessagesByUser(userId: string): IConversationMessage[] {
    return this.getAllChatMessages().filter(
      (msg: IConversationMessage) => msg.authorUserId === userId,
    );
  }

  /**
   * Get messages within a date range
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @returns Array of messages within the date range
   */
  getMessagesInDateRange(
    startDate: Date,
    endDate: Date,
  ): IConversationMessage[] {
    return this.getAllChatMessages().filter(
      (msg: IConversationMessage) =>
        msg.createdAt >= startDate && msg.createdAt <= endDate,
    );
  }

  /**
   * Get the most recent message in the conversation
   * @returns The most recent message or undefined if no messages exist
   */
  getLatestMessage(): IConversationMessage | undefined {
    const messages = this.getAllChatMessages();
    if (messages.length === 0) {
      return undefined;
    }

    return messages.reduce(
      (latest: IConversationMessage, current: IConversationMessage) =>
        current.createdAt > latest.createdAt ? current : latest,
    );
  }

  /**
   * Get the number of messages in the conversation
   * @returns The count of messages
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Clear all messages from the conversation
   */
  clearAllMessages(): void {
    this.messages = [];
  }

  /**
   * Check if the conversation has any messages
   * @returns True if there are messages, false otherwise
   */
  hasMessages(): boolean {
    return this.messages.length > 0;
  }

  /**
   * Remove a message by ID
   * @param messageId - The ID of the message to remove
   * @returns True if the message was removed, false if not found
   */
  removeMessage(messageId: string): boolean {
    const initialLength = this.messages.length;
    this.messages = this.messages.filter((msg) => msg.id !== messageId);
    return this.messages.length < initialLength;
  }

  /**
   * Log all messages to file for debugging
   * Creates logs/dev-debug-conversations/messages-{conversationId}.json
   */
  private logMessagesToFile(): void {
    if (!this.conversationId) {
      return;
    }

    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.join(process.cwd(), 'logs');
      const devDebugDir = path.join(logsDir, 'dev-debug-conversations');

      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      if (!fs.existsSync(devDebugDir)) {
        fs.mkdirSync(devDebugDir, { recursive: true });
      }

      // Write all messages to file (overwrite each time)
      const filename = `messages-${this.conversationId}.json`;
      const filepath = path.join(devDebugDir, filename);

      const messagesData = {
        conversationId: this.conversationId,
        totalMessages: this.messages.length,
        lastUpdated: new Date().toISOString(),
        messages: this.messages.map((msg) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          authorUserId: msg.authorUserId,
          fromRole: msg.fromRole,
          toRole: msg.toRole,
          content: msg.content,
          participantVisibility: msg.participantVisibility,
          createdAt: msg.createdAt,
          threadId: msg.threadId,
        })),
      };

      fs.writeFileSync(filepath, JSON.stringify(messagesData, null, 2));
    } catch (error) {
      // Don't throw errors for logging - just silently fail
      console.error('Failed to log conversation messages:', error);
    }
  }
}
