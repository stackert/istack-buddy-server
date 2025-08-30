import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  CreateMessageDto,
  MessageType,
  UserRole,
} from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import {
  IConversationMessage,
  Conversation,
  Participant,
  DashboardStats,
  IConversationMessageAnthropic,
  IConversationMessageOpenAI,
} from './interfaces/message.interface';
import { v4 as uuidv4 } from 'uuid';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import { TConversationMessageContentString } from '../ConversationLists/types';
import { RobotService } from '../robots/robot.service';
import {
  IStreamingCallbacks,
  TStreamingCallbackMessageOnFullMessageReceived,
} from '../robots/types';

@Injectable()
export class ChatManagerService {
  // In-memory storage for conversation metadata and participants
  private conversationMetadata: Record<string, Conversation> = {};
  private participants: Map<string, Participant[]> = new Map();
  private conversationFormIds: Map<string, string> = new Map(); // Store formId associations
  private gateway: any; // Will be set by the gateway

  constructor(
    private readonly chatConversationListService: ChatConversationListService,
    private readonly robotService: RobotService,
  ) {}

  /**
   * Create conversation callbacks for streaming responses
   * Returns IStreamingCallbacks that add debug messages to the conversation
   */
  createConversationCallbacks(conversationId: string): IStreamingCallbacks {
    let accumulatedContent = '';

    return {
      onStreamChunkReceived: async (
        chunk: string,
        contentType: string = 'text/plain',
      ) => {
        accumulatedContent += chunk;

        // Only broadcast non-empty chunks through gateway
        if (chunk && chunk.trim()) {
          if (this.getGateway()) {
            this.getGateway().broadcastToConversation(
              conversationId,
              'robot_chunk',
              {
                chunk,
              },
            );
          }
        }
      },
      onStreamStart: async (message) => {
        accumulatedContent = '';
      },
      onStreamFinished: async (
        message: IConversationMessage<TConversationMessageContentString>,
      ) => {
        // _TMC_ notice none of the parameters are used
        // onStreamFinished should accept 'final' or 'complete' message
        // it should broadcast with message content type 'stream/finish'
        // onStreamStart should broadcast with message content type 'stream/start'
        // they should use exactly the same messageId

        // Create final robot message and broadcast through gateway
        if (accumulatedContent && accumulatedContent.trim()) {
          const robotMessage = await this.createMessage({
            conversationId: conversationId,
            fromUserId: 'anthropic-marv-robot',
            content: accumulatedContent,
            messageType: MessageType.ROBOT,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.AGENT,
          });

          // Broadcast robot response and completion through gateway
          if (this.getGateway()) {
            this.getGateway()
              .server.to(conversationId)
              .emit('new_message', robotMessage);
            this.getGateway().broadcastToConversation(
              conversationId,
              'robot_complete',
              {
                messageId: robotMessage.id,
              },
            );
          }
        }
      },
      onFullMessageReceived: async (
        message: TStreamingCallbackMessageOnFullMessageReceived,
      ) => {
        // this differs from onStreamFinished - in that clients
        // may listen for either this Event or onStreamFinished.
        // if they subscribe to both they will get duplicate messages (same messageId)

        // Add tool response to conversation database
        await this.addMessage(
          {
            conversationId: conversationId,
            fromUserId: 'anthropic-marv-robot',
            content: message.content.payload,
            messageType: MessageType.TEXT,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.CUSTOMER,
          },
          message.content.type,
        );

        // Create message and broadcast through gateway like onError does
        const fullMessage = await this.createMessage(
          {
            conversationId: conversationId,
            fromUserId: 'anthropic-marv-robot',

            // from public-interface.controller.ts
            messageType: MessageType.TEXT,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.CUSTOMER,

            // from above
            // messageType: MessageType.ROBOT,
            // fromRole: UserRole.ROBOT,
            // toRole: UserRole.AGENT,

            // original
            // messageType: MessageType.TEXT,
            // fromRole: UserRole.AGENT,
            // toRole: UserRole.CUSTOMER,
            content: message.content.payload,
          },
          message.content.type,
        );

        `

         // from public-interface.controller.ts
           conversationId: conversationId,
          fromUserId: 'anthropic-marv-robot',
          messageType: MessageType.TEXT,
          fromRole: UserRole.ROBOT,
          toRole: UserRole.CUSTOMER,
          content: 'DEBUG - Conversation Message II',



        // from above somewhere
            conversationId: conversationId,
            fromUserId: 'anthropic-marv-robot',
            messageType: MessageType.ROBOT,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.AGENT,
            content: accumulatedContent,

`;

        // Broadcast message and completion through gateway
        if (this.getGateway()) {
          this.getGateway()
            .server.to(conversationId)
            .emit('new_message', fullMessage);
          this.getGateway().broadcastToConversation(
            conversationId,
            'robot_complete',
            {
              messageId: fullMessage.id,
            },
          );
        }
      },
      onError: async (error: any) => {
        await this.addMessage({
          conversationId: conversationId,
          fromUserId: 'AnthropicMarv',
          content: 'DEBUG onError',
          messageType: MessageType.TEXT,
          fromRole: UserRole.ROBOT,
          toRole: UserRole.CUSTOMER,
        });

        // Create error message and broadcast through gateway
        const errorMessage = await this.createMessage({
          conversationId: conversationId,
          fromUserId: 'anthropic-marv-robot',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          messageType: MessageType.TEXT,
          fromRole: UserRole.AGENT,
          toRole: UserRole.CUSTOMER,
        });

        // Broadcast error message and completion through gateway
        if (this.getGateway()) {
          this.getGateway()
            .server.to(conversationId)
            .emit('new_message', errorMessage);
          this.getGateway().broadcastToConversation(
            conversationId,
            'robot_complete',
            {
              messageId: errorMessage.id,
            },
          );
        }
      },
    };
  }

  /**
   * Handle robot message from gateway
   * This orchestrates the entire robot interaction flow
   */
  async handleRobotMessage(createMessageDto: CreateMessageDto): Promise<void> {
    const conversationId = createMessageDto.conversationId;
    const userMessage = createMessageDto.content;
    const robotName = 'AnthropicMarv';

    // Create callbacks that handle both debug messages and broadcasting
    const callbacks = this.createConversationCallbacks(conversationId);

    // Handle the robot streaming response
    await this.handleRobotStreamingResponse(
      conversationId,
      robotName,
      userMessage,
      callbacks,
    );
  }

  /**
   * Handle robot streaming response for a conversation
   * This is the proper way to handle robot communication - through the conversation manager
   */
  async handleRobotStreamingResponse(
    conversationId: string,
    robotName: string,
    userMessage: string,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    try {
      // Get the robot
      const robot = this.robotService.getRobotByName(robotName);
      if (!robot) {
        throw new Error(
          `Robot ${robotName} not found for conversation ${conversationId}`,
        );
      }

      // Create conversation message in the correct format
      const conversationMessage: IConversationMessage<TConversationMessageContentString> =
        {
          id: uuidv4(),
          content: {
            type: 'text/plain',
            payload: userMessage,
          },
          conversationId: conversationId,
          authorUserId: 'form-marv-user',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
          messageType: MessageType.TEXT,
          createdAt: new Date(),
          updatedAt: new Date(),
        };



      // Get conversation history for context using the robot's transformer
      const getHistory = () => {
        try {
          return this.getHistory(
            conversationId,
            50,
            robot.getGetFromRobotToConversationTransformer(),
          );
        } catch (error) {
          console.error('Error loading history:', error);
          return [];
        }
      };

      // Use the provided callbacks directly

      // Call robot streaming response
      if ('acceptMessageStreamResponse' in robot) {
        await (robot as any).acceptMessageStreamResponse(
          conversationMessage,
          callbacks,
          getHistory,
        );
      } else {
        throw new Error(
          `Robot ${robotName} does not support streaming responses for conversation ${conversationId}`,
        );
      }
    } catch (error) {
      console.error(
        `Error in handleRobotStreamingResponse for robot ${robotName} in conversation ${conversationId}:`,
        error,
      );
      await callbacks.onError(error);
    }
  }

  // Method to set the gateway reference (called by the gateway)
  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  // Method to get the gateway reference
  getGateway(): any {
    return this.gateway;
  }

  /**
   * Set formId association for a conversation
   */
  setConversationFormId(conversationId: string, formId: string): void {
    this.conversationFormIds.set(conversationId, formId);
  }

  /**
   * Get formId association for a conversation
   */
  getConversationFormId(conversationId: string): string | undefined {
    return this.conversationFormIds.get(conversationId);
  }

  /**
   * Validate that a conversation exists and has the correct formId
   */
  validateConversationFormId(conversationId: string, formId: string): boolean {
    const conversation = this.conversationMetadata[conversationId];
    if (!conversation) {
      return false; // Conversation doesn't exist
    }

    const storedFormId = this.conversationFormIds.get(conversationId);
    return storedFormId === formId;
  }

  /**
   * Generate MD5 hash for message content to detect duplicates
   */
  private generateMessageContentHash(
    createMessageDto: CreateMessageDto,
  ): string {
    const contentToHash = {
      content: createMessageDto.content,
      conversationId: createMessageDto.conversationId,
      fromUserId: createMessageDto.fromUserId,
      fromRole: createMessageDto.fromRole,
      toRole: createMessageDto.toRole,
      messageType: createMessageDto.messageType,
    };

    return createHash('md5')
      .update(JSON.stringify(contentToHash))
      .digest('hex');
  }

  /**
   * Add a message to a conversation
   * This is the core method - all messages go through here
   */
  async addMessage(
    createMessageDto: CreateMessageDto,
    contentType: string = 'text',
  ): Promise<IConversationMessage> {

    const messageId = uuidv4();
    const now = new Date();

    // Ensure conversation exists using centralized method
    await this.ensureConversationExists(
      createMessageDto.conversationId,
      `Conversation ${createMessageDto.conversationId}`,
      `Auto-created conversation for ${createMessageDto.conversationId}`,
      createMessageDto.fromUserId as string,
      createMessageDto.fromRole,
    );

    const message: IConversationMessage = {
      id: messageId,
      content: {
        type: contentType === 'text' ? 'text/plain' : contentType,
        payload: createMessageDto.content,
      } as TConversationMessageContentString,
      conversationId: createMessageDto.conversationId,
      authorUserId: createMessageDto.fromUserId,
      fromRole: createMessageDto.fromRole,
      toRole: createMessageDto.toRole,
      messageType: createMessageDto.messageType || MessageType.TEXT,
      threadId: createMessageDto.threadId,
      originalMessageId: createMessageDto.originalMessageId,
      createdAt: now, // this is 'our' time - the message may have a different creation time
      // using our time makes sense.  The calling code should be guarding
      // against create time overwrite - if that turns out to a an issue
      updatedAt: now,
    };



    // Store the message in the chat conversation list service
    this.chatConversationListService.addMessageToConversation(
      createMessageDto.conversationId,
      message,
    );

    // Update conversation activity
    await this.updateConversationActivity(createMessageDto.conversationId);

    // Broadcast message to WebSocket subscribers
    if (this.gateway) {
      this.gateway.broadcastToConversation(
        createMessageDto.conversationId,
        'new_message',
        {
          message,
          timestamp: now.toISOString(),
        },
      );
    }
    return message;
  }

  /**
   * Legacy method for backward compatibility
   * Redirects to addMessage
   */
  async createMessage(
    createMessageDto: CreateMessageDto,
    contentType: string = 'text',
  ): Promise<IConversationMessage> {
    return this.addMessage(createMessageDto, contentType);
  }

  /**
   * Add a message from Slack and trigger robot response
   * This method handles the common pattern of adding a user message from Slack and automatically triggering the robot
   */
  async addMessageFromSlack(
    conversationId: string,
    content: { type: 'text'; payload: string },
    slackResponseCallback?: (content: {
      type: 'text';
      payload: string;
    }) => Promise<void>,
  ): Promise<IConversationMessage> {


    // Add the user message to the conversation
    const userMessage = await this.addUserMessage(
      conversationId,
      content.payload,
      'cx-slack-robot',
      UserRole.CUSTOMER,
      UserRole.AGENT,
    );



    // Trigger the robot response internally
    try {
      const robot = this.robotService.getRobotByName('SlackyOpenAiAgent')!;

      // Get conversation history for context (using original format for robot callback)
      const conversationHistory = await this.getLastMessages(
        conversationId,
        20,
      );

      // Create message for robot
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: uuidv4(),
        conversationId,
        content: {
          type: 'text/plain',
          payload: content.payload,
        },
        authorUserId: 'cx-slack-robot',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };



      // Create internal callback that handles robot responses
      const internalRobotCallback = async (
        response: Pick<
          IConversationMessage<TConversationMessageContentString>,
          'content'
        >,
      ) => {


        // Defensive check to ensure response has the expected structure
        if (!response || !response.content || !response.content.payload) {
          console.error('Invalid robot response structure:', response);
          return;
        }

        const responseContent = response.content.payload;

        // Add robot response to conversation history
        await this.addRobotResponseFromSlack(conversationId, {
          type: 'text',
          payload: responseContent,
        });

        // If Slack callback is provided, send response to Slack
        if (
          slackResponseCallback &&
          responseContent &&
          responseContent.trim()
        ) {
          await slackResponseCallback({
            type: 'text',
            payload: responseContent,
          });
        }
      };

      // Trigger robot response
      await robot.acceptMessageMultiPartResponse(
        message,
        internalRobotCallback,
        () => conversationHistory,
      );
    } catch (error) {
      console.error(
        `Error triggering robot response for conversation ${conversationId}:`,
        error,
      );
    }
    return userMessage;
  }

  /**
   * Add a message from Marv Session and trigger robot response
   * This method handles the common pattern of adding a user message from form-marv session and automatically triggering the robot
   */
  async addMessageFromMarvSession(
    conversationId: string,
    content: { type: 'text'; payload: string },
  ): Promise<IConversationMessage> {

    // Add the user message to the conversation
    const userMessage = await this.addUserMessage(
      conversationId,
      content.payload,
      'form-marv-user',
      UserRole.CUSTOMER,
      UserRole.AGENT,
    );



    // Trigger the robot response internally
    try {
      // Create conversation callbacks for streaming
      const callbacks = this.createConversationCallbacks(conversationId);



      // Handle robot streaming response
      await this.handleRobotStreamingResponse(
        conversationId,
        'AnthropicMarv',
        content.payload,
        callbacks,
      );

      // Broadcast completion via WebSocket
      if (this.gateway) {
        this.gateway.broadcastToConversation(conversationId, 'robot_complete', {
          message: 'Robot response completed',
        });
      }
    } catch (error) {
      console.error(
        `Error triggering robot response for Marv session in conversation ${conversationId}:`,
        error,
      );
    }


    return userMessage;
  }

  /**
   * Add a robot response message from Slack
   * This method handles the common pattern of adding a robot response message from Slack
   */
  async addRobotResponseFromSlack(
    conversationId: string,
    content: { type: 'text'; payload: string },
  ): Promise<IConversationMessage> {
    return this.addRobotResponse(
      conversationId,
      content.payload,
      'cx-slack-robot',
    );
  }

  /**
   * Add a robot response to a conversation
   */
  async addRobotResponse(
    conversationId: string,
    content: string,
    robotName: string,
  ): Promise<IConversationMessage> {

    const result = await this.addMessage({
      conversationId,
      fromUserId: robotName,
      content,
      messageType: MessageType.ROBOT,
      fromRole: UserRole.ROBOT,
      toRole: UserRole.CUSTOMER,
    });


    return result;
  }

  /**
   * Add a user message to a conversation
   */
  async addUserMessage(
    conversationId: string,
    content: string,
    userId: string,
    fromRole: UserRole = UserRole.CUSTOMER,
    toRole: UserRole = UserRole.AGENT,
  ): Promise<IConversationMessage> {

    const result = await this.addMessage({
      conversationId,
      fromUserId: userId,
      content,
      messageType: MessageType.TEXT,
      fromRole,
      toRole,
    });


    return result;
  }

  /**
   * Get all conversations
   */
  async getConversations(userId?: string): Promise<Conversation[]> {
    let conversations = Object.values(this.conversationMetadata);

    if (userId) {
      // Filter conversations where user is a participant
      conversations = conversations.filter((conv) =>
        conv.participantIds.includes(userId),
      );
    }

    return conversations.sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
    );
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(
    conversationId: string,
  ): Promise<Conversation | undefined> {
    return this.conversationMetadata[conversationId];
  }

  /**
   * Get messages for a conversation with filtering and pagination
   */
  async getMessages(
    conversationId: string,
    query: GetMessagesDto,
  ): Promise<IConversationMessage[]> {
    const conversationList =
      this.chatConversationListService.getConversationById(conversationId);
    if (!conversationList) {
      return [];
    }

    // Get all messages directly from the chat conversation list
    const allMessages = conversationList.getAllChatMessages();

    let filteredMessages = allMessages;

    if (query.threadId) {
      filteredMessages = allMessages.filter(
        (msg) => msg.threadId === query.threadId,
      );
    }

    if (query.userId) {
      filteredMessages = filteredMessages.filter(
        (msg) =>
          msg.authorUserId === query.userId ||
          this.isMessageVisibleToUser(msg, query.userId!),
      );
    }

    const startIndex = query.offset || 0;
    const endIndex = startIndex + (query.limit || 50);

    return filteredMessages.slice(startIndex, endIndex);
  }

  /**
   * Get the last N messages from a conversation
   */
  async getLastMessages(
    conversationId: string,
    count: number,
  ): Promise<IConversationMessage[]> {
    const conversationList =
      this.chatConversationListService.getConversationById(conversationId);

    if (!conversationList) {
      return [];
    }

    // Get all messages and sort them
    const allMessages = conversationList.getAllChatMessages().sort((a, b) => {
      // Primary sort by createdAt timestamp
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      // Secondary sort by message ID for stability when timestamps are identical
      return a.id.localeCompare(b.id);
    });

    // Return the last N messages
    return allMessages.slice(-count);
  }

  /**
   * Generic function to get conversation history with custom transformation
   * @param conversationId The conversation ID
   * @param count Number of messages to return (default: 50)
   * @param transformFn Function to transform each message
   * @returns Transformed messages
   */
  private getHistory<T>(
    conversationId: string,
    count: number = 50,
    transformFn: (msg: IConversationMessage) => T,
  ): T[] {
    const conversationList =
      this.chatConversationListService.getConversationById(conversationId);

    if (!conversationList) {
      return [];
    }

    // Get all messages and sort them
    const allMessages = conversationList.getAllChatMessages().sort((a, b) => {
      // Primary sort by createdAt timestamp
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      // Secondary sort by message ID for stability when timestamps are identical
      return a.id.localeCompare(b.id);
    });

    // Return the last N messages
    const messages = allMessages.slice(-count);

    return messages.map(transformFn);
  }

  /**
   * Get conversation history formatted for Anthropic API
   * Transforms internal message structure to format expected by Anthropic
   */
  getHistoryForAnthropic(
    conversationId: string,
    count: number = 50,
  ): IConversationMessageAnthropic[] {
    return this.getHistory(conversationId, count, (msg) => ({
      role:
        msg.fromRole === UserRole.CUSTOMER || msg.fromRole === UserRole.AGENT
          ? 'user'
          : 'assistant',
      content: (msg.content as TConversationMessageContentString).payload,
    }));
  }

  /**
   * Get conversation history formatted for OpenAI API
   * Transforms internal message structure to format expected by OpenAI
   */
  getHistoryForOpenAI(
    conversationId: string,
    count: number = 50,
  ): IConversationMessageOpenAI[] {
    return this.getHistory(conversationId, count, (msg) => ({
      role:
        msg.fromRole === UserRole.CUSTOMER || msg.fromRole === UserRole.AGENT
          ? 'user'
          : 'assistant',
      content: (msg.content as TConversationMessageContentString).payload,
    }));
  }

  /**
   * Get filtered messages from a conversation based on filter options
   */
  async getFilteredMessages(
    conversationId: string,
    filterOptions: Partial<Omit<IConversationMessage, 'conversationId'>>,
  ): Promise<IConversationMessage[]> {
    return this.chatConversationListService.getFilteredMessages(
      conversationId,
      filterOptions,
    );
  }

  /**
   * Get filtered robot messages from a conversation
   * Returns messages to/from any known robots
   */
  async getFilteredRobotMessages(
    conversationId: string,
  ): Promise<IConversationMessage[]> {
    return this.chatConversationListService.getFilteredRobotMessages(
      conversationId,
    );
  }

  /**
   * Join a conversation as a participant
   */
  async joinConversation(
    conversationId: string,
    joinRoomDto: JoinRoomDto,
  ): Promise<Participant> {

    const conversation = this.conversationMetadata[conversationId];
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const participant: Participant = {
      userId: joinRoomDto.userId,
      userRole: joinRoomDto.userRole,
      joinedAt: new Date(),
    };

    // Get existing participants or create new array
    const existingParticipants = this.participants.get(conversationId) || [];

    // Check if user is already a participant
    const existingParticipant = existingParticipants.find(
      (p) => p.userId === joinRoomDto.userId,
    );

    if (!existingParticipant) {
      // Add new participant
      existingParticipants.push(participant);
      this.participants.set(conversationId, existingParticipants);

      // Update conversation participant lists
      if (!conversation.participantIds.includes(joinRoomDto.userId)) {
        conversation.participantIds.push(joinRoomDto.userId);
        conversation.participantRoles.push(joinRoomDto.userRole);
        this.conversationMetadata[conversationId] = conversation;
      }

      // Broadcast participant added event to dashboard
      if (this.gateway) {
        this.gateway.broadcastToDashboard('conversation_participant_added', {
          conversationId,
          participant,
          action: 'added',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return existingParticipant || participant;
  }

  /**
   * Get participants of a conversation
   */
  async getParticipants(conversationId: string): Promise<Participant[]> {
    return this.participants.get(conversationId) || [];
  }

  /**
   * Remove a participant from a conversation
   */
  async leaveConversation(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const existingParticipants = this.participants.get(conversationId) || [];
    const participantIndex = existingParticipants.findIndex(
      (p) => p.userId === userId,
    );

    if (participantIndex === -1) {
      return false; // User wasn't a participant
    }

    // Remove participant
    const removedParticipant = existingParticipants[participantIndex];
    existingParticipants.splice(participantIndex, 1);
    this.participants.set(conversationId, existingParticipants);

    // Update conversation participant lists
    const conversation = this.conversationMetadata[conversationId];
    if (conversation) {
      const userIndex = conversation.participantIds.indexOf(userId);
      if (userIndex !== -1) {
        conversation.participantIds.splice(userIndex, 1);
        conversation.participantRoles.splice(userIndex, 1);
        this.conversationMetadata[conversationId] = conversation;
      }
    }

    // Broadcast participant removed event to dashboard
    if (this.gateway) {
      this.gateway.broadcastToDashboard('conversation_participant_removed', {
        conversationId,
        participant: removedParticipant,
        action: 'removed',
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const conversations = Object.values(this.conversationMetadata);

    // Count total messages across all conversations
    let totalMessages = 0;
    const recentUserIds = new Set<string>();

    for (const conversationId of this.chatConversationListService.getAllConversationIds()) {
      const conversationList =
        this.chatConversationListService.getConversationById(conversationId);
      if (conversationList) {
        const messages = conversationList.getAllChatMessages();
        totalMessages += messages.length;

        // Check for recent messages to count active users
        for (const message of messages) {
          if (message.createdAt > oneHourAgo && message.authorUserId) {
            recentUserIds.add(message.authorUserId);
          }
        }
      }
    }

    const activeConversations = conversations.filter((c) => c.isActive).length;
    const activeUsers = recentUserIds.size;

    return {
      activeConversations,
      totalMessages,
      activeUsers,
      queuedConversations: 0, // Could be enhanced based on your needs
    };
  }

  /**
   * Start a new conversation
   */
  async startConversation(
    startConversationDto: StartConversationDto,
  ): Promise<Conversation> {
    const conversationId = this.generateId();
    const now = new Date();

    // Create conversation using centralized method
    await this.ensureConversationExists(
      conversationId,
      `Conversation ${conversationId}`,
      `Conversation created by ${startConversationDto.createdBy}`,
      startConversationDto.createdBy,
      startConversationDto.createdByRole,
      startConversationDto.initialParticipants,
    );

    // Get the created conversation metadata
    const conversation = this.conversationMetadata[conversationId];
    if (!conversation) {
      throw new Error(
        `Conversation ${conversationId} not found after creation`,
      );
    }

    // Broadcast conversation created event to dashboard
    if (this.gateway) {
      this.gateway.broadcastToDashboard('conversation_created', {
        conversation,
        createdBy: startConversationDto.createdBy,
        initialParticipants: startConversationDto.initialParticipants || [],
        timestamp: now.toISOString(),
      });
    }

    return conversation;
  }

  /**
   * Get or create a conversation from external source (like Slack)
   */
  async getOrCreateExternalConversation(
    externalConversationId: string,
    createdBy: string,
    source: string = 'external',
    channelName?: string,
  ): Promise<Conversation> {
    // Check if conversation already exists
    const existingConversation =
      this.conversationMetadata[externalConversationId];
    if (existingConversation) {
      return existingConversation;
    }

    // Create conversation using centralized method
    const displayName = channelName
      ? `${source} - ${channelName}`
      : `${source} - ${externalConversationId}`;

    await this.ensureConversationExists(
      externalConversationId,
      displayName,
      `External conversation from ${source}`,
      createdBy,
      UserRole.CUSTOMER, // External users start as customers
    );

    // Get the created conversation metadata
    const conversation = this.conversationMetadata[externalConversationId];
    if (!conversation) {
      throw new Error(
        `External conversation ${externalConversationId} not found after creation`,
      );
    }

    // Broadcast conversation created event to dashboard
    if (this.gateway) {
      const now = new Date();
      this.gateway.broadcastToDashboard('conversation_created', {
        conversation,
        createdBy,
        source,
        displayName,
        timestamp: now.toISOString(),
      });
    }

    return conversation;
  }

  // Private helper methods

  /**
   * Centralized method to ensure a conversation exists in all storage systems
   */
  private async ensureConversationExists(
    conversationId: string,
    displayName: string,
    description: string,
    createdBy?: string,
    createdByRole?: UserRole,
    initialParticipants?: string[],
  ): Promise<void> {
    // Ensure conversation exists in chat conversation list service
    this.chatConversationListService.getConversationOrCreate(conversationId);

    // Ensure conversation metadata exists
    if (!this.conversationMetadata[conversationId]) {
      const now = new Date();
      const conversation: Conversation = {
        id: conversationId,
        participantIds: createdBy ? [createdBy] : [],
        participantRoles: createdByRole ? [createdByRole] : [],
        messageCount: 0,
        lastMessageAt: now,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      this.conversationMetadata[conversationId] = conversation;

      // Add initial participants if provided
      if (initialParticipants && createdBy) {
        for (const participantId of initialParticipants) {
          if (participantId !== createdBy) {
            conversation.participantIds.push(participantId);
            conversation.participantRoles.push(UserRole.CUSTOMER);
          }
        }

        // Create participant list
        const participantList = [
          {
            userId: createdBy,
            userRole: createdByRole || UserRole.CUSTOMER,
            joinedAt: now,
          },
        ];

        for (const participantId of initialParticipants) {
          if (participantId !== createdBy) {
            participantList.push({
              userId: participantId,
              userRole: UserRole.CUSTOMER,
              joinedAt: now,
            });
          }
        }

        this.participants.set(conversationId, participantList);
      } else if (createdBy) {
        // Just add the creator as participant
        this.participants.set(conversationId, [
          {
            userId: createdBy,
            userRole: createdByRole || UserRole.CUSTOMER,
            joinedAt: new Date(),
          },
        ]);
      }
    }
  }

  private generateId(): string {
    return uuidv4();
  }

  private async updateConversationActivity(
    conversationId: string,
  ): Promise<void> {
    const conversation = this.conversationMetadata[conversationId];
    if (!conversation) {
      return;
    }

    // Update conversation statistics
    conversation.messageCount += 1;
    const now = new Date();
    conversation.lastMessageAt = now;
    conversation.updatedAt = now;

    this.conversationMetadata[conversationId] = conversation;

    // Broadcast conversation updated event to dashboard
    if (this.gateway) {
      this.gateway.broadcastToDashboard('conversation_updated', {
        conversationId,
        changes: {
          messageCount: conversation.messageCount,
          lastMessageAt: conversation.lastMessageAt,
          updatedAt: conversation.updatedAt,
        },
        timestamp: now.toISOString(),
      });
    }
  }

  private isMessageVisibleToUser(
    message: IConversationMessage,
    userId: string,
  ): boolean {
    // Simple visibility logic - can be enhanced based on your requirements
    return (
      message.authorUserId === userId ||
      message.toRole === UserRole.CUSTOMER ||
      message.fromRole === UserRole.CUSTOMER
    );
  }
}
