import { AbstractRobotChat } from './AbstractRobotChat';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import {
  TConversationMessageContentString,
  IStreamingCallbacks,
} from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

// Mock implementation of AbstractRobotChat for testing
class MockChatRobot extends AbstractRobotChat {
  readonly contextWindowSizeInTokens = 4000;
  readonly LLModelName = 'mock-chat-model';
  readonly LLModelVersion = '1.0';
  readonly name = 'MockChatRobot';
  readonly version = '1.0.0';

  async acceptMessageMultiPartResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    delayedMessageCallback: (
      response: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      >,
    ) => void,
    getHistory?: () => IConversationMessage<any>[],
  ): Promise<TConversationMessageContentString> {
    const response = {
      type: 'text/plain' as const,
      payload: `Mock multipart response to: ${message.content.payload}`,
    };

    delayedMessageCallback({
      content: response,
    });

    return response;
  }

  async acceptMessageStreamResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage<any>[],
  ): Promise<void> {
    const response = `Mock streaming response to: ${message.content.payload}`;

    // Simulate streaming
    callbacks.onStreamStart(message);

    const chunks = response.split(' ');
    for (const chunk of chunks) {
      callbacks.onStreamChunkReceived(chunk + ' ');
    }

    callbacks.onStreamFinished({
      id: 'mock-stream-id',
      content: { type: 'text/plain', payload: response },
      conversationId: message.conversationId,
      authorUserId: 'mock-robot',
      fromRole: UserRole.ROBOT,
      toRole: UserRole.CUSTOMER,
      messageType: MessageType.ROBOT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<any>[],
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  > {
    return {
      content: {
        type: 'text/plain',
        payload: `Mock immediate response to: ${message.content.payload}`,
      },
    };
  }

  estimateTokens(message: string): number {
    return Math.ceil(message.length / 4);
  }
}

describe('AbstractRobotChat', () => {
  let robot: MockChatRobot;

  beforeEach(() => {
    robot = new MockChatRobot();
  });

  describe('Basic Properties', () => {
    it('should have correct robot class name', () => {
      expect(robot.robotClass).toBe('MockChatRobot');
    });

    it('should return correct name', () => {
      expect(robot.getName()).toBe('MockChatRobot');
    });

    it('should return correct version', () => {
      expect(robot.getVersion()).toBe('1.0.0');
    });

    it('should have correct abstract properties', () => {
      expect(robot.contextWindowSizeInTokens).toBe(4000);
      expect(robot.LLModelName).toBe('mock-chat-model');
      expect(robot.LLModelVersion).toBe('1.0');
      expect(robot.name).toBe('MockChatRobot');
      expect(robot.version).toBe('1.0.0');
    });
  });

  describe('Message Transformer', () => {
    it('should transform messages using Anthropic format', () => {
      const message: IConversationMessage = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Hello from customer' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const transformer = robot.getGetFromRobotToConversationTransformer();
      const result = transformer(message);

      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello from customer');
    });

    it('should transform robot messages to assistant role', () => {
      const message: IConversationMessage = {
        id: 'test-2',
        content: { type: 'text/plain', payload: 'Robot response' },
        conversationId: 'conv-1',
        authorUserId: 'robot-1',
        fromRole: UserRole.ROBOT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.ROBOT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const transformer = robot.getGetFromRobotToConversationTransformer();
      const result = transformer(message);

      expect(result.role).toBe('assistant');
      expect(result.content).toBe('Robot response');
    });
  });

  describe('Immediate Response', () => {
    it('should handle immediate responses correctly', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toContain(
        'Mock immediate response to: Test message',
      );
    });

    it('should work with history parameter', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const history = [
        {
          id: 'hist-1',
          content: { type: 'text/plain', payload: 'Previous message' },
          conversationId: 'conv-1',
          authorUserId: 'user-1',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
          messageType: MessageType.TEXT,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const getHistory = () => history;

      const result = await robot.acceptMessageImmediateResponse(
        message,
        getHistory,
      );

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toContain(
        'Mock immediate response to: Test message',
      );
    });
  });

  describe('Streaming Response', () => {
    it('should handle streaming responses correctly', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const callbacks: IStreamingCallbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onStreamStart).toHaveBeenCalledWith(message);
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalled();
      expect(callbacks.onStreamFinished).toHaveBeenCalled();
    });

    it('should work with history parameter', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const history = [
        {
          id: 'hist-1',
          content: { type: 'text/plain', payload: 'Previous message' },
          conversationId: 'conv-1',
          authorUserId: 'user-1',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
          messageType: MessageType.TEXT,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const getHistory = () => history;

      const callbacks: IStreamingCallbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };

      await robot.acceptMessageStreamResponse(message, callbacks, getHistory);

      expect(callbacks.onStreamStart).toHaveBeenCalledWith(message);
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalled();
      expect(callbacks.onStreamFinished).toHaveBeenCalled();
    });
  });

  describe('Multi-part Response', () => {
    it('should handle multi-part responses correctly', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let delayedResponse: any = null;
      const delayedCallback = (response: any) => {
        delayedResponse = response;
      };

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        delayedCallback,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toContain(
        'Mock multipart response to: Test message',
      );
      expect(delayedResponse).toBeDefined();
      expect(delayedResponse.content.type).toBe('text/plain');
      expect(delayedResponse.content.payload).toContain(
        'Mock multipart response to: Test message',
      );
    });
  });
});
