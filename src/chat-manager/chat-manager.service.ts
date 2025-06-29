import { Injectable } from '@nestjs/common';
import { CreateMessageDto, MessageType } from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import {
  Message,
  Conversation,
  Participant,
  DashboardStats,
} from './interfaces/message.interface';

@Injectable()
export class ChatManagerService {
  // Temporary in-memory storage for Phase I
  private messages: Map<string, Message> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private participants: Map<string, Participant[]> = new Map();

  async createMessage(createMessageDto: CreateMessageDto): Promise<Message> {
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

    this.messages.set(messageId, message);
    await this.updateConversationActivity(createMessageDto.conversationId);

    return message;
  }

  async getConversations(userId?: string): Promise<Conversation[]> {
    const conversations = Array.from(this.conversations.values());

    if (userId) {
      return conversations.filter((conv) =>
        conv.participantIds.includes(userId),
      );
    }

    return conversations.filter((conv) => conv.isActive);
  }

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
          this.isMessageVisibleToUser(msg, query.userId),
      );
    }

    const startIndex = query.offset || 0;
    const endIndex = startIndex + (query.limit || 50);

    return filteredMessages.slice(startIndex, endIndex);
  }

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

  async joinConversation(
    conversationId: string,
    joinRoomDto: JoinRoomDto,
  ): Promise<Participant> {
    const participant: Participant = {
      userId: joinRoomDto.userId,
      userRole: joinRoomDto.userRole,
      joinedAt: new Date(),
    };

    const existingParticipants = this.participants.get(conversationId) || [];
    const isAlreadyParticipant = existingParticipants.some(
      (p) => p.userId === joinRoomDto.userId,
    );

    if (!isAlreadyParticipant) {
      existingParticipants.push(participant);
      this.participants.set(conversationId, existingParticipants);

      // Update conversation participant list
      const conversation = this.conversations.get(conversationId);
      if (conversation) {
        conversation.participantIds.push(joinRoomDto.userId);
        conversation.participantRoles.push(joinRoomDto.userRole);
        this.conversations.set(conversationId, conversation);
      }
    }

    return participant;
  }

  async getParticipants(conversationId: string): Promise<Participant[]> {
    return this.participants.get(conversationId) || [];
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const activeConversations = Array.from(this.conversations.values()).filter(
      (c) => c.isActive,
    );
    const totalMessages = this.messages.size;
    const allParticipants = new Set();

    this.participants.forEach((participantList) => {
      participantList.forEach((p) => allParticipants.add(p.userId));
    });

    return {
      activeConversations: activeConversations.length,
      totalMessages,
      activeUsers: allParticipants.size,
      queuedConversations: activeConversations.filter(
        (c) => c.participantIds.length === 1,
      ).length,
    };
  }

  // Helper methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private async updateConversationActivity(
    conversationId: string,
  ): Promise<void> {
    let conversation = this.conversations.get(conversationId);

    if (!conversation) {
      conversation = {
        id: conversationId,
        participantIds: [],
        participantRoles: [],
        messageCount: 0,
        lastMessageAt: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    conversation.messageCount += 1;
    conversation.lastMessageAt = new Date();
    conversation.updatedAt = new Date();

    this.conversations.set(conversationId, conversation);
  }

  private isMessageVisibleToUser(message: Message, userId: string): boolean {
    // Implement message visibility rules based on your business logic
    // This is a simplified version - you'll want to implement proper role-based visibility
    return true;
  }
}
