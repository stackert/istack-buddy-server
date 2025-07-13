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
  // Temporary in-memory storage for Phase I
  private messages: Map<string, Message> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private participants: Map<string, Participant[]> = new Map();

  constructor() {
    this.initializePseudoConversations();
  }

  private initializePseudoConversations(): void {
    const now = new Date();

    // Debug Conversation 1: Customer Support Session
    const debugConv1: Conversation = {
      id: 'debug-conv-customer-support-001',
      participantIds: ['debug-user-customer-001', 'debug-user-agent-001'],
      participantRoles: [UserRole.CUSTOMER, UserRole.AGENT],
      messageCount: 3,
      lastMessageAt: new Date(now.getTime() - 300000), // 5 minutes ago
      isActive: true,
      createdAt: new Date(now.getTime() - 1800000), // 30 minutes ago
      updatedAt: new Date(now.getTime() - 300000),
    };

    // Debug Conversation 2: Agent-Supervisor Discussion
    const debugConv2: Conversation = {
      id: 'debug-conv-agent-supervisor-001',
      participantIds: ['debug-user-agent-001', 'debug-user-supervisor-001'],
      participantRoles: [UserRole.AGENT, UserRole.SUPERVISOR],
      messageCount: 2,
      lastMessageAt: new Date(now.getTime() - 600000), // 10 minutes ago
      isActive: true,
      createdAt: new Date(now.getTime() - 2400000), // 40 minutes ago
      updatedAt: new Date(now.getTime() - 600000),
    };

    // Debug Conversation 3: Multi-party Support Session
    const debugConv3: Conversation = {
      id: 'debug-conv-multiparty-support-001',
      participantIds: [
        'debug-user-customer-002',
        'debug-user-agent-002',
        'debug-user-supervisor-001',
      ],
      participantRoles: [
        UserRole.CUSTOMER,
        UserRole.AGENT,
        UserRole.SUPERVISOR,
      ],
      messageCount: 5,
      lastMessageAt: new Date(now.getTime() - 120000), // 2 minutes ago
      isActive: true,
      createdAt: new Date(now.getTime() - 3600000), // 1 hour ago
      updatedAt: new Date(now.getTime() - 120000),
    };

    // Debug Conversation 4: Robot Integration Test
    const debugConv4: Conversation = {
      id: 'debug-conv-robot-integration-001',
      participantIds: ['debug-user-agent-001', 'debug-robot-001'],
      participantRoles: [UserRole.AGENT, UserRole.ROBOT],
      messageCount: 4,
      lastMessageAt: new Date(now.getTime() - 60000), // 1 minute ago
      isActive: true,
      createdAt: new Date(now.getTime() - 900000), // 15 minutes ago
      updatedAt: new Date(now.getTime() - 60000),
    };

    // Store debug conversations
    this.conversations.set(debugConv1.id, debugConv1);
    this.conversations.set(debugConv2.id, debugConv2);
    this.conversations.set(debugConv3.id, debugConv3);
    this.conversations.set(debugConv4.id, debugConv4);

    // Initialize participants for debug conversations
    this.initializeDebugParticipants();

    // Initialize some debug messages
    this.initializeDebugMessages();
  }

  private initializeDebugParticipants(): void {
    const now = new Date();

    // Participants for debug conversation 1
    this.participants.set('debug-conv-customer-support-001', [
      {
        userId: 'debug-user-customer-001',
        userRole: UserRole.CUSTOMER,
        joinedAt: new Date(now.getTime() - 1800000),
      },
      {
        userId: 'debug-user-agent-001',
        userRole: UserRole.AGENT,
        joinedAt: new Date(now.getTime() - 1800000),
      },
    ]);

    // Participants for debug conversation 2
    this.participants.set('debug-conv-agent-supervisor-001', [
      {
        userId: 'debug-user-agent-001',
        userRole: UserRole.AGENT,
        joinedAt: new Date(now.getTime() - 2400000),
      },
      {
        userId: 'debug-user-supervisor-001',
        userRole: UserRole.SUPERVISOR,
        joinedAt: new Date(now.getTime() - 2400000),
      },
    ]);

    // Participants for debug conversation 3
    this.participants.set('debug-conv-multiparty-support-001', [
      {
        userId: 'debug-user-customer-002',
        userRole: UserRole.CUSTOMER,
        joinedAt: new Date(now.getTime() - 3600000),
      },
      {
        userId: 'debug-user-agent-002',
        userRole: UserRole.AGENT,
        joinedAt: new Date(now.getTime() - 3600000),
      },
      {
        userId: 'debug-user-supervisor-001',
        userRole: UserRole.SUPERVISOR,
        joinedAt: new Date(now.getTime() - 3000000),
      },
    ]);

    // Participants for debug conversation 4
    this.participants.set('debug-conv-robot-integration-001', [
      {
        userId: 'debug-user-agent-001',
        userRole: UserRole.AGENT,
        joinedAt: new Date(now.getTime() - 900000),
      },
      {
        userId: 'debug-robot-001',
        userRole: UserRole.ROBOT,
        joinedAt: new Date(now.getTime() - 900000),
      },
    ]);
  }

  private initializeDebugMessages(): void {
    const now = new Date();

    // Messages for debug conversation 1
    const debugMessages1: Message[] = [
      {
        id: 'debug-msg-001',
        content: 'Hi, I need help with my billing account',
        conversationId: 'debug-conv-customer-support-001',
        fromUserId: 'debug-user-customer-001',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(now.getTime() - 1800000),
        updatedAt: new Date(now.getTime() - 1800000),
      },
      {
        id: 'debug-msg-002',
        content:
          'server response to: Hello! I can help you with your billing. What specific issue are you experiencing?',
        conversationId: 'debug-conv-customer-support-001',
        fromUserId: 'debug-user-agent-001',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date(now.getTime() - 1500000),
        updatedAt: new Date(now.getTime() - 1500000),
      },
      {
        id: 'debug-msg-003',
        content: 'I was charged twice for the same service this month',
        conversationId: 'debug-conv-customer-support-001',
        fromUserId: 'debug-user-customer-001',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(now.getTime() - 300000),
        updatedAt: new Date(now.getTime() - 300000),
      },
    ];

    // Messages for debug conversation 2
    const debugMessages2: Message[] = [
      {
        id: 'debug-msg-004',
        content: 'I need help with this billing dispute case',
        conversationId: 'debug-conv-agent-supervisor-001',
        fromUserId: 'debug-user-agent-001',
        fromRole: UserRole.AGENT,
        toRole: UserRole.SUPERVISOR,
        messageType: MessageType.TEXT,
        createdAt: new Date(now.getTime() - 1200000),
        updatedAt: new Date(now.getTime() - 1200000),
      },
      {
        id: 'debug-msg-005',
        content:
          'server response to: I can help you with that. Please provide the case details.',
        conversationId: 'debug-conv-agent-supervisor-001',
        fromUserId: 'debug-user-supervisor-001',
        fromRole: UserRole.SUPERVISOR,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(now.getTime() - 600000),
        updatedAt: new Date(now.getTime() - 600000),
      },
    ];

    // Messages for debug conversation 4 (Robot Integration)
    const debugMessages4: Message[] = [
      {
        id: 'debug-msg-006',
        content: 'Can you help me analyze this customer data?',
        conversationId: 'debug-conv-robot-integration-001',
        fromUserId: 'debug-user-agent-001',
        fromRole: UserRole.AGENT,
        toRole: UserRole.ROBOT,
        messageType: MessageType.TEXT,
        createdAt: new Date(now.getTime() - 900000),
        updatedAt: new Date(now.getTime() - 900000),
      },
      {
        id: 'debug-msg-007',
        content:
          'server response to: I can help you analyze customer data. Please provide the specific data you would like me to examine.',
        conversationId: 'debug-conv-robot-integration-001',
        fromUserId: 'debug-robot-001',
        fromRole: UserRole.ROBOT,
        toRole: UserRole.AGENT,
        messageType: MessageType.ROBOT,
        createdAt: new Date(now.getTime() - 600000),
        updatedAt: new Date(now.getTime() - 600000),
      },
    ];

    // Store all debug messages
    [...debugMessages1, ...debugMessages2, ...debugMessages4].forEach(
      (message) => {
        this.messages.set(message.id, message);
      },
    );
  }

  async createMessage(createMessageDto: CreateMessageDto): Promise<Message> {
    const messageId = this.generateId();
    const now = new Date();

    // Add server echo prefix to all messages
    const echoContent = `server response to: ${createMessageDto.content}`;

    const message: Message = {
      id: messageId,
      content: echoContent,
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
          this.isMessageVisibleToUser(msg, query.userId!),
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

    this.conversations.set(conversationId, conversation);

    // Add the creator as a participant
    const creatorParticipant: Participant = {
      userId: startConversationDto.createdBy,
      userRole: startConversationDto.createdByRole,
      joinedAt: now,
    };

    this.participants.set(conversationId, [creatorParticipant]);

    // If there are initial participants, add them as well
    if (
      startConversationDto.initialParticipants &&
      startConversationDto.initialParticipants.length > 0
    ) {
      const existingParticipants = this.participants.get(conversationId) || [];

      for (const participantId of startConversationDto.initialParticipants) {
        // Don't add the creator again
        if (participantId !== startConversationDto.createdBy) {
          const participant: Participant = {
            userId: participantId,
            userRole: UserRole.CUSTOMER, // Default role for invited participants
            joinedAt: now,
          };

          existingParticipants.push(participant);

          // Update conversation participant tracking
          conversation.participantIds.push(participantId);
          conversation.participantRoles.push(UserRole.CUSTOMER);
        }
      }

      this.participants.set(conversationId, existingParticipants);
    }

    return conversation;
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
