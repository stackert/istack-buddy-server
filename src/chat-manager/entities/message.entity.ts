import { MessageType, UserRole } from '../dto/create-message.dto';

export class MessageEntity {
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

export class ConversationEntity {
  id: string;
  participantIds: string[];
  participantRoles: UserRole[];
  messageCount: number;
  lastMessageAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
