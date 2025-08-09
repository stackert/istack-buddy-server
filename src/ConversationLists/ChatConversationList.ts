import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';

/**
 * Concrete conversation list implementation for chat messages
 * Provides specialized filtering methods for chat functionality
 * Maintains its own storage for IConversationMessage objects
 */
export class ChatConversationList {
  private messages: IConversationMessage[] = [];

  constructor() {}

  /**
   * Add a chat message to the conversation list
   * @param message - The IConversationMessage to add
   * @returns The message ID
   */
  addChatMessage(message: IConversationMessage): string {
    this.messages.push(message);

    console.log({ allConversationMessages: this.messages });
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
   * Get all robot messages in the conversation
   * Returns messages to/from any known robots (matches original ChatManagerService logic)
   * @returns Array of robot messages
   */
  getFilteredRobotMessages(): IConversationMessage[] {
    return this.getAllChatMessages().filter((msg: IConversationMessage) => {
      const isRobotRole =
        msg.fromRole === UserRole.ROBOT || msg.toRole === UserRole.ROBOT;
      const isRobotType = msg.messageType === MessageType.ROBOT;
      const isKnownRobotUserId =
        msg.fromUserId &&
        (msg.fromUserId.includes('robot') ||
          msg.fromUserId === 'cx-slack-robot');

      return isRobotRole || isRobotType || isKnownRobotUserId;
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
   * Get messages visible to a specific user role based on visibility rules
   * @param role - The user role to filter for
   * @returns Array of messages visible to the specified role
   */
  getMessagesVisibleToRole(role: UserRole): IConversationMessage[] {
    const messages = this.getAllChatMessages();

    switch (role) {
      case UserRole.CUSTOMER:
        // Customers see their own messages and shared messages from agents
        // Robot messages are never directly visible to customers
        return messages.filter(
          (msg: IConversationMessage) =>
            msg.fromRole === UserRole.CUSTOMER ||
            (msg.fromRole === UserRole.AGENT &&
              msg.messageType !== MessageType.ROBOT),
        );

      case UserRole.AGENT:
      case UserRole.SUPERVISOR:
        // Agents and supervisors see all messages
        return messages;

      default:
        return [];
    }
  }

  /**
   * Get messages that should be sent to robots for processing
   * Robots need context from previous robot responses and messages from agents/supervisors
   * @returns Array of messages suitable for robot processing
   */
  getMessagesForRobotProcessing(): IConversationMessage[] {
    return this.getAllChatMessages().filter((msg: IConversationMessage) => {
      // Include robot messages for context
      if (msg.messageType === MessageType.ROBOT) {
        return true;
      }

      // Include messages from roles that can interact with robots
      if ([UserRole.AGENT, UserRole.SUPERVISOR].includes(msg.fromRole)) {
        return true;
      }

      return false;
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
      (msg: IConversationMessage) => msg.fromUserId === userId,
    );
  }

  /**
   * Get messages of a specific type
   * @param messageType - The message type to filter by
   * @returns Array of messages of the specified type
   */
  getMessagesByType(messageType: MessageType): IConversationMessage[] {
    return this.getAllChatMessages().filter(
      (msg: IConversationMessage) => msg.messageType === messageType,
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
   * Count messages by type
   * @returns Object with counts for each message type
   */
  getMessageCountsByType(): Record<MessageType, number> {
    const messages = this.getAllChatMessages();
    const counts = {
      [MessageType.TEXT]: 0,
      [MessageType.SYSTEM]: 0,
      [MessageType.ROBOT]: 0,
    };

    messages.forEach((msg: IConversationMessage) => {
      counts[msg.messageType]++;
    });

    return counts;
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
}
