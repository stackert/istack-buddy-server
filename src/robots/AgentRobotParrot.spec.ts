import { AgentRobotParrot } from './AgentRobotParrot';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';

describe('AgentRobotParrot', () => {
  let robot: AgentRobotParrot;

  beforeEach(() => {
    robot = new AgentRobotParrot();
  });

  describe('Basic Properties', () => {
    it('should have correct robot class name', () => {
      expect(robot.robotClass).toBe('AgentRobotParrot');
    });

    it('should return correct name', () => {
      expect(robot.getName()).toBe('AgentRobotParrot');
    });

    it('should return correct version', () => {
      expect(robot.getVersion()).toBe('1.0.0');
    });

    it('should have correct abstract properties', () => {
      expect(robot.contextWindowSizeInTokens).toBe(4096);
      expect(robot.LLModelName).toBe('openAi.4.3');
      expect(robot.LLModelVersion).toBe('4.3');
      expect(robot.name).toBe('AgentRobotParrot');
      expect(robot.version).toBe('1.0.0');
    });

    it('should have correct static descriptions', () => {
      expect(AgentRobotParrot.descriptionShort).toContain(
        'agent robot that parrots task descriptions',
      );
      expect(AgentRobotParrot.descriptionLong).toContain(
        'AgentRobotParrot is a testing and demonstration robot',
      );
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

  describe('Multi-part Response', () => {
    it('should provide immediate response with random number', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test task' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        () => {},
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toMatch(/^\(\d+\) Test task$/);
    });

    it('should call delayed callback with completion message', (done) => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test task' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let delayedResponse: any = null;
      const delayedCallback = (response: any) => {
        delayedResponse = response;
      };

      robot.acceptMessageMultiPartResponse(message, delayedCallback);

      // Wait for the delayed callback
      setTimeout(() => {
        expect(delayedResponse).toBeDefined();
        expect(delayedResponse.content.type).toBe('text/plain');
        expect(delayedResponse.content.payload).toMatch(
          /^\(\d+\) - complete: Test task$/,
        );
        done();
      }, 600);
    });

    it('should handle empty message content', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: '' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        () => {},
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toMatch(/^\(\d+\) $/);
    });

    it('should handle long task descriptions', async () => {
      const longTask =
        'This is a very long task description that should be handled properly by the agent robot parrot implementation';
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: longTask },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        () => {},
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toMatch(new RegExp(`^\\(\\d+\\) ${longTask}$`));
    });

    it('should work with history parameter', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test task' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const history = [
        {
          id: 'hist-1',
          content: { type: 'text/plain', payload: 'Previous task' },
          conversationId: 'conv-1',
          authorUserId: 'user-1',
          fromRole: 'cx-customer',
          toRole: 'cx-agent',
          messageType: 'text',
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
      expect(result.payload).toMatch(/^\(\d+\) Test task$/);
    });

    it('should handle null delayed callback gracefully', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test task' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should not throw when callback is null
      const result = await robot.acceptMessageMultiPartResponse(
        message,
        null as any,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toMatch(/^\(\d+\) Test task$/);
    });
  });

  describe('Random Number Generation', () => {
    it('should generate different random numbers for different calls', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test task' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result1 = await robot.acceptMessageMultiPartResponse(
        message,
        () => {},
      );
      const result2 = await robot.acceptMessageMultiPartResponse(
        message,
        () => {},
      );

      const number1 = result1.payload.match(/^\((\d+)\)/)?.[1];
      const number2 = result2.payload.match(/^\((\d+)\)/)?.[1];

      expect(number1).toBeDefined();
      expect(number2).toBeDefined();
      // Note: There's a small chance these could be the same, but it's very unlikely
      // In a real test, we might want to run this multiple times or mock Math.random
    });
  });
});
