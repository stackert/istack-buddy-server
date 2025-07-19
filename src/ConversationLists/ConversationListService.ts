import { Injectable } from '@nestjs/common';
import { AbstractConversationMessageList } from './AbstractConversationMessageList';

/**
 * Generic service for managing conversation lists
 * Maintains an in-memory dictionary of conversations by their ID
 */
@Injectable()
export class ConversationListService<
  T extends AbstractConversationMessageList<any>,
> {
  conversations: Record<string, T> = {};
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
    return this.conversations[conversationId];
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
    acceptKey?: string, // what is the point of 'acceptKey'?
  ): T {
    // Check if conversation already exists
    const existingConversation = this.conversations[conversationId];
    if (existingConversation) {
      return existingConversation;
    }

    // TODO: Implement acceptKey validation logic here
    // This is where you would validate the acceptKey before allowing creation
    if (acceptKey) {
      // For now, we'll just log a warning if acceptKey is provided but not validated
      // Throw error if you want to require acceptKey validation:
      // throw new Error('AcceptKey validation required for conversation creation');
    }

    // Create new conversation
    const newConversation = this.conversationFactory(
      conversationId,
      name,
      description,
    );
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
  getAllConversations(): T[] {
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
}
