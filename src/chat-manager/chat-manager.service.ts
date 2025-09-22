import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IntentParsingService } from '../common/services/intent-parsing.service';
import { IntentRouterService } from '../common/services/intent-router.service';
import { IntentParsingResponse } from '../common/types/intent-parsing.types';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import {
  TConversationMessageContent,
  TConversationMessageContentMarkdown,
  TConversationMessageContentString,
  TConversationMessageUserIntent,
} from '../ConversationLists/types';
import { RobotService } from '../robots/robot.service';
import {
  IStreamingCallbacks,
  TStreamingCallbackMessageOnFullMessageReceived,
} from '../robots/types';
import {
  ConversationParticipantRole,
  CreateMessageDto,
  UserRole,
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
  decorateMessage: (
    message: IConversationMessage,
  ) => IConversationMessage | null;
  isMessageFilterAccepted: (message: IConversationMessage) => boolean;
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
   * Get the base URL for generating links with proper fallbacks
   */
  private getBaseUrl(): string {
    // Priority 1: NGROK_URL environment variable
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL.replace(/\/$/, ''); // Remove trailing slash if present
    }

    // Priority 2: ISTACK_BUDDY_FRONT_END_HOST environment variable
    if (process.env.ISTACK_BUDDY_FRONT_END_HOST) {
      return process.env.ISTACK_BUDDY_FRONT_END_HOST.replace(/\/$/, ''); // Remove trailing slash if present
    }

    // Priority 3: Fallback to localhost for development
    return 'http://localhost:3500';
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
          const robotMessage = await this.createMessage(
            {
              conversationId: conversationId,
              content: {
                type: 'text/plain',
                payload: accumulatedContent,
              },
            },
            {
              fromUserId: 'anthropic-marv-robot',
              fromRole: UserRole.ROBOT,
              toRole: UserRole.USER,
            },
          );

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
        const fullMessage = await this.createMessage(
          {
            conversationId: conversationId,
            content: {
              type: 'text/plain',
              payload: message.content.payload,
            },
          },
          {
            fromUserId: 'intent-handler-robot',
            fromRole: UserRole.ROBOT,
            toRole: UserRole.USER,
          },
        );

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
        const errorMessage = await this.createMessage(
          {
            conversationId: conversationId,
            content: {
              type: 'text/plain',
              payload: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          },
          {
            fromUserId: 'anthropic-marv-robot',
            fromRole: UserRole.USER,
            toRole: UserRole.USER,
          },
        );

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

      const intentResult = await this.parseIntentFromUserMessage(userMessage, {
        currentRobot: '',
        lastRobotMessageText: '',
        conversationId: conversationId,
      });
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
      const conversationMessage = await this.createMessage(
        {
          conversationId: conversationId,
          content: {
            type: 'text/plain',
            payload: userMessage,
          },
        },
        {
          fromUserId: 'form-marv-user',
          fromRole: UserRole.USER,
          toRole: UserRole.USER,
        },
      );

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
   * ConversationManager Methods - as specified in the plan
   */

  /**
   * Send system message (acknowledgments, status updates, progress notifications)
   * Role: SYSTEM → USER
   */
  async addMessageSystemNotification(
    conversationId: string,
    content: TConversationMessageContent | TConversationMessageUserIntent,
    participantVisibility: ConversationParticipantRole[] = [
      ConversationParticipantRole.SYSTEM_DEBUG,
      ConversationParticipantRole.SYSTEM_CONVERSATION_MANAGER,
    ],
  ): Promise<void> {
    // 1. CREATE
    const message = await this.createMessage(
      { conversationId, content },
      {
        fromUserId: 'chat-manager@system.com',
        fromRole: UserRole.SYSTEM,
        toRole: UserRole.USER,
        intendedVisibility: participantVisibility,
      },
    );

    // 2. OVERRIDE/MODIFY - SET VISIBILITY (already set via intendedVisibility)

    // 3. STORE
    await this.storeMessage(message);
  }

  /**
   * Add context for robot processing
   * Role: SYSTEM → ROBOT
   */
  async addMessageAsContext(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // 1. CREATE
    const message = await this.createMessage(
      { conversationId, content },
      {
        fromUserId: 'chat-manager@system.com',
        fromRole: UserRole.SYSTEM,
        toRole: UserRole.ROBOT,
        intendedVisibility: [ConversationParticipantRole.VISIBLE_TO_ALL],
      },
    );

    // 2. OVERRIDE/MODIFY - SET VISIBILITY (already set via intendedVisibility)

    // 3. STORE
    await this.storeMessage(message);
  }

  /**
   * Add robot prompt (triggers robot response)
   * Role: SYSTEM → ROBOT
   */
  async _addMessageRequestRobotResponse(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // Use existing working robot response mechanism
    const currentRobot =
      this.getCurrentRobot(conversationId) || 'SlackyOpenAiAgent';

    // Convert content to text/plain for robot processing
    const robotContent = {
      type: 'text/plain' as const,
      payload: content.payload as string,
    };

    // THIS FUNCTION `_addMessageRequestRobotResponse(` WAS AN AI FUCK UP DOES NOT BELONG IN CODE

    // await this.addMessageToGetRobotResponse(
    //   conversationId,
    //   robotContent,
    //   '',
    // );
  }

  /**
   * Add robot response message - new conversation method
   * Role: ROBOT → USER
   */
  async addMessageResponseFromRobot(
    conversationId: string,
    content: TConversationMessageContent,
    fromUserId: string,
  ): Promise<void> {
    // Force all robot responses to be markdown (robots should only send text)
    const robotContent: TConversationMessageContentMarkdown = {
      type: 'text/markdown',
      payload: content.payload as string, // Robot responses are always text
    };

    // 1. CREATE
    const message = await this.createMessage(
      { conversationId, content: robotContent },
      {
        fromUserId,
        fromRole: UserRole.ROBOT,
        toRole: UserRole.USER,
        intendedVisibility: [ConversationParticipantRole.VISIBLE_TO_ALL],
      },
    );

    // 2. OVERRIDE/MODIFY - SET VISIBILITY (already set via intendedVisibility)

    // 3. STORE
    await this.storeMessage(message);
  }

  /**
   * Add error notification message
   * Role: SYSTEM → USER
   */
  async addMessageErrorNotification(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // 1. CREATE
    const message = await this.createMessage(
      { conversationId, content },
      {
        fromUserId: 'chat-manager@system.com',
        fromRole: UserRole.SYSTEM,
        toRole: UserRole.USER,
        intendedVisibility: [ConversationParticipantRole.VISIBLE_TO_ALL],
      },
    );

    // 2. OVERRIDE/MODIFY - SET VISIBILITY (already set via intendedVisibility)

    // 3. STORE
    await this.storeMessage(message);
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
          if (client.isMessageFilterAccepted(message)) {
            const decoratedMessage = client.decorateMessage(message);

            // Skip sending if decorateMessage returns null (filtered out)
            if (decoratedMessage === null) {
              this.logger.debug(
                `${client.type} client ${client.clientId} filtered out message ${message.id}`,
              );
              return;
            }

            this.logger.debug(
              `${client.type} client ${client.clientId} accepted message  ${JSON.stringify(message)}`,
            );
            await client.sendMessage({
              type: 'text',
              payload: decoratedMessage.content.payload as string,
            });
          } else {
            this.logger.debug(
              `${client.type} client ${client.clientId} rejected message ${message.id}`,
            );
          }
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
    messageOrDto: IConversationMessage | CreateMessageDto,
  ): Promise<IConversationMessage> {
    let message: IConversationMessage;

    // Handle both IConversationMessage and CreateMessageDto for backward compatibility
    if ('id' in messageOrDto) {
      // Already a message object
      message = messageOrDto as IConversationMessage;
    } else {
      // Create message from DTO
      message = await this.createMessage(
        {
          conversationId: messageOrDto.conversationId,
          content: messageOrDto.content,
        },
        messageOrDto,
      );
    }

    // Ensure conversation exists using centralized method
    await this.ensureConversationExists(
      message.conversationId,
      `Conversation ${message.conversationId}`,
      `Auto-created conversation for ${message.conversationId}`,
      message.authorUserId as string,
      message.fromRole,
    );

    // Store the message in the chat conversation list service
    this.chatConversationListService.addMessageToConversation(
      message.conversationId,
      message,
    );

    // Update conversation activity
    await this.updateConversationActivity(message.conversationId);

    // Auto-broadcast all stored messages
    await this.broadcastMessage(message);

    return message;
  }

  /**
   * Convert standard markdown to Slack-compatible format
   */
  private convertMarkdownToSlack(markdown: string): string {
    return (
      markdown
        // Headers: ### Header → *Header*
        .replace(/^### (.*?)$/gm, '*$1*')
        .replace(/^## (.*?)$/gm, '*$1*')
        .replace(/^# (.*?)$/gm, '*$1*')
        // Bold: **text** → *text*
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        // Italic: __text__ → _text_
        .replace(/__(.*?)__/g, '_$1_')
        // Links: [text](url) → <url|text>
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
        // Bullet points: - item → • item
        .replace(/^- (.*?)$/gm, '• $1')
        // Remove extra markdown artifacts
        .replace(/^\s*\*\s*$/gm, '') // Remove standalone asterisks
        .replace(/^\s*#\s*$/gm, '')
    ); // Remove standalone hashes
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
      // @ts-ignore - debugging formatting issues
      _decorateMessage: (
        message: IConversationMessage,
      ): IConversationMessage => {
        return message;
      },
      // @ts-ignore - debugging formatting issues
      decorateMessage: (
        message: IConversationMessage,
      ): IConversationMessage | null => {
        // Handle intent messages (JSON debug messages) with proper formatting
        const payload = message.content.payload as string;

        // Handle system/robot-prompt messages as clickable link
        if (message.content.type === 'system/robot-prompt') {
          return {
            ...message,
            content: {
              type: 'text/plain',
              payload: `[robot prompt] ${this.getBaseUrl()}/get-message?messageId=${message.id}`,
            },
          };
        }

        // Handle context/document messages as clickable link
        if (message.content.type === 'context/document') {
          return {
            ...message,
            content: {
              type: 'text/plain',
              payload: `[robot context document] ${this.getBaseUrl()}/get-message?messageId=${message.id}`,
            },
          };
        }

        // Handle context/document messages as clickable link
        if (message.content.type === 'system/user-intent') {
          return {
            ...message,
            content: {
              type: 'text/markdown',
              payload:
                '```json\n' +
                JSON.stringify(message.content.payload, null, 2) +
                '\n```',
            },
          };
        }

        // Filter out Slack user's own messages to avoid echo
        if (message.authorUserId === 'slack-service@istack-buddy.com') {
          return {
            ...message,
            content: {
              type: 'text/markdown',
              payload: `Thank you for your request. 
              
              I am working on it. I would like to take this opportunity to explain:
              1. \@iStackBuddy [your request] (as you just did). iStackBuddy does not listen
              to every messages sent in a thread.  It responds only to messages sent directly to it.
              It has visibility only into messages sent to it or sent by it. Happy Stacking.

              2. \@iStackBuddy '/feedback' to provided ANY feedback. iStackBuddy is a community agent.
              It is only as good as your feedback.  Send corrections, suggestions, bug reports, anything you want.
              
              `,
            },
          };
        }

        // Convert markdown to Slack format for text/markdown messages
        if (message.content.type === 'text/markdown') {
          const slackMarkdown =
            '' + this.convertMarkdownToSlack(message.content.payload as string);
          return {
            ...message,
            content: {
              type: 'text/markdown',
              payload: slackMarkdown,
            },
          };
        }

        // No-op passthrough decoration for other messages
        return message;
      },
      isMessageFilterAccepted: (message: IConversationMessage) => {
        const payload = message.content.payload;

        // Allow all messages (including intent messages - they will be decorated)
        // Handle both string and object payloads
        if (typeof payload === 'string') {
          return !!(payload && payload.trim());
        } else if (typeof payload === 'object' && payload !== null) {
          return true; // Allow object payloads (like system/user-intent)
        }
        return false;
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
        return message;
      },
      isMessageFilterAccepted: (message: IConversationMessage) => {
        // WebSocket clients accept all messages
        return true;
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
  >(
    required: { conversationId: string; content: TConversationMessageContent },
    overrides: Partial<CreateMessageDto> = {},
  ): Promise<IConversationMessage<T>> {
    // Create message object with defaults + overrides
    const messageId = uuidv4();
    const now = new Date();

    const message: IConversationMessage = {
      id: messageId,
      content: required.content,
      conversationId: required.conversationId,
      authorUserId: overrides.fromUserId || null,
      fromRole: overrides.fromRole || UserRole.USER,
      toRole: overrides.toRole || UserRole.USER,
      threadId: overrides.threadId,
      originalMessageId: overrides.originalMessageId,
      participantVisibility: overrides.intendedVisibility || [],
      createdAt: now,
      updatedAt: now,
    };

    return message as IConversationMessage<T>;
  }

  /**
   * Add message that only users can see (robot doesn't see)
   * Perfect for user-only results, summaries, notifications
   */
  async addMessageUserOnly(
    conversationId: string,
    content: TConversationMessageContent,
    fromRole: UserRole = UserRole.SYSTEM,
    fromUserId: string,
  ): Promise<IConversationMessage> {
    // 1. CREATE
    const message = await this.createMessage(
      { conversationId, content },
      {
        fromUserId,
        fromRole,
        toRole: UserRole.USER,
        intendedVisibility: [ConversationParticipantRole.VISIBLE_TO_ALL],
      },
    );

    // 2. OVERRIDE/MODIFY - SET VISIBILITY (already set via intendedVisibility)

    // 3. STORE
    await this.storeMessage(message);
    return message;
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
    // 1. CREATE
    const message = await this.createMessage(
      { conversationId, content },
      {
        fromUserId: 'chat-manager@system.com',
        fromRole,
        toRole: UserRole.ROBOT,
        intendedVisibility: [ConversationParticipantRole.ROBOT_ALL],
      },
    );

    // 2. OVERRIDE/MODIFY - SET VISIBILITY (already set via intendedVisibility)

    // 3. STORE
    await this.storeMessage(message);
    return message;
  }

  /**
   * Add message and trigger robot response with streaming to users
   * Perfect for user messages that should get robot responses
   */
  async addMessageToGetRobotResponse(
    conversationId: string,
    content:
      | TConversationMessageContentString
      | TConversationMessageContentMarkdown,
    //    robotName: RobotName,
  ): Promise<IConversationMessage> {
    const robotName =
      this.getCurrentRobot(conversationId) || 'SlackyOpenAiAgent';

    // 1. CREATE
    const userMessage = await this.createMessage(
      {
        conversationId,
        content: {
          type: 'system/robot-prompt',
          payload: content.payload,
        },
      },
      {
        fromUserId: 'chat-manager@system.com',
        fromRole: UserRole.SYSTEM,
        toRole: UserRole.ROBOT,
        intendedVisibility: [
          ConversationParticipantRole.SYSTEM_DEBUG,
          ConversationParticipantRole.ROBOT_ALL,
        ],
      },
    );

    // 2. OVERRIDE/MODIFY - SET VISIBILITY (already set via intendedVisibility)

    // 3. STORE
    await this.storeMessage(userMessage);

    // Get the specified robot
    const robot = this.robotService.getRobotByName(robotName);
    if (!robot) {
      throw new Error(
        `Failed to get currentRobot from conversation, robot name: ${robotName}`,
      );
    }

    // Create enhanced callbacks for robot response
    const robotCallbacks: IStreamingCallbacks = {
      conversationId,
      onStreamStart: (message) => {
        console.log('onStreamStart', message);
      },
      onStreamChunkReceived: (chunk) => {
        // Stream chunks to WebSocket clients
        if (chunk && chunk.trim() && this.getGateway()) {
          this.getGateway().broadcastToConversation(
            conversationId,
            'robot_chunk',
            { chunk },
          );
        }
      },
      onStreamFinished: (message) => {
        console.log('onStreamFinished', message);
      },
      onFullMessageReceived: async (message) => {
        // Add robot response to conversation and broadcast
        await this.addMessageResponseFromRobot(
          conversationId,
          message.content,
          robot.name,
        );
      },
      onError: (error) => {
        this.logger.error(`Robot ${robotName} error:`, error);
      },
    };
    const x = this.chatConversationListService
      .getConversationById(conversationId)
      ?.getFilteredRobotMessages();

    // Trigger robot response with conversation history
    await (robot as any).acceptMessageStreamResponse(
      userMessage,
      robotCallbacks,
      () => {
        const conversationList =
          this.chatConversationListService.getConversationById(conversationId);
        return conversationList
          ? conversationList.getFilteredRobotMessages()
          : [];
      },
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
  ): Promise<void> {
    // Register Slack client for this conversation
    if (slackResponseCallback) {
      this.registerSlackClient(conversationId, slackResponseCallback);
    }

    // Strip @iStackBuddyChatApp mention from the message
    const cleanMessage = this.stripMentionFromMessage(content.payload);

    // Add the user message to the conversation
    // const userMessage = await this.addMessageFromUser(
    //   conversationId,
    //   cleanMessage,
    //   'slack-service@istack-buddy.com',
    //   UserRole.USER,
    //   UserRole.USER,
    // );

    // Process the message through the centralized intent system
    await this.processUserMessage(
      conversationId,
      cleanMessage,
      'slack-service@istack-buddy.com',
    );
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
    const message = await this.createMessage(
      {
        conversationId,
        content: {
          type: 'text/plain',
          payload: messagePayload,
        },
      },
      {
        fromUserId: 'cx-slack-robot',
        fromRole: UserRole.USER,
        toRole: UserRole.USER,
      },
    );

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
      message as IConversationMessage<TConversationMessageContentString>,
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
    // 1. CREATE
    const message = await this.createMessage(
      {
        conversationId,
        content: {
          type: 'text/plain',
          payload: content,
        },
      },
      {
        fromUserId: userId,
        fromRole,
        toRole,
        intendedVisibility: [ConversationParticipantRole.VISIBLE_TO_ALL],
      },
    );

    // 2. OVERRIDE/MODIFY - SET VISIBILITY (already set via intendedVisibility)

    // 3. STORE
    await this.storeMessage(message);

    return message;
  }

  /**
   * Parse intent from message text
   */
  async parseIntentFromUserMessage(
    messageText: string,
    conversationContext: {
      currentRobot: string;
      lastRobotMessageText: string;
      conversationId: string;
    },
  ) {
    // Convert to PreviousConversationContext format
    const previousConversationContext = {
      lastRobotMessageText:
        conversationContext.lastRobotMessageText || undefined,
      lastIntent: this.getLastIntent(conversationContext.conversationId),
    };

    const intentResult = await this.intentParsingService.parsePromptIntent(
      messageText,
      previousConversationContext,
    );

    return intentResult;
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
      currentRobot: this.getCurrentRobot(conversationId) || '',
      lastRobotMessageText: this.getLastRobotMessage(conversationId) || '',
      conversationId: conversationId,
    };

    const intentResult = await this.parseIntentFromUserMessage(
      messageText,
      conversationContext,
    );

    if (!('error' in intentResult)) {
      // STEP 3: ADD INTENT TO CONVERSATION, BROADCAST
      await this.addMessageSystemNotification(conversationId, {
        type: 'system/user-intent',
        payload: intentResult,
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
   * Route intent using intent router
   */
  async routeIntent(intentData: any) {
    return this.intentRouterService.routeIntent(intentData);
  }

  /**
   * Get last intent from conversation history
   * Used by intent parser for context
   */
  getLastIntent(conversationId: string): IntentParsingResponse | undefined {
    // Get all messages and filter for intent parsing messages
    const allMessages = this.chatConversationListService.getFilteredMessages(
      conversationId,
      {},
    );

    // Look for the most recent intent JSON message
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const message = allMessages[i];
      if (
        message.fromRole === UserRole.SYSTEM &&
        typeof message.content.payload === 'string' &&
        message.content.payload.trim().startsWith('{') &&
        message.content.payload.includes('"intent"')
      ) {
        try {
          const intentJson = JSON.parse(message.content.payload);
          return intentJson as IntentParsingResponse;
        } catch (error) {
          this.logger.warn('Failed to parse intent JSON:', error);
          continue;
        }
      }
    }

    return undefined;
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
   * Get the last robot message from conversation
   * Returns the most recent message from a robot
   */
  getLastRobotMessage(conversationId: string): string | null {
    const messages = this.chatConversationListService.getFilteredMessages(
      conversationId,
      {},
    );

    // Look for the most recent robot message to user
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (
        message.fromRole === UserRole.ROBOT &&
        message.toRole === UserRole.USER
      ) {
        return typeof message.content.payload === 'string'
          ? message.content.payload
          : JSON.stringify(message.content.payload);
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

  /**
   * Strip @iStackBuddyChatApp, @iStackBuddy, and ALL Slack mention formats from messages
   */
  private stripMentionFromMessage(message: string): string {
    if (!message) return message;

    // Remove @iStackBuddyChatApp mentions (case insensitive)
    let cleaned = message.replace(/@iStackBuddyChatApp\s*/gi, '');

    // Remove @iStackBuddy mentions (case insensitive)
    cleaned = cleaned.replace(/@iStackBuddy\s*/gi, '');

    // Remove ALL Slack mention formats <@U...> (any user ID)
    cleaned = cleaned.replace(/<@U[A-Z0-9]+>\s*/gi, '');

    // Also remove any leading/trailing whitespace and clean up multiple spaces
    return cleaned.trim().replace(/\s+/g, ' ');
  }
}
