import { IConversationMessage } from '../../src/chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from '../../src/robots/types';
import {
  UserRole,
  MessageType,
} from '../../src/chat-manager/dto/create-message.dto';

/**
 * Reusable mock conversation messages for testing
 */
export const mockConversationMessages = {
  // Basic customer message
  customerMessage: (
    content: string = 'Hello, can you help me?',
  ): IConversationMessage<TConversationMessageContentString> => ({
    id: 'msg-customer-1',
    conversationId: 'conv-1',
    authorUserId: 'user-1',
    fromRole: UserRole.CUSTOMER,
    toRole: UserRole.AGENT,
    messageType: MessageType.TEXT,
    content: { type: 'text/plain', payload: content },
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  }),

  // Agent message
  agentMessage: (
    content: string = 'I can help you with that.',
  ): IConversationMessage<TConversationMessageContentString> => ({
    id: 'msg-agent-1',
    conversationId: 'conv-1',
    authorUserId: 'agent-1',
    fromRole: UserRole.AGENT,
    toRole: UserRole.CUSTOMER,
    messageType: MessageType.TEXT,
    content: { type: 'text/plain', payload: content },
    createdAt: new Date('2024-01-01T10:01:00Z'),
    updatedAt: new Date('2024-01-01T10:01:00Z'),
  }),

  // Robot message
  robotMessage: (
    content: string = 'I am a robot assistant.',
  ): IConversationMessage<TConversationMessageContentString> => ({
    id: 'msg-robot-1',
    conversationId: 'conv-1',
    authorUserId: 'robot-1',
    fromRole: UserRole.ROBOT,
    toRole: UserRole.CUSTOMER,
    messageType: MessageType.ROBOT,
    content: { type: 'text/plain', payload: content },
    createdAt: new Date('2024-01-01T10:02:00Z'),
    updatedAt: new Date('2024-01-01T10:02:00Z'),
  }),

  // Form-related message for Marv
  formMessage: (
    content: string = 'Can you help me with form 123456?',
  ): IConversationMessage<TConversationMessageContentString> => ({
    id: 'msg-form-1',
    conversationId: 'conv-1',
    authorUserId: 'user-1',
    fromRole: UserRole.CUSTOMER,
    toRole: UserRole.AGENT,
    messageType: MessageType.TEXT,
    content: { type: 'text/plain', payload: content },
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  }),

  // Slack-related message for Slacky
  slackMessage: (
    content: string = 'I need help with SSO configuration.',
  ): IConversationMessage<TConversationMessageContentString> => ({
    id: 'msg-slack-1',
    conversationId: 'conv-1',
    authorUserId: 'slack-user-1',
    fromRole: UserRole.CUSTOMER,
    toRole: UserRole.AGENT,
    messageType: MessageType.TEXT,
    content: { type: 'text/plain', payload: content },
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  }),
};

/**
 * Mock conversation history
 */
export const mockConversationHistory = [
  mockConversationMessages.customerMessage('First message'),
  mockConversationMessages.agentMessage('First response'),
  mockConversationMessages.customerMessage('Follow-up question'),
];

/**
 * Mock streaming callbacks
 */
export const mockStreamingCallbacks = {
  onStreamChunkReceived: jest.fn(),
  onStreamStart: jest.fn(),
  onStreamFinished: jest.fn(),
  onFullMessageReceived: jest.fn(),
  onError: jest.fn(),
};

/**
 * Reset all mock callbacks
 */
export const resetMockCallbacks = () => {
  Object.values(mockStreamingCallbacks).forEach((callback) => {
    if (jest.isMockFunction(callback)) {
      callback.mockClear();
    }
  });
};
