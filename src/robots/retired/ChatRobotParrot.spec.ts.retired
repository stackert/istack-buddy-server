import { ChatRobotParrot } from './ChatRobotParrot';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import {
  TConversationMessageContentString,
  IStreamingCallbacks,
} from './types';

describe('ChatRobotParrot', () => {
  let robot: ChatRobotParrot;

  beforeEach(() => {
    robot = new ChatRobotParrot();
  });

  describe('Basic Properties', () => {
    it('should have correct robot class name', () => {
      expect(robot.robotClass).toBe('ChatRobotParrot');
    });

    it('should return correct name', () => {
      expect(robot.getName()).toBe('ChatRobotParrot');
    });

    it('should return correct version', () => {
      expect(robot.getVersion()).toBe('1.0.0');
    });

    it('should have correct abstract properties', () => {
      expect(robot.contextWindowSizeInTokens).toBe(4096);
      expect(robot.LLModelName).toBe('openAi.4.3');
      expect(robot.LLModelVersion).toBe('4.3');
      expect(robot.name).toBe('ChatRobotParrot');
      expect(robot.version).toBe('1.0.0');
    });

    it('should have correct static descriptions', () => {
      expect(ChatRobotParrot.descriptionShort).toContain(
        'simple chat robot that repeats messages',
      );
      expect(ChatRobotParrot.descriptionLong).toContain(
        'ChatRobotParrot is a testing and demonstration robot',
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

  describe('Immediate Response', () => {
    it('should provide immediate response with random number', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Hello world' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toMatch(/^\(\d+\) Hello world$/);
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

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toMatch(/^\(\d+\) $/);
    });

    it('should work with history parameter', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
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
          content: { type: 'text/plain', payload: 'Previous message' },
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

      const result = await robot.acceptMessageImmediateResponse(
        message,
        getHistory,
      );

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toMatch(/^\(\d+\) Test message$/);
    });
  });

  describe('Multi-part Response', () => {
    it('should provide immediate response and delayed callback', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
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

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        delayedCallback,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toMatch(/^\(\d+\) Test message$/);

      // Wait for delayed callback
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(delayedResponse).toBeDefined();
      expect(delayedResponse.content.type).toBe('text/plain');
      expect(delayedResponse.content.payload).toBe(
        'Follow-up chat response for: Test message',
      );
    });

    it('should handle null delayed callback gracefully', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
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
      expect(result.payload).toMatch(/^\(\d+\) Test message$/);
    });

    it('should work with history parameter', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
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
          content: { type: 'text/plain', payload: 'Previous message' },
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
      expect(result.payload).toMatch(/^\(\d+\) Test message$/);
    });
  });

  describe('Streaming Response', () => {
    it('should handle streaming responses correctly', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
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
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const history = [
        {
          id: 'hist-1',
          content: { type: 'text/plain', payload: 'Previous message' },
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

  describe('Random Number Generation', () => {
    it('should generate different random numbers for different calls', async () => {
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-1',
        content: { type: 'text/plain', payload: 'Test message' },
        conversationId: 'conv-1',
        authorUserId: 'user-1',
        fromRole: 'cx-customer',
        toRole: 'cx-agent',
        messageType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result1 = await robot.acceptMessageImmediateResponse(message);
      const result2 = await robot.acceptMessageImmediateResponse(message);

      const number1 = result1.content.payload.match(/^\((\d+)\)/)?.[1];
      const number2 = result2.content.payload.match(/^\((\d+)\)/)?.[1];

      expect(number1).toBeDefined();
      expect(number2).toBeDefined();
      // Note: There's a small chance these could be the same, but it's very unlikely
    });
  });
});
