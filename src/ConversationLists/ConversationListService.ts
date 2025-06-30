import { Injectable } from '@nestjs/common';
import { AbstractConversationListSlackApp } from './AbstractConversationListSlackApp';
import { ConversationListSlackApp } from './ConversationListSlackApp';

/**
 * Generic service for managing conversation lists
 * Maintains an in-memory dictionary of conversations by their ID
 */
@Injectable()
class ConversationListService<T extends AbstractConversationListSlackApp<any>> {
  private conversations: Map<string, T> = new Map();
  private conversationFactory: (
    id: string,
    name: string,
    description: string,
  ) => T;

  constructor(
    conversationFactory: (id: string, name: string, description: string) => T,
  ) {
    this.conversationFactory = conversationFactory;
  }

  /**
   * Get a conversation by its ID
   * @param conversationId The unique identifier of the conversation
   * @returns The conversation if found, undefined otherwise
   */
  getConversationById(conversationId: string): T | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Get a conversation by ID, or create it if it doesn't exist
   * @param conversationId The unique identifier of the conversation
   * @param name The name for the conversation (used only if creating new)
   * @param description The description for the conversation (used only if creating new)
   * @param acceptKey Optional security key for conversation creation (implement your validation logic)
   * @returns The existing or newly created conversation
   * @throws Error if acceptKey validation fails (when implemented)
   */
  getConversationOrCreate(
    conversationId: string,
    name: string = `Conversation ${conversationId}`,
    description: string = `Auto-created conversation for ${conversationId}`,
    acceptKey?: string,
  ): T {
    // Check if conversation already exists
    const existingConversation = this.conversations.get(conversationId);
    if (existingConversation) {
      return existingConversation;
    }

    // TODO: Implement acceptKey validation logic here
    // This is where you would validate the acceptKey before allowing creation
    // For now, we'll just log a warning if acceptKey is provided but not validated
    if (acceptKey) {
      console.warn(
        `AcceptKey provided but validation not implemented: ${acceptKey}`,
      );
      // Throw error if you want to require acceptKey validation:
      // throw new Error('AcceptKey validation required for conversation creation');
    }

    // Create new conversation
    const newConversation = this.conversationFactory(
      conversationId,
      name,
      description,
    );
    this.conversations.set(conversationId, newConversation);

    return newConversation;
  }

  /**
   * Check if a conversation exists
   * @param conversationId The unique identifier of the conversation
   * @returns True if the conversation exists, false otherwise
   */
  hasConversation(conversationId: string): boolean {
    return this.conversations.has(conversationId);
  }

  /**
   * Remove a conversation from the service
   * @param conversationId The unique identifier of the conversation to remove
   * @returns True if the conversation was removed, false if it didn't exist
   */
  removeConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  /**
   * Get all conversation IDs
   * @returns Array of all conversation IDs
   */
  getAllConversationIds(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Get all conversations
   * @returns Array of all conversation instances
   */
  getAllConversations(): T[] {
    return Array.from(this.conversations.values());
  }

  /**
   * Get the number of conversations currently managed
   * @returns The count of conversations
   */
  getConversationCount(): number {
    return this.conversations.size;
  }

  /**
   * Clear all conversations from the service
   * Use with caution - this will remove all conversation data
   */
  clearAllConversations(): void {
    this.conversations.clear();
  }
}

/**
 * Concrete implementation of ConversationListService for Slack App conversations
 */
@Injectable()
class ConversationListSlackAppService extends ConversationListService<ConversationListSlackApp> {
  constructor() {
    super((id: string, name: string, description: string) => {
      return new ConversationListSlackApp(id, name, description);
    });
  }

  /**
   * Create a customer support conversation with predefined naming conventions
   * @param conversationId The unique identifier of the conversation
   * @param customerId The customer ID for context
   * @param acceptKey Optional security key for conversation creation
   * @returns The existing or newly created conversation
   */
  getCustomerSupportConversationOrCreate(
    conversationId: string,
    customerId: string,
    acceptKey?: string,
  ): ConversationListSlackApp {
    const name = `Customer Support - ${customerId}`;
    const description = `Customer support conversation for customer ${customerId}`;

    return this.getConversationOrCreate(
      conversationId,
      name,
      description,
      acceptKey,
    );
  }

  /**
   * Create a team conversation with predefined naming conventions
   * @param conversationId The unique identifier of the conversation
   * @param teamName The team name for context
   * @param acceptKey Optional security key for conversation creation
   * @returns The existing or newly created conversation
   */
  getTeamConversationOrCreate(
    conversationId: string,
    teamName: string,
    acceptKey?: string,
  ): ConversationListSlackApp {
    const name = `Team Chat - ${teamName}`;
    const description = `Team conversation for ${teamName}`;

    return this.getConversationOrCreate(
      conversationId,
      name,
      description,
      acceptKey,
    );
  }
}

export { ConversationListService, ConversationListSlackAppService };
