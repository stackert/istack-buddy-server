import { Injectable } from '@nestjs/common';
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

@Injectable()
export class ChatManagerService {
  // In-memory storage for conversations and messages
  private messages: Map<string, Message> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private participants: Map<string, Participant[]> = new Map();
  private gateway: any; // Will be set by the gateway

  constructor() {
    // Clean constructor - no robot dependencies
  }

  // Method to set the gateway reference (called by the gateway)
  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  /**
   * Add a message to a conversation
   * This is the core method - all messages go through here
   */
  async addMessage(createMessageDto: CreateMessageDto): Promise<Message> {
    const messageId = this.generateId();
    const now = new Date();

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
      createdAt: now,
      updatedAt: now,
    };

    // Store the message
    this.messages.set(messageId, message);

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
  async createMessage(createMessageDto: CreateMessageDto): Promise<Message> {
    return this.addMessage(createMessageDto);
  }

  /**
   * Add a message from external sources (Slack, API, etc.)
   * Simplified version of addMessage with sensible defaults
   */
  async addExternalMessage(
    conversationId: string,
    fromUserId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    fromRole: UserRole = UserRole.CUSTOMER,
    toRole: UserRole = UserRole.AGENT,
  ): Promise<Message> {
    return this.addMessage({
      content,
      conversationId,
      fromUserId,
      fromRole,
      toRole,
      messageType,
    });
  }

  /**
   * Get all conversations
   */
  async getConversations(userId?: string): Promise<Conversation[]> {
    let conversations = Array.from(this.conversations.values());

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
   * Get messages for a conversation with filtering and pagination
   */
  async getMessages(
    conversationId: string,
    query: GetMessagesDto,
  ): Promise<Message[]> {
    const allMessages = Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
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
    const messages = Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, count);

    return messages.reverse(); // Return in chronological order
  }

  /**
   * Join a conversation as a participant
   */
  async joinConversation(
    conversationId: string,
    joinRoomDto: JoinRoomDto,
  ): Promise<Participant> {
    const conversation = this.conversations.get(conversationId);
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
        this.conversations.set(conversationId, conversation);
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
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      const userIndex = conversation.participantIds.indexOf(userId);
      if (userIndex !== -1) {
        conversation.participantIds.splice(userIndex, 1);
        conversation.participantRoles.splice(userIndex, 1);
        this.conversations.set(conversationId, conversation);
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

    const conversations = Array.from(this.conversations.values());
    const messages = Array.from(this.messages.values());

    const activeConversations = conversations.filter((c) => c.isActive).length;
    const recentMessages = messages.filter((m) => m.createdAt > oneHourAgo);
    const activeUsers = new Set(recentMessages.map((m) => m.fromUserId)).size;

    return {
      activeConversations,
      totalMessages: messages.length,
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

    // Store conversation
    this.conversations.set(conversationId, conversation);

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
    const existingConversation = this.conversations.get(externalConversationId);
    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const now = new Date();
    const displayName = channelName
      ? `${source} - ${channelName}`
      : `${source} - ${externalConversationId}`;

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

    this.conversations.set(externalConversationId, conversation);

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
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return;
    }

    // Update conversation statistics
    conversation.messageCount += 1;
    const now = new Date();
    conversation.lastMessageAt = now;
    conversation.updatedAt = now;

    this.conversations.set(conversationId, conversation);

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

  private isMessageVisibleToUser(message: Message, userId: string): boolean {
    // Simple visibility logic - can be enhanced based on your requirements
    return (
      message.fromUserId === userId ||
      message.toRole === UserRole.CUSTOMER ||
      message.fromRole === UserRole.CUSTOMER
    );
  }
}
