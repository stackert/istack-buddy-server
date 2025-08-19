import { AbstractRobot } from './AbstractRobot';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

// Mock implementation of AbstractRobot for testing
class MockRobot extends AbstractRobot {
  readonly contextWindowSizeInTokens = 4000;
  readonly LLModelName = 'mock-model';
  readonly LLModelVersion = '1.0';
  readonly name = 'MockRobot';
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
      payload: `Mock response to: ${message.content.payload}`,
    };

    // Call delayed callback
    delayedMessageCallback({
      content: response,
    });

    return response;
  }

  estimateTokens(message: string): number {
    return Math.ceil(message.length / 4);
  }
}

describe('AbstractRobot', () => {
  let robot: MockRobot;

  beforeEach(() => {
    robot = new MockRobot();
  });

  describe('Basic Properties', () => {
    it('should have correct robot class name', () => {
      expect(robot.robotClass).toBe('MockRobot');
    });

    it('should return correct name', () => {
      expect(robot.getName()).toBe('MockRobot');
    });

    it('should return correct version', () => {
      expect(robot.getVersion()).toBe('1.0.0');
    });

    it('should have correct abstract properties', () => {
      expect(robot.contextWindowSizeInTokens).toBe(4000);
      expect(robot.LLModelName).toBe('mock-model');
      expect(robot.LLModelVersion).toBe('1.0');
      expect(robot.name).toBe('MockRobot');
      expect(robot.version).toBe('1.0.0');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      expect(robot.estimateTokens('Hello world')).toBe(3); // 11 chars / 4 = 3
      expect(robot.estimateTokens('')).toBe(0);
      expect(
        robot.estimateTokens('A very long message with many characters'),
      ).toBe(10); // 40 chars / 4 = 10
    });
  });

  describe('Message Transformer', () => {
    it('should transform customer messages to user role', () => {
      const message: IConversationMessage = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Hello' },
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
      expect(result.content).toBe('Hello');
    });

    it('should transform agent messages to user role', () => {
      const message: IConversationMessage = {
        id: 'test-2',
        content: { type: 'text/plain', payload: 'Response' },
        conversationId: 'conv-1',
        authorUserId: 'agent-1',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const transformer = robot.getGetFromRobotToConversationTransformer();
      const result = transformer(message);

      expect(result.role).toBe('user');
      expect(result.content).toBe('Response');
    });

    it('should transform robot messages to assistant role', () => {
      const message: IConversationMessage = {
        id: 'test-3',
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
      expect(result.payload).toContain('Mock response to: Test message');
      expect(delayedResponse).toBeDefined();
      expect(delayedResponse.content.type).toBe('text/plain');
      expect(delayedResponse.content.payload).toContain(
        'Mock response to: Test message',
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

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        () => {},
        getHistory,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toContain('Mock response to: Test message');
    });
  });
});
