import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import {
  TConversationMessageContentString,
  TConversationMessageContentMarkdown,
  TConversationMessageContent,
} from '../ConversationLists/types';
import { RobotService } from '../robots/robot.service';
import {
  IStreamingCallbacks,
  TStreamingCallbackMessageOnFullMessageReceived,
} from '../robots/types';
import { IntentParsingService } from '../common/services/intent-parsing.service';
import { IntentRouterService } from '../common/services/intent-router.service';
import {
  IntentParsingResult,
  IntentParsingResponse,
  IntentParsingError,
} from '../common/types/intent-parsing.types';
import {
  CreateMessageDto,
  MessageType,
  UserRole,
  RobotName,
} from './dto/create-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import {
  Conversation,
  DashboardStats,
  IConversationMessage,
  IConversationMessageAnthropic,
  IConversationMessageOpenAI,
  Participant,
} from './interfaces/message.interface';

// Client Registration Interfaces
interface ConversationClient {
  type: 'slack' | 'websocket';
  conversationId: string;
  clientId: string;
  sendMessage: (content: { type: 'text'; payload: string }) => Promise<void>;
  decorateMessage: (message: IConversationMessage) => {
    type: 'text';
    payload: string;
  };
}

@Injectable()
export class ChatManagerService {
  private readonly logger = new Logger(ChatManagerService.name);

  // In-memory storage for conversation metadata and participants
  private conversationMetadata: Record<string, Conversation> = {};
  private participants: Map<string, Participant[]> = new Map();
  private conversationFormIds: Map<string, string> = new Map(); // Store formId associations
  private gateway: any; // Will be set by the gateway

  // Client Registration System - track all clients per conversation
  private conversationClients: Map<string, ConversationClient[]> = new Map();
  private readonly intentParsingService: IntentParsingService;

  constructor(
    private readonly chatConversationListService: ChatConversationListService,
    private readonly robotService: RobotService,
    private readonly intentRouterService: IntentRouterService,
  ) {
    this.intentParsingService = new IntentParsingService();
  }

  /**
   * Create conversation callbacks for streaming responses
   * Returns IStreamingCallbacks that add debug messages to the conversation
   */
  createConversationCallbacks(conversationId: string): IStreamingCallbacks {
    let accumulatedContent = '';

    return {
      conversationId,
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
            content: {
              type: 'text/plain',
              payload: accumulatedContent,
            },
            fromRole: UserRole.ROBOT,
            toRole: UserRole.USER,
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
        // Create and send message for dev/debug
        const fullMessage = await this.createMessage({
          conversationId: conversationId,
          fromUserId: 'intent-handler-robot',
          content: {
            type: 'text/plain',
            payload: message.content.payload,
          },
          fromRole: UserRole.ROBOT,
          toRole: UserRole.USER,
        });

        // Broadcast message through gateway for dev/debug
        if (this.getGateway()) {
          this.getGateway()
            .server.to(conversationId)
            .emit('new_message', fullMessage);
        }
      },
      onError: async (error: any) => {
        // Remove the DEBUG onError message - it's not helpful
        // The actual error message will be sent below

        // Create error message and broadcast through gateway
        const errorMessage = await this.createMessage({
          conversationId: conversationId,
          fromUserId: 'anthropic-marv-robot',
          content: {
            type: 'text/plain',
            payload: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
          fromRole: UserRole.USER,
          toRole: UserRole.USER,
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
    const userMessage = String(
      createMessageDto.content.payload || 'No content',
    );

    // Create callbacks that handle both debug messages and broadcasting
    const callbacks = this.createConversationCallbacks(conversationId);

    try {
      // Step 1: Parse intent to determine appropriate robot
      const intentResult = await this.intentParsingService.parsePromptIntent(
        userMessage,
        { currentRobot: undefined }, // Could be enhanced with conversation context
      );

      // Step 2: Extract intent data from parsing result
      let intentData: any = null;

      if ('error' in intentResult) {
        // Intent parsing failed, fallback to existing behavior
        this.logger.warn(
          `Intent parsing failed: ${intentResult.error}. Falling back to AnthropicMarv`,
        );
      } else {
        // Intent parsing succeeded, extract intent data
        intentData = (intentResult as IntentParsingResponse).intentData;
        this.logger.log(
          `Intent parsing succeeded with intent: ${(intentResult as IntentParsingResponse).intent}`,
        );
      }

      // Step 3: Route intent through intent router
      if ('error' in intentResult) {
        // Fallback to existing robot behavior for errors
        await this.handleRobotStreamingResponse(
          conversationId,
          'AnthropicMarv',
          userMessage, // userMessage is already the payload string
          callbacks,
        );
      } else {
        // Route through intent router (handles both intent handlers and robots)
        // Add intent and conversationId to intentData and route
        const intentDataWithConversation = {
          ...intentResult.intentData,
          intent: intentResult.intent,
          conversationId: conversationId,
        };
        await this.intentRouterService.routeIntent(intentDataWithConversation);
      }
    } catch (error) {
      this.logger.error(
        `Error in handleRobotMessage: ${error.message}. Falling back to AnthropicMarv`,
      );

      // Fallback to existing behavior on any error
      await this.handleRobotStreamingResponse(
        conversationId,
        'AnthropicMarv',
        userMessage, // userMessage is already the payload string
        callbacks,
      );
    }
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
          fromRole: UserRole.USER,
          toRole: UserRole.USER,
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
          this.logger.error('Error loading history:', error);
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
      this.logger.error(
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
    };

    return createHash('md5')
      .update(JSON.stringify(contentToHash))
      .digest('hex');
  }

  /**
   * ConversationManager Methods - as specified in the plan
   */

  /**
   * Send system message (acknowledgments, status updates, progress notifications)
   * Role: SYSTEM → USER
   */
  async addMessageSystemNotification(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // 1. Store message
    const message = await this.storeMessage({
      conversationId,
      fromUserId: 'system',
      content,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.USER,
    });

    // 2. Broadcast to all clients
    await this.broadcastMessage(message);
  }

  /**
   * Add context for robot processing
   * Role: SYSTEM → ROBOT
   */
  async addMessageAsContext(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // 1. Store message
    const message = await this.storeMessage({
      conversationId,
      fromUserId: 'system',
      content,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.ROBOT,
    });

    // 2. Broadcast to all clients
    await this.broadcastMessage(message);
  }

  /**
   * Add robot prompt (triggers robot response)
   * Role: SYSTEM → ROBOT
   */
  async addMessageRequestRobotResponse(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // 1. Store message
    const message = await this.storeMessage({
      conversationId,
      fromUserId: 'system',
      content,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.ROBOT,
    });

    // 2. Broadcast to all clients
    await this.broadcastMessage(message);

    // TODO: Trigger robot response processing
  }

  /**
   * Add robot response message - new conversation method
   * Role: ROBOT → USER
   */
  async addMessageResponseFromRobot(
    conversationId: string,
    content: TConversationMessageContent,
    fromUserId: string = 'robot',
  ): Promise<void> {
    // 1. Store message
    const message = await this.storeMessage({
      conversationId,
      fromUserId,
      content,
      fromRole: UserRole.ROBOT,
      toRole: UserRole.USER,
    });

    // 2. Broadcast to all clients
    await this.broadcastMessage(message);
  }

  /**
   * Add error notification message
   * Role: SYSTEM → USER
   */
  async addMessageErrorNotification(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // 1. Store message
    const message = await this.storeMessage({
      conversationId,
      fromUserId: 'system-error',
      content,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.USER,
    });

    // 2. Broadcast to all clients
    await this.broadcastMessage(message);
  }

  /**
   * Unified message broadcasting to ALL clients (Slack + WebSocket)
   * ONLY broadcasts - does NOT store messages
   */
  private async broadcastMessage(message: IConversationMessage): Promise<void> {
    // Get all registered clients for this conversation
    const clients = this.conversationClients.get(message.conversationId) || [];

    // Apply system filter to determine which clients should receive this message
    const filteredClients = clients.filter((client) =>
      this.systemMessageFilter(message, client),
    );

    // Broadcast to each filtered client with decoration
    await Promise.all(
      filteredClients.map(async (client) => {
        try {
          const decoratedMessage = client.decorateMessage(message);
          await client.sendMessage(decoratedMessage);
        } catch (error) {
          this.logger.error(
            `Failed to send message to ${client.type} client: ${error.message}`,
          );
        }
      }),
    );

    this.logger.debug(
      `Message broadcasted to ${filteredClients.length}/${clients.length} clients for conversation ${message.conversationId}`,
    );
  }

  /**
   * System filter - determines which clients should receive which messages
   * No-op for now - ALL MESSAGES GO TO ALL CLIENTS
   */
  private systemMessageFilter(
    message: IConversationMessage,
    client: ConversationClient,
  ): boolean {
    // No-op passthrough filter - all messages go to all clients
    return true;
  }

  /**
   * Private method to store message - INTERNAL USE ONLY
   */
  private async storeMessage(
    createMessageDto: CreateMessageDto,
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
      content: createMessageDto.content,
      conversationId: createMessageDto.conversationId,
      authorUserId: createMessageDto.fromUserId,
      fromRole: createMessageDto.fromRole,
      toRole: createMessageDto.toRole,
      threadId: createMessageDto.threadId,
      originalMessageId: createMessageDto.originalMessageId,
      createdAt: now,
      updatedAt: now,
    };

    // Store the message in the chat conversation list service
    this.chatConversationListService.addMessageToConversation(
      createMessageDto.conversationId,
      message,
    );

    // Update conversation activity
    await this.updateConversationActivity(createMessageDto.conversationId);

    return message;
  }

  /**
   * Register Slack client for conversation
   * Called automatically when Slack message is received
   */
  private registerSlackClient(
    conversationId: string,
    slackCallback: (content: {
      type: 'text';
      payload: string;
    }) => Promise<void>,
  ): void {
    const clients = this.conversationClients.get(conversationId) || [];

    // Remove existing Slack client if any
    const filteredClients = clients.filter((client) => client.type !== 'slack');

    // Add new Slack client
    const slackClient: ConversationClient = {
      type: 'slack',
      conversationId,
      clientId: `slack-${conversationId}`,
      sendMessage: slackCallback,
      decorateMessage: (message: IConversationMessage) => {
        // No-op passthrough decoration for now
        return {
          type: 'text',
          payload: message.content.payload as string,
        };
      },
    };

    filteredClients.push(slackClient);
    this.conversationClients.set(conversationId, filteredClients);

    this.logger.debug(
      `Registered Slack client for conversation ${conversationId}`,
    );
  }

  /**
   * Register WebSocket client for conversation
   * Called when WebSocket client joins room
   */
  public registerWebSocketClient(
    conversationId: string,
    clientId: string,
  ): void {
    const clients = this.conversationClients.get(conversationId) || [];

    // Remove existing WebSocket client with same clientId
    const filteredClients = clients.filter(
      (client) =>
        !(client.type === 'websocket' && client.clientId === clientId),
    );

    // Add new WebSocket client
    const wsClient: ConversationClient = {
      type: 'websocket',
      conversationId,
      clientId,
      sendMessage: async (content: { type: 'text'; payload: string }) => {
        // Send via WebSocket gateway
        if (this.gateway) {
          this.gateway.broadcastToConversation(conversationId, 'new_message', {
            message: {
              content: { type: content.type, payload: content.payload },
              conversationId,
              createdAt: new Date(),
            },
            timestamp: new Date().toISOString(),
          });
        }
      },
      decorateMessage: (message: IConversationMessage) => {
        // No-op passthrough decoration for now
        return {
          type: 'text',
          payload: message.content.payload as string,
        };
      },
    };

    filteredClients.push(wsClient);
    this.conversationClients.set(conversationId, filteredClients);

    this.logger.debug(
      `Registered WebSocket client ${clientId} for conversation ${conversationId}`,
    );
  }

  /**
   * Legacy method for backward compatibility
   * Uses private _addMessageToStorage
   */
  async createMessage<
    T extends TConversationMessageContent = TConversationMessageContent,
  >(createMessageDto: CreateMessageDto): Promise<IConversationMessage<T>> {
    return this.storeMessage(createMessageDto) as Promise<
      IConversationMessage<T>
    >;
  }

  /**
   * Add message that only users can see (robot doesn't see)
   * Perfect for user-only results, summaries, notifications
   */
  async addMessageUserOnly(
    conversationId: string,
    content: TConversationMessageContent,
    fromRole: UserRole = UserRole.SYSTEM,
  ): Promise<IConversationMessage> {
    return this.storeMessage({
      conversationId,
      content,
      fromUserId: null,
      fromRole,
      toRole: UserRole.USER, // User sees, robot doesn't
    });
  }

  /**
   * Add context message that only robots (and dev/debug) can see
   * Perfect for structured prompts, data, instructions to robots
   * No robot response triggered - just adds context
   */
  async addMessageContextNoResponse(
    conversationId: string,
    content: TConversationMessageContent,
    fromRole: UserRole = UserRole.SYSTEM,
  ): Promise<IConversationMessage> {
    return this.storeMessage({
      conversationId,
      content,
      fromUserId: null,
      fromRole,
      toRole: UserRole.ROBOT, // Robot sees, user doesn't
    });
  }

  /**
   * Add message and trigger robot response with streaming to users
   * Perfect for user messages that should get robot responses
   */
  async addMessageWithRobotResponse(
    conversationId: string,
    content:
      | TConversationMessageContentString
      | TConversationMessageContentMarkdown,
    robotName: RobotName,
  ): Promise<IConversationMessage> {
    // Add the user message first
    const userMessage = await this.storeMessage({
      conversationId,
      content,
      fromUserId: null,
      fromRole: UserRole.USER,
      toRole: UserRole.ROBOT,
    });

    // Get the specified robot
    const robot = this.robotService.getRobotByName(robotName);
    if (!robot) {
      throw new Error(`Robot ${robotName} not found`);
    }

    // Create enhanced callbacks for robot response
    const robotCallbacks: IStreamingCallbacks = {
      conversationId,
      onStreamStart: () => {},
      onStreamChunkReceived: () => {},
      onStreamFinished: () => {},
      onFullMessageReceived: async (message) => {
        // Save robot response to conversation
        await this.storeMessage({
          content: message.content,
          conversationId,
          fromUserId: null,
          fromRole: UserRole.ROBOT,
          toRole: UserRole.USER,
        });
      },
      onError: (error) => {
        this.logger.error(`Robot ${robotName} error:`, error);
      },
    };

    // Trigger robot response
    await (robot as any).acceptMessageStreamResponse(
      userMessage,
      robotCallbacks,
    );

    return userMessage;
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
    // Register Slack client for this conversation
    if (slackResponseCallback) {
      this.registerSlackClient(conversationId, slackResponseCallback);
    }

    // Add the user message to the conversation
    const userMessage = await this.addMessageFromUser(
      conversationId,
      content.payload,
      'cx-slack-robot',
      UserRole.USER,
      UserRole.USER,
    );

    // Trigger intent processing (similar to handleRobotMessage)
    try {
      // Step 1: Parse intent to determine appropriate handler/robot
      const intentResult = await this.intentParsingService.parsePromptIntent(
        content.payload,
        { currentRobot: undefined },
      );

      // Step 2: Create callbacks for Slack integration
      const slackCallbacks = this.createSlackCallbacks(
        conversationId,
        slackResponseCallback,
      );

      // Step 3: Route intent through intent router or fallback to SlackyOpenAiAgent
      if ('error' in intentResult) {
        // Intent parsing failed, fallback to SlackyOpenAiAgent
        this.logger.warn(
          `Intent parsing failed: ${intentResult.error}. Falling back to SlackyOpenAiAgent`,
        );
        await this.handleSlackyFallback(
          conversationId,
          content.payload,
          slackResponseCallback,
        );
      } else {
        // Route through intent router (handles both intent handlers and robots)
        this.logger.log(
          `Intent parsing succeeded with intent: ${(intentResult as IntentParsingResponse).intent} (debug recommends: ${(intentResult as IntentParsingResponse).devDebugRecommendedExecutor})`,
        );
        // Add intent and conversationId to intentData and route
        const intentDataWithConversation = {
          ...intentResult.intentData,
          intent: intentResult.intent,
          conversationId: conversationId,
        };
        await this.intentRouterService.routeIntent(intentDataWithConversation);
      }
    } catch (error) {
      this.logger.error(
        `Error in Slack intent processing for conversation ${conversationId}:`,
        error,
      );
      this.logger.error('Slack intent processing error details:', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        conversationId,
        messagePayload: content.payload,
      });
      // Final fallback to SlackyOpenAiAgent
      await this.handleSlackyFallback(
        conversationId,
        content.payload,
        slackResponseCallback,
      );
    }
    return userMessage;
  }

  /**
   * Create Slack-compatible callbacks for intent routing
   */
  private createSlackCallbacks(
    conversationId: string,
    slackResponseCallback?: (content: {
      type: 'text';
      payload: string;
    }) => Promise<void>,
  ): IStreamingCallbacks {
    return {
      conversationId,
      onStreamChunkReceived: (chunk: string) => {
        // For Slack, we don't need to handle streaming chunks
      },
      onStreamStart: (message: any) => {
        // For Slack, we don't need to handle stream start
      },
      onStreamFinished: (message: any) => {
        // For Slack, we don't need to handle stream finished
      },
      onFullMessageReceived: async (message: any) => {
        this.logger.debug(
          `Slack callback onFullMessageReceived called with: ${message.content.payload?.substring(0, 100)}...`,
        );

        // Add robot response to conversation history
        await this.addRobotResponseFromSlack(conversationId, {
          type: 'text',
          payload: message.content.payload,
        });

        // Send to Slack if callback provided
        if (slackResponseCallback && message.content.payload?.trim()) {
          this.logger.debug(`Sending message to Slack via callback...`);
          await slackResponseCallback({
            type: 'text',
            payload: message.content.payload,
          });
          this.logger.debug(`Message sent to Slack successfully`);
        } else {
          this.logger.warn(
            `Slack callback not available or empty payload. Callback: ${!!slackResponseCallback}, Payload: ${!!message.content.payload?.trim()}`,
          );
        }
      },
      onError: async (error: any) => {
        this.logger.error(`Slack intent processing error: ${error.message}`);
        if (slackResponseCallback) {
          await slackResponseCallback({
            type: 'text',
            payload: `Sorry, I encountered an error: ${error.message}`,
          });
        }
      },
    };
  }

  /**
   * Fallback to SlackyOpenAiAgent when intent parsing fails
   */
  private async handleSlackyFallback(
    conversationId: string,
    messagePayload: string,
    slackResponseCallback?: (content: {
      type: 'text';
      payload: string;
    }) => Promise<void>,
  ): Promise<void> {
    const robot = this.robotService.getRobotByName('SlackyOpenAiAgent')!;

    // Get conversation history for context
    const conversationHistory = await this.getLastMessages(conversationId, 20);

    // Create message for robot
    const message: IConversationMessage<TConversationMessageContentString> = {
      id: uuidv4(),
      conversationId,
      content: {
        type: 'text/plain',
        payload: messagePayload,
      },
      authorUserId: 'cx-slack-robot',
      fromRole: UserRole.USER,
      toRole: UserRole.USER,
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
        this.logger.error('Invalid robot response structure:', response);
        return;
      }

      const responseContent = response.content.payload;

      // Add robot response to conversation history
      await this.addRobotResponseFromSlack(conversationId, {
        type: 'text',
        payload: responseContent,
      });

      // If Slack callback is provided, send response to Slack
      if (slackResponseCallback && responseContent && responseContent.trim()) {
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
    const userMessage = await this.addMessageFromUser(
      conversationId,
      content.payload,
      'form-marv-user',
      UserRole.USER,
      UserRole.USER,
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
      this.logger.error(
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
    const result = await this.storeMessage({
      conversationId,
      fromUserId: robotName,
      content: {
        type: 'text/plain',
        payload: content,
      },
      fromRole: UserRole.ROBOT,
      toRole: UserRole.USER,
    });

    return result;
  }

  /**
   * Add a user message to a conversation
   */
  async addMessageFromUser(
    conversationId: string,
    content: string,
    userId: string,
    fromRole: UserRole = UserRole.USER,
    toRole: UserRole = UserRole.USER,
  ): Promise<IConversationMessage> {
    // Store message
    const message = await this.storeMessage({
      conversationId,
      fromUserId: userId,
      content: {
        type: 'text/plain',
        payload: content,
      },
      fromRole,
      toRole,
    });

    // Broadcast to all clients immediately (echo/acknowledge)
    await this.broadcastMessage(message);

    return message;
  }

  /**
   * Process user message: Add to conversation, parse intent, add intent, route
   * This is the centralized method that implements the flow you specified
   */
  async processUserMessage(
    conversationId: string,
    messageText: string,
    userId: string = 'user',
  ): Promise<void> {
    // STEP 1: GET MESSAGE, ADD TO CONVERSATION, BROADCAST
    await this.addMessageFromUser(conversationId, messageText, userId);

    // STEP 2: PARSE INTENT (with conversation context)
    const conversationContext = {
      currentRobot: this.getCurrentRobot(conversationId) || undefined,
    };

    const intentResult = await this.intentParsingService.parsePromptIntent(
      messageText,
      conversationContext,
    );

    if (!('error' in intentResult)) {
      // STEP 3: ADD INTENT TO CONVERSATION, BROADCAST
      await this.addMessageSystemNotification(conversationId, {
        type: 'text/plain',
        payload: `🎯 **Intent Parsed**: ${intentResult.intent}\nSubIntents: ${intentResult.intentData.subIntents?.join(', ') || 'none'}`,
      });

      // STEP 4: ROUTE INTENT
      const intentDataWithConversation = {
        ...intentResult.intentData,
        intent: intentResult.intent,
        conversationId: conversationId,
      };

      await this.intentRouterService.routeIntent(intentDataWithConversation);
    }
  }

  /**
   * Parse intent from message text
   */
  async parseIntentFromMessage(messageText: string) {
    return this.intentParsingService.parsePromptIntent(messageText);
  }

  /**
   * Route intent using intent router
   */
  async routeIntent(intentData: any) {
    return this.intentRouterService.routeIntent(intentData);
  }

  /**
   * Get last intent from conversation history
   * Used by intent parser for context
   */
  getLastIntent(conversationId: string): string | null {
    // Get all messages and filter for intent parsing messages
    const allMessages = this.chatConversationListService.getFilteredMessages(
      conversationId,
      {},
    );

    // Look for the most recent intent parsing message
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const message = allMessages[i];
      if (
        typeof message.content.payload === 'string' &&
        message.content.payload.includes('🎯 **Intent Parsed**:')
      ) {
        // Extract intent from the payload
        const match = message.content.payload.match(
          /Intent Parsed\*\*:\s*(\w+)/,
        );
        return match ? match[1] : null;
      }
    }

    return null;
  }

  /**
   * Get last subjects from conversation history
   * Used by intent parser for context
   */
  getLastSubjects(conversationId: string): any {
    // Get all messages and filter for context types
    const allMessages = this.chatConversationListService.getFilteredMessages(
      conversationId,
      {},
    );

    // Look for the most recent context message with subjects
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const message = allMessages[i];
      if (
        message.content.type === 'context/dynamic' ||
        message.content.type === 'context/dynamic-form' ||
        message.content.type === 'sumo-search/report'
      ) {
        try {
          const contextData = JSON.parse(message.content.payload as string);
          // Extract subjects from context data
          return contextData.subjects || contextData.entityId || null;
        } catch (error) {
          // Continue searching if JSON parse fails
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Get current robot from conversation history
   * Used by intent parser for context
   */
  getCurrentRobot(conversationId: string): string | null {
    const messages = this.chatConversationListService.getFilteredMessages(
      conversationId,
      {},
    );

    // Look for the most recent robot message
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.fromRole === UserRole.ROBOT) {
        return message.authorUserId || 'unknown-robot';
      }
    }

    return null;
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
        (msg) => msg.authorUserId === query.userId,
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
      role: msg.fromRole === UserRole.USER ? 'user' : 'assistant',
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
      role: msg.fromRole === UserRole.USER ? 'user' : 'assistant',
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
      UserRole.USER, // External users start as customers
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
            conversation.participantRoles.push(UserRole.USER);
          }
        }

        // Create participant list
        const participantList = [
          {
            userId: createdBy,
            userRole: createdByRole || UserRole.USER,
            joinedAt: now,
          },
        ];

        for (const participantId of initialParticipants) {
          if (participantId !== createdBy) {
            participantList.push({
              userId: participantId,
              userRole: UserRole.USER,
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
            userRole: createdByRole || UserRole.USER,
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
      message.toRole === UserRole.USER ||
      message.fromRole === UserRole.USER
    );
  }
}
