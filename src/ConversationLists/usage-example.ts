/**
 * Usage Example: ConversationListService in NestJS
 *
 * This file demonstrates how to use the ConversationListService
 * in a NestJS application with proper dependency injection.
 */

import { Injectable, Controller, Get, Post, Body, Param } from '@nestjs/common';
import {
  ConversationListSlackAppService,
  ConversationMessageFactory,
} from './index';

// Example DTO for creating messages
interface CreateMessageDto {
  authorId: string;
  content: string;
  authorRole: 'cx-customer' | 'cx-agent' | 'robot';
}

// Example controller showing how to use the service
@Controller('conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationListSlackAppService,
  ) {}

  @Get(':id')
  getConversation(@Param('id') conversationId: string) {
    const conversation =
      this.conversationService.getConversationById(conversationId);

    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    return {
      id: conversation.id,
      name: conversation.name,
      description: conversation.description,
      messageCount: conversation.getMessageCount(),
      messages: conversation.getAllMessages(),
    };
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') conversationId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    // Get or create conversation
    const conversation = this.conversationService.getConversationOrCreate(
      conversationId,
      `Conversation ${conversationId}`,
      `Auto-created conversation for ${conversationId}`,
    );

    // Create message based on author role
    let message;
    switch (createMessageDto.authorRole) {
      case 'cx-customer':
        message = ConversationMessageFactory.createCustomerMessage(
          `msg-${Date.now()}`,
          createMessageDto.authorId,
          createMessageDto.content,
        );
        break;
      case 'cx-agent':
        message = ConversationMessageFactory.createAgentMessage(
          `msg-${Date.now()}`,
          createMessageDto.authorId,
          createMessageDto.content,
        );
        break;
      case 'robot':
        message = ConversationMessageFactory.createRobotMessage(
          `msg-${Date.now()}`,
          createMessageDto.authorId,
          { type: 'text/plain', payload: createMessageDto.content },
        );
        break;
      default:
        return { error: 'Invalid author role' };
    }

    // Add message to conversation
    const addedMessage = conversation.addMessage(message);

    return {
      success: true,
      message: {
        id: addedMessage.id,
        content: addedMessage.content,
        authorRole: addedMessage.authorRole,
        createdAt: addedMessage.createdAt,
      },
      conversationSummary: {
        totalMessages: conversation.getMessageCount(),
        conversationId: conversation.id,
      },
    };
  }

  @Get(':id/customer-support')
  createCustomerSupportConversation(
    @Param('id') conversationId: string,
    @Body('customerId') customerId: string,
  ) {
    const conversation =
      this.conversationService.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
      );

    return {
      id: conversation.id,
      name: conversation.name,
      description: conversation.description,
      type: 'customer-support',
    };
  }

  @Get()
  getAllConversations() {
    return {
      conversations: this.conversationService
        .getAllConversationIds()
        .map((id) => {
          const conversation =
            this.conversationService.getConversationById(id)!;
          return {
            id: conversation.id,
            name: conversation.name,
            messageCount: conversation.getMessageCount(),
            lastMessage: conversation.getMostRecentMessage(),
          };
        }),
      totalCount: this.conversationService.getConversationCount(),
    };
  }
}

// Example service that uses the conversation service
@Injectable()
export class ChatService {
  constructor(
    private readonly conversationService: ConversationListSlackAppService,
  ) {}

  async processCustomerMessage(
    conversationId: string,
    customerId: string,
    message: string,
  ) {
    // Get or create customer support conversation
    const conversation =
      this.conversationService.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
      );

    // Add customer message
    const customerMessage = ConversationMessageFactory.createCustomerMessage(
      `msg-${Date.now()}`,
      customerId,
      message,
    );
    conversation.addMessage(customerMessage);

    // Process robot response (example)
    const robotResponse = await this.generateRobotResponse(conversation);
    if (robotResponse) {
      const robotMessage = ConversationMessageFactory.createRobotMessage(
        `robot-msg-${Date.now()}`,
        'assistant-robot',
        { type: 'text/plain', payload: robotResponse },
      );
      conversation.addMessage(robotMessage);
    }

    return {
      conversationId: conversation.id,
      customerMessage: customerMessage,
      robotResponse: robotResponse,
      totalMessages: conversation.getMessageCount(),
    };
  }

  private async generateRobotResponse(
    conversation: any,
  ): Promise<string | null> {
    // This is where you'd integrate with your AI/robot system
    // For example, you could use the conversation's getMessagesForRobotProcessing()
    // method to get relevant messages for the robot to process

    const robotMessages = conversation.getMessagesForRobotProcessing();

    // Simulate robot processing
    if (robotMessages.length > 0) {
      const lastMessage = robotMessages[robotMessages.length - 1];
      return `Robot response to: "${lastMessage.content.payload}"`;
    }

    return null;
  }
}

/**
 * Example Module Configuration
 *
 * To use these services in your NestJS application, configure your module like this:
 */

/*
import { Module } from '@nestjs/common';
import { ConversationListServiceModule } from './ConversationLists';
import { ConversationController, ChatService } from './usage-example';

@Module({
  imports: [ConversationListServiceModule],
  controllers: [ConversationController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
*/

// Note: These are example classes - export them in your actual implementation
