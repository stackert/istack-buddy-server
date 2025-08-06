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
} from './interfaces/message.interface';
import { v4 as uuidv4 } from 'uuid';
import { ConversationListSlackAppService } from '../ConversationLists/ConversationListSlackAppService';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import { TConversationTextMessageEnvelope } from '../ConversationLists/types';

@Injectable()
export class ChatManagerService {
  // In-memory storage for conversation metadata and participants
  private conversationMetadata: Record<string, Conversation> = {};
  private participants: Map<string, Participant[]> = new Map();
  private gateway: any; // Will be set by the gateway

  constructor(
    private readonly conversationListService: ConversationListSlackAppService,
    private readonly chatConversationListService: ChatConversationListService,
  ) {}

  // Method to set the gateway reference (called by the gateway)
  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  // Method to get the gateway reference
  getGateway(): any {
    return this.gateway;
  }

  /**
   * Convert Message to TConversationMessageEnvelope format for storage
   */
  private messageToEnvelope(
    message: IConversationMessage,
  ): TConversationTextMessageEnvelope {
    const conversationMessage: any = {
      messageId: message.id,
      author_role: message.fromRole,
      fromUserId: message.fromUserId, // Preserve the original fromUserId
      content: {
        type: 'text/plain',
        payload: message.content,
      },
      created_at: message.createdAt.toISOString(),
      estimated_token_count: Math.ceil(message.content.length / 4), // Rough token estimate
      messageType: message.messageType, // Preserve messageType
      toRole: message.toRole, // Preserve toRole
    };

    return {
      messageId: message.id,
      requestOrResponse:
        message.fromRole === UserRole.CUSTOMER ? 'request' : 'response',
      envelopePayload: conversationMessage,
    };
  }

  /**
   * Convert TConversationMessageEnvelope back to Message format
   */
  private envelopeToMessage(
    envelope: any,
    conversationId: string,
  ): IConversationMessage {
    const payload = envelope.envelope.envelopePayload;
    return {
      id: payload.messageId,
      content: payload.content.payload,
      conversationId: conversationId,
      fromUserId: payload.fromUserId || null, // Use preserved fromUserId or null as fallback
      fromRole: payload.author_role as UserRole,
      toRole: payload.toRole || UserRole.AGENT, // Use preserved toRole or default to AGENT
      messageType: payload.messageType || MessageType.TEXT, // Use preserved messageType or default to TEXT
      createdAt: new Date(payload.created_at),
      updatedAt: new Date(payload.created_at),
    };
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
  ): Promise<IConversationMessage> {
    const messageId = uuidv4();
    const now = new Date();

    // Generate content hash for deduplication
    const contentHash = this.generateMessageContentHash(createMessageDto);

    // Ensure conversation exists in conversation list service
    const conversationList =
      this.conversationListService.getConversationOrCreate(
        createMessageDto.conversationId,
        `Conversation ${createMessageDto.conversationId}`,
        `Auto-created conversation for ${createMessageDto.conversationId}`,
      );

    // Ensure conversation metadata exists
    if (!this.conversationMetadata[createMessageDto.conversationId]) {
      console.log(
        `[ChatManagerService] Creating conversation metadata for: ${createMessageDto.conversationId}`,
      );
      const conversation: Conversation = {
        id: createMessageDto.conversationId,
        participantIds: [createMessageDto.fromUserId as string],
        participantRoles: [createMessageDto.fromRole],
        messageCount: 0,
        lastMessageAt: now,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      this.conversationMetadata[createMessageDto.conversationId] = conversation;
      console.log(
        `[ChatManagerService] Conversation metadata created. Total conversations: ${Object.keys(this.conversationMetadata).length}`,
      );
    }

    const message: IConversationMessage = {
      id: messageId,
      content: createMessageDto.content,
      conversationId: createMessageDto.conversationId,
      fromUserId: createMessageDto.fromUserId,
      fromRole: createMessageDto.fromRole,
      toRole: createMessageDto.toRole,
      messageType: createMessageDto.messageType || MessageType.TEXT,
      threadId: createMessageDto.threadId,
      originalMessageId: createMessageDto.originalMessageId,
      createdAt: now, // this is 'our' time - the message may have a different creation time
      // using our time makes sense.  The calling code should be guarding
      // against create time overwite - if that turns out to a an issue
      updatedAt: now,
    };

    // Store the message in conversation list
    const envelope = this.messageToEnvelope(message);
    conversationList.addMessageEnvelope(envelope);

    // Also store the message in the chat conversation list service
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
  ): Promise<IConversationMessage> {
    return this.addMessage(createMessageDto);
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
      this.conversationListService.getConversationById(conversationId);
    if (!conversationList) {
      return [];
    }

    // Get all envelopes and convert to messages
    const allEnvelopes = conversationList.getLastAddedEnvelopes();
    const allMessages = allEnvelopes
      .map((envelope) => this.envelopeToMessage(envelope, conversationId))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let filteredMessages = allMessages;

    if (query.threadId) {
      filteredMessages = allMessages.filter(
        (msg) => msg.threadId === query.threadId,
      );
    }

    if (query.userId) {
      filteredMessages = filteredMessages.filter(
        (msg) =>
          msg.fromUserId === query.userId ||
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
      this.conversationListService.getConversationById(conversationId);

    if (!conversationList) {
      return [];
    }

    // Get all envelopes and convert to messages
    const allEnvelopes = conversationList.getLastAddedEnvelopes();
    const allMessages = allEnvelopes
      .map((envelope) => this.envelopeToMessage(envelope, conversationId))
      .sort((a, b) => {
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
    console.log(
      `[ChatManagerService] Attempting to join conversation: ${conversationId}`,
    );
    console.log(
      `[ChatManagerService] Available conversations:`,
      Object.keys(this.conversationMetadata),
    );
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

    for (const conversationId of this.conversationListService.getAllConversationIds()) {
      const conversationList =
        this.conversationListService.getConversationById(conversationId);
      if (conversationList) {
        totalMessages += conversationList.getMessageCount();

        // Check for recent messages to count active users
        const envelopes = conversationList.getLastAddedEnvelopes();
        for (const envelope of envelopes) {
          const message = this.envelopeToMessage(envelope, conversationId);
          if (message.createdAt > oneHourAgo && message.fromUserId) {
            recentUserIds.add(message.fromUserId);
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

    // Create conversation in conversation list service
    const conversationList =
      this.conversationListService.getConversationOrCreate(
        conversationId,
        `Conversation ${conversationId}`,
        `Conversation created by ${startConversationDto.createdBy}`,
      );

    const conversation: Conversation = {
      id: conversationId,
      participantIds: [startConversationDto.createdBy],
      participantRoles: [startConversationDto.createdByRole],
      messageCount: 0,
      lastMessageAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // Store conversation metadata
    this.conversationMetadata[conversationId] = conversation;

    // Add creator as participant
    const creatorParticipant: Participant = {
      userId: startConversationDto.createdBy,
      userRole: startConversationDto.createdByRole,
      joinedAt: now,
    };

    const participantList = [creatorParticipant];

    // Add initial participants if provided
    if (startConversationDto.initialParticipants) {
      for (const participantId of startConversationDto.initialParticipants) {
        if (participantId !== startConversationDto.createdBy) {
          participantList.push({
            userId: participantId,
            userRole: UserRole.CUSTOMER, // Default role for additional participants
            joinedAt: now,
          });

          conversation.participantIds.push(participantId);
          conversation.participantRoles.push(UserRole.CUSTOMER);
        }
      }
    }

    this.participants.set(conversationId, participantList);

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

    // Create conversation in conversation list service
    const displayName = channelName
      ? `${source} - ${channelName}`
      : `${source} - ${externalConversationId}`;

    const conversationList =
      this.conversationListService.getConversationOrCreate(
        externalConversationId,
        displayName,
        `External conversation from ${source}`,
      );

    // Create new conversation metadata
    const now = new Date();

    const conversation: Conversation = {
      id: externalConversationId,
      participantIds: [createdBy],
      participantRoles: [UserRole.CUSTOMER], // External users start as customers
      messageCount: 0,
      lastMessageAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.conversationMetadata[externalConversationId] = conversation;

    // Add the creator as a participant
    const creatorParticipant: Participant = {
      userId: createdBy,
      userRole: UserRole.CUSTOMER,
      joinedAt: now,
    };

    this.participants.set(externalConversationId, [creatorParticipant]);

    // Broadcast conversation created event to dashboard
    if (this.gateway) {
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
      message.fromUserId === userId ||
      message.toRole === UserRole.CUSTOMER ||
      message.fromRole === UserRole.CUSTOMER
    );
  }
}
