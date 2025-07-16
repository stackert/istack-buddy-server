import { Injectable } from '@nestjs/common';
import { writeFileSync } from 'fs';
import { join } from 'path';
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
  Message,
  Conversation,
  Participant,
  DashboardStats,
} from './interfaces/message.interface';
import { v4 as uuidv4 } from 'uuid';
import { ConversationListSlackAppService } from '../ConversationLists/ConversationListService';
import {
  TConversationMessageEnvelope,
  TConversationTextMessage,
  TConversationTextMessageEnvelope,
} from '../ConversationLists/types';

@Injectable()
export class ChatManagerService {
  // In-memory storage for conversation metadata and participants
  private conversationMetadata: Record<string, Conversation> = {};
  private participants: Map<string, Participant[]> = new Map();
  private gateway: any; // Will be set by the gateway

  // Message deduplication tracking
  private messageContentHashes: Map<string, string> = new Map(); // contentHash -> messageId

  constructor(
    private readonly conversationListService: ConversationListSlackAppService,
  ) {}

  // Method to set the gateway reference (called by the gateway)
  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  /**
   * Convert Message to TConversationMessageEnvelope format for storage
   */
  private messageToEnvelope(
    message: Message,
  ): TConversationTextMessageEnvelope {
    const conversationMessage: TConversationTextMessage = {
      messageId: message.id,
      author_role: message.fromRole,
      content: {
        type: 'text/plain',
        payload: message.content,
      },
      created_at: message.createdAt.toISOString(),
      estimated_token_count: Math.ceil(message.content.length / 4), // Rough token estimate
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
  private envelopeToMessage(envelope: any, conversationId: string): Message {
    const payload = envelope.envelope.envelopePayload;
    return {
      id: payload.messageId,
      content: payload.content.payload,
      conversationId: conversationId,
      fromUserId: 'unknown', // This info is lost in conversion - may need to store separately
      fromRole: payload.author_role as UserRole,
      toRole: UserRole.AGENT, // Default, may need to store separately
      messageType: MessageType.TEXT,
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
   * Check if message is duplicate based on content hash
   */
  private isDuplicateMessage(
    contentHash: string,
    conversationId: string,
  ): boolean {
    const existingMessageId = this.messageContentHashes.get(contentHash);

    if (existingMessageId) {
      // Check if message exists in conversation list
      const conversationList =
        this.conversationListService.getConversationById(conversationId);
      if (
        conversationList &&
        conversationList.hasMessageEnvelope(existingMessageId)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add a message to a conversation
   * This is the core method - all messages go through here
   */
  async addMessage(createMessageDto: CreateMessageDto): Promise<Message> {
    const messageId = uuidv4();
    const now = new Date();

    // Generate content hash for deduplication
    const contentHash = this.generateMessageContentHash(createMessageDto);

    // AI - DO NOT REMOVE THIS COMMENT
    // I think we dont care.  I *think* our logic/code is goofed (we're failing to properly parse events)
    // if we're finding duplicates.  Eg: if we have duplication issues it was upstream and that is where it
    // needs to be fixed.  This is a consequence of the Slacky robot.
    // Check for duplicate message
    if (this.isDuplicateMessage(contentHash, createMessageDto.conversationId)) {
      const existingMessageId = this.messageContentHashes.get(contentHash);
      console.log(`Duplicate message detected in conversation ${createMessageDto.conversationId}:
        Content Hash: ${contentHash}
        Existing Message ID: ${existingMessageId}
        New Message Content: ${createMessageDto.content.substring(0, 100)}...`);

      // Get existing message from conversation list and return it
      const conversationList = this.conversationListService.getConversationById(
        createMessageDto.conversationId,
      );
      if (conversationList) {
        const envelope = conversationList.getMessageEnvelopeById(
          existingMessageId!,
        );
        if (envelope) {
          return this.envelopeToMessage(
            envelope,
            createMessageDto.conversationId,
          );
        }
      }
    }

    // Ensure conversation exists in conversation list service
    const conversationList =
      this.conversationListService.getConversationOrCreate(
        createMessageDto.conversationId,
        `Conversation ${createMessageDto.conversationId}`,
        `Auto-created conversation for ${createMessageDto.conversationId}`,
      );

    const message: Message = {
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

    // Store content hash for deduplication
    this.messageContentHashes.set(contentHash, messageId);

    // Update conversation activity
    await this.updateConversationActivity(createMessageDto.conversationId);

    // Log entire conversation to JSON file
    await this.logConversation(createMessageDto.conversationId);

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
  async createMessage(createMessageDto: CreateMessageDto): Promise<Message> {
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
  ): Promise<Message[]> {
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
  ): Promise<Message[]> {
    const conversationList =
      this.conversationListService.getConversationById(conversationId);
    if (!conversationList) {
      return [];
    }

    const envelopes = conversationList.getLastAddedEnvelopes().slice(0, count);
    const messages = envelopes
      .map((envelope) => this.envelopeToMessage(envelope, conversationId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return messages.reverse(); // Return in chronological order
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

    for (const conversationId of this.conversationListService.getAllConversationIds()) {
      const conversationList =
        this.conversationListService.getConversationById(conversationId);
      if (conversationList) {
        totalMessages += conversationList.getMessageCount();

        // Check for recent messages to count active users
        const envelopes = conversationList.getLastAddedEnvelopes();
        for (const envelope of envelopes) {
          const message = this.envelopeToMessage(envelope, conversationId);
          if (message.createdAt > oneHourAgo) {
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
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
   * Log entire conversation to JSON file for debugging
   * Enhanced with deduplication information
   */
  private async logConversation(conversationId: string): Promise<void> {
    try {
      // Get all messages for this conversation from conversation list
      const conversationList =
        this.conversationListService.getConversationById(conversationId);
      if (!conversationList) {
        return;
      }

      const envelopes = conversationList.getLastAddedEnvelopes();
      const conversationMessages = envelopes
        .map((envelope) => this.envelopeToMessage(envelope, conversationId))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Get conversation metadata
      const conversation = this.conversationMetadata[conversationId];
      const participants = this.participants.get(conversationId) || [];

      // Calculate content hashes for all messages in this conversation
      const messageHashes = conversationMessages.map((msg) => {
        const contentToHash = {
          content: msg.content,
          conversationId: msg.conversationId,
          fromUserId: msg.fromUserId,
          fromRole: msg.fromRole,
          toRole: msg.toRole,
          messageType: msg.messageType,
        };
        return {
          messageId: msg.id,
          contentHash: createHash('md5')
            .update(JSON.stringify(contentToHash))
            .digest('hex'),
          timestamp: msg.createdAt.toISOString(),
        };
      });

      // Detect potential duplicates within conversation
      const duplicateHashes = new Map<string, string[]>();
      messageHashes.forEach(({ messageId, contentHash }) => {
        if (!duplicateHashes.has(contentHash)) {
          duplicateHashes.set(contentHash, []);
        }
        duplicateHashes.get(contentHash)!.push(messageId);
      });

      const duplicateGroups = Array.from(duplicateHashes.entries())
        .filter(([_, messageIds]) => messageIds.length > 1)
        .map(([contentHash, messageIds]) => ({ contentHash, messageIds }));

      // Create enhanced log object
      const logData = {
        conversationId,
        timestamp: new Date().toISOString(),
        conversation: conversation || null,
        participants,
        messageCount: conversationMessages.length,
        deduplicationInfo: {
          totalContentHashes: messageHashes.length,
          duplicateGroups: duplicateGroups.length,
          duplicateDetails: duplicateGroups,
        },
        messages: conversationMessages,
        messageHashes,
      };

      // Write to JSON file
      const logDir = join(
        process.cwd(),
        'docs-living',
        'debug-logging',
        'conversations',
      );
      const logFile = join(logDir, `conversation-${conversationId}.json`);

      writeFileSync(logFile, JSON.stringify(logData, null, 2), 'utf8');

      console.log(
        `Conversation logged: ${logFile} (${conversationMessages.length} messages, ${duplicateGroups.length} duplicate groups)`,
      );

      if (duplicateGroups.length > 0) {
        console.log(`Duplicate message groups found in conversation ${conversationId}:
${duplicateGroups
  .map(
    ({ contentHash, messageIds }) =>
      `Hash: ${contentHash} -> Messages: ${messageIds.join(', ')}`,
  )
  .join('\n')}`);
      }
    } catch (error) {
      console.error('Error logging conversation:', error);
    }
  }

  private isMessageVisibleToUser(message: Message, userId: string): boolean {
    // Simple visibility logic - can be enhanced based on your requirements
    return (
      message.fromUserId === userId ||
      message.toRole === UserRole.CUSTOMER ||
      message.fromRole === UserRole.CUSTOMER
    );
  }
}
