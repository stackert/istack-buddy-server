import { Injectable } from '@nestjs/common';
import { ConversationListService } from './ConversationListService';
import { ConversationListSlackApp } from './ConversationListSlackApp';

/**
 * Concrete implementation of ConversationListService for Slack App conversations
 */
@Injectable()
export class ConversationListSlackAppService extends ConversationListService<ConversationListSlackApp> {
  constructor() {
    super((id: string, name: string, description: string) => {
      return new ConversationListSlackApp();
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
