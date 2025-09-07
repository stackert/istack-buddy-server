import { MessageType, UserRole } from '../dto/create-message.dto';
import { TConversationMessageContent } from '../../ConversationLists/types';

export interface IConversationMessage<T = TConversationMessageContent> {
  id: string;
  content: T;
  conversationId: string;
  authorUserId: string | null;
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
  currentRobot?: string; // Track which robot is currently handling the conversation
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

// Anthropic message format
export interface IConversationMessageAnthropic {
  role: 'user' | 'assistant';
  content: string;
}

// OpenAI message format
export interface IConversationMessageOpenAI {
  role: 'user' | 'assistant';
  content: string;
}
