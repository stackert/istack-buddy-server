import type {
  TConversationListItem,
  TConversationItemAuthorRoles,
  TSupportedContentTypes,
} from './types';

/**
 * Abstract base class for managing conversation lists with role-based visibility.
 * Handles message storage, filtering, and visibility rules for multi-party chat systems.
 */
class AbstractConversationListSlackApp<T extends TConversationListItem> {
  private messages: T[] = [];
  private lastSummarizedIndex: number = -1; // Track last summarized position
  private lastSummarizedAt: Date | null = null; // Track last summary timestamp

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  appendConversationMessage(message: T): void {
    this.messages.push(message);
  }

  // at this time, it does not make sense to 'delete' or 'remove' messages
  // we can change visibility role.
  filterByRoleVisibilities(roles: TConversationItemAuthorRoles[]): T[] {
    return this.messages.filter((message) =>
      roles.some((role) => message.roleVisibilities.includes(role)),
    );
  }

  /**
   * Get messages that need to be summarized (from last summarized position to current)
   */
  getMessagesToSummarize(): T[] {
    const startIndex = this.lastSummarizedIndex + 1;
    return this.messages.slice(startIndex);
  }

  /**
   * Mark messages as summarized up to a specific index
   */
  markSummarizedUpTo(index: number): void {
    if (index >= 0 && index < this.messages.length) {
      this.lastSummarizedIndex = index;
      this.lastSummarizedAt = new Date();
    }
  }

  /**
   * Mark all current messages as summarized
   */
  markAllAsSummarized(): void {
    this.lastSummarizedIndex = this.messages.length - 1;
    this.lastSummarizedAt = new Date();
  }

  /**
   * Get the last summarized index
   */
  getLastSummarizedIndex(): number {
    return this.lastSummarizedIndex;
  }

  /**
   * Get the last summarized timestamp
   */
  getLastSummarizedAt(): Date | null {
    return this.lastSummarizedAt;
  }

  getAllMessages(): T[] {
    return [...this.messages];
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get messages visible to cx-agent role
   * cx-agent should see most messages including robot interactions
   */
  getAgentVisibleMessages(): T[] {
    return this.filterByRoleVisibilities(['cx-agent']);
  }

  /**
   * Get only robot messages (for AI processing)
   * These are direct robot responses, not shared with customers
   */
  getRobotMessages(): T[] {
    return this.messages.filter((message) => message.authorRole === 'robot');
  }

  /**
   * Get messages intended for robot processing
   * Robots should see:
   * - Messages sent TO robots (by agents/supervisors who can interact with robots)
   * - Previous messages FROM robots (for context)
   * - Messages explicitly marked as visible to robots
   */
  getMessagesForRobotProcessing(): T[] {
    return this.messages.filter((message) => {
      // Messages from robots (for context)
      if (message.authorRole === 'robot') {
        return true;
      }

      // Messages explicitly visible to robots
      if (message.roleVisibilities.includes('robot')) {
        return true;
      }

      // Messages from roles that can interact with robots
      if (
        ['cx-agent', 'cx-supervisor', 'conversation-admin'].includes(
          message.authorRole,
        )
      ) {
        return true;
      }

      return false;
    });
  }

  /**
   * Calculate total estimated token count for robot processing
   */
  calculateTotalTokenCountForRobot(): number {
    return this.getMessagesForRobotProcessing().reduce(
      (total, message) => total + message.estimatedTokenCount,
      0,
    );
  }

  /**
   * Get the most recent message in the conversation
   * Returns null if there are no messages
   */
  getMostRecentMessage(): T | null {
    if (this.messages.length === 0) {
      return null;
    }
    return this.messages[this.messages.length - 1];
  }

  /**
   * Utility method to check if a role can interact with robots
   */
  static canInteractWithRobots(role: TConversationItemAuthorRoles): boolean {
    return ['cx-agent', 'cx-supervisor', 'conversation-admin'].includes(role);
  }
}

export { AbstractConversationListSlackApp };
