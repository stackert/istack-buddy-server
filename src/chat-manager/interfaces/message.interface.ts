import { MessageType, UserRole } from '../dto/create-message.dto';

export interface IConversationMessage {
  id: string;
  content: string;
  conversationId: string;
  fromUserId: string | null;
  fromRole: UserRole;
  toRole: UserRole;
  messageType: MessageType;
  threadId?: string;
  originalMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantRoles: UserRole[];
  messageCount: number;
  lastMessageAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  userId: string;
  userRole: UserRole;
  joinedAt: Date;
}

export interface DashboardStats {
  activeConversations: number;
  totalMessages: number;
  activeUsers: number;
  queuedConversations: number;
}
