import { AbstractConversationListSlackApp } from './AbstractConversationListSlackApp';
import { AbstractConversationListItem } from './AbstractConversationListItem';
import type {
  TConversationListItem,
  TConversationItemAuthorRoles,
  TSupportedContentTypes,
} from './types';

/**
 * Concrete implementation of a conversation list item (message)
 */
class ConversationListItem
  extends AbstractConversationListItem
  implements TConversationListItem
{
  constructor(
    id: string,
    authorId: string,
    authorRole: TConversationItemAuthorRoles,
    content: { type: TSupportedContentTypes; payload: any },
    createdAt: Date,
    updatedAt: Date,
    estimatedTokenCount: number,
    roleVisibilities: TConversationItemAuthorRoles[],
  ) {
    super(
      id,
      authorId,
      authorRole,
      content,
      createdAt,
      updatedAt,
      estimatedTokenCount,
      roleVisibilities,
    );
  }
}

/**
 * Factory class for creating conversation messages
 */
class ConversationMessageFactory {
  /**
   * Create a new message with automatic visibility settings based on author role
   */
  static createMessage(
    messageId: string,
    authorId: string,
    authorRole: TConversationItemAuthorRoles,
    content: { type: TSupportedContentTypes; payload: any },
    estimatedTokenCount: number = 0,
    customVisibilities?: TConversationItemAuthorRoles[],
  ): ConversationListItem {
    const visibilities =
      customVisibilities ||
      AbstractConversationListItem.getDefaultVisibilities(authorRole);

    return new ConversationListItem(
      messageId,
      authorId,
      authorRole,
      content,
      new Date(),
      new Date(),
      estimatedTokenCount,
      visibilities,
    );
  }

  /**
   * Create a customer message
   */
  static createCustomerMessage(
    messageId: string,
    customerId: string,
    textContent: string,
    estimatedTokenCount: number = 0,
  ): ConversationListItem {
    return this.createMessage(
      messageId,
      customerId,
      'cx-customer',
      { type: 'text/plain', payload: textContent },
      estimatedTokenCount,
    );
  }

  /**
   * Create an agent message
   */
  static createAgentMessage(
    messageId: string,
    agentId: string,
    textContent: string,
    estimatedTokenCount: number = 0,
  ): ConversationListItem {
    return this.createMessage(
      messageId,
      agentId,
      'cx-agent',
      { type: 'text/plain', payload: textContent },
      estimatedTokenCount,
    );
  }

  /**
   * Create a robot message (not visible to customer)
   */
  static createRobotMessage(
    messageId: string,
    robotId: string,
    content: { type: TSupportedContentTypes; payload: any },
    estimatedTokenCount: number = 0,
  ): ConversationListItem {
    return this.createMessage(
      messageId,
      robotId,
      'robot',
      content,
      estimatedTokenCount,
    );
  }

  /**
   * Create a shared robot message (visible to customer)
   * This is used when an agent wants to share a robot response with the customer
   */
  static createSharedRobotMessage(
    messageId: string,
    robotId: string,
    content: { type: TSupportedContentTypes; payload: any },
    estimatedTokenCount: number = 0,
  ): ConversationListItem {
    return this.createMessage(
      messageId,
      robotId,
      'cx-robot',
      content,
      estimatedTokenCount,
      AbstractConversationListItem.getSharedRobotVisibilities(),
    );
  }

  /**
   * Create a private supervisor message (not visible to customer)
   */
  static createSupervisorMessage(
    messageId: string,
    supervisorId: string,
    textContent: string,
    estimatedTokenCount: number = 0,
  ): ConversationListItem {
    return this.createMessage(
      messageId,
      supervisorId,
      'cx-supervisor',
      { type: 'text/plain', payload: textContent },
      estimatedTokenCount,
    );
  }

  /**
   * Create a shared version of a robot message for customer visibility
   */
  static createSharedVersionOfRobotMessage(
    originalRobotMessage: ConversationListItem,
    sharedMessageId: string,
  ): ConversationListItem {
    if (originalRobotMessage.authorRole !== 'robot') {
      throw new Error('Can only share robot messages');
    }

    return this.createSharedRobotMessage(
      sharedMessageId,
      originalRobotMessage.authorId,
      originalRobotMessage.content,
      originalRobotMessage.estimatedTokenCount,
    );
  }
}

/**
 * Concrete implementation of a conversation list
 * Focuses on managing messages, not creating them
 */
class ConversationListSlackApp extends AbstractConversationListSlackApp<ConversationListItem> {
  constructor(
    id: string,
    name: string,
    description: string,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date(),
  ) {
    super(id, name, description, createdAt, updatedAt);
  }

  /**
   * Add a pre-created message to the conversation
   */
  addMessage(message: ConversationListItem): ConversationListItem {
    this.appendConversationMessage(message);
    return message;
  }

  /**
   * Add an agent message to the conversation
   */
  addAgentMessage(
    messageId: string,
    agentId: string,
    textContent: string,
    estimatedTokenCount: number = 0,
  ): ConversationListItem {
    const message = ConversationMessageFactory.createAgentMessage(
      messageId,
      agentId,
      textContent,
      estimatedTokenCount,
    );
    return this.addMessage(message);
  }

  /**
   * Add a robot message to the conversation (not visible to customer)
   */
  addRobotMessage(
    messageId: string,
    robotId: string,
    content: { type: TSupportedContentTypes; payload: any },
    estimatedTokenCount: number = 0,
  ): ConversationListItem {
    const message = ConversationMessageFactory.createRobotMessage(
      messageId,
      robotId,
      content,
      estimatedTokenCount,
    );
    return this.addMessage(message);
  }
}

/**
 * Factory class for creating conversation lists
 */
class ConversationListFactory {
  static createConversation(
    id: string,
    name: string,
    description: string,
  ): ConversationListSlackApp {
    return new ConversationListSlackApp(id, name, description);
  }

  static createCustomerSupportConversation(
    conversationId: string,
    customerId: string,
  ): ConversationListSlackApp {
    return new ConversationListSlackApp(
      conversationId,
      `Customer Support - ${customerId}`,
      `Customer support conversation for customer ${customerId}`,
    );
  }
}

export {
  ConversationListSlackApp,
  ConversationListItem,
  ConversationListFactory,
  ConversationMessageFactory,
};
