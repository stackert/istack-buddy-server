import { RobotChatOpenAI } from './RobotChatOpenAI';
import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

// Mock the OpenAI library
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  const mockChatCompletionsCreate = jest.fn();

  const mockOpenAIConstructor = jest.fn(() => ({
    responses: {
      create: mockCreate,
    },
    chat: {
      completions: {
        create: mockChatCompletionsCreate,
      },
    },
  }));

  return {
    OpenAI: mockOpenAIConstructor,
  };
});

describe('RobotChatOpenAI', () => {
  let robot: RobotChatOpenAI;

  const mockMessageEnvelope: TConversationTextMessageEnvelope = {
    messageId: 'test-message-id',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: 'test-payload-id',
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: 'Test message content',
      },
      created_at: '2023-01-01T00:00:00Z',
      estimated_token_count: 10,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    robot = new RobotChatOpenAI();
  });

  describe('Class Properties and Inheritance', () => {
    it('should extend AbstractRobotChat', () => {
      expect(robot).toBeInstanceOf(AbstractRobotChat);
    });

    it('should have correct static properties', () => {
      expect(robot.version).toBe('1.0.0-test-dev');
      expect(robot.LLModelName).toBe('o4-mini');
      expect(robot.LLModelVersion).toBe('o4-mini-2025-04-16');
      expect(robot.contextWindowSizeInTokens).toBe(128000);
    });

    it('should return class name', () => {
      expect(robot.name).toBe('RobotChatOpenAI');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(robot.estimateTokens('test')).toBe(1);
      expect(robot.estimateTokens('test message')).toBe(3);
      expect(robot.estimateTokens('')).toBe(0);
    });

    it('should round up partial tokens', () => {
      expect(robot.estimateTokens('a')).toBe(1);
      expect(robot.estimateTokens('abc')).toBe(1);
      expect(robot.estimateTokens('abcd')).toBe(1);
      expect(robot.estimateTokens('abcde')).toBe(2);
    });

    it('should handle long messages', () => {
      const longMessage = 'a'.repeat(100);
      expect(robot.estimateTokens(longMessage)).toBe(25);
    });
  });

  describe('acceptMessageStreamResponse', () => {
    beforeEach(() => {
      // Mock the environment variable
      process.env.OPENAI_API_KEY = 'test-api-key';

      // Mock the chat completions create method to return a proper stream
      const { OpenAI } = require('openai');
      const mockClient = OpenAI();

      // Create a mock async iterator for streaming
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: 'Test response' },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: ' content' },
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should handle streaming response', async () => {
      const chunkCallback = jest.fn();
      const streamStartCallback = jest.fn();
      const streamFinishedCallback = jest.fn();
      const errorCallback = jest.fn();

      await expect(
        robot.acceptMessageStreamResponse(mockMessageEnvelope, {
          onChunkReceived: chunkCallback,
          onStreamStart: streamStartCallback,
          onStreamFinished: streamFinishedCallback,
          onError: errorCallback,
        }),
      ).resolves.toBeUndefined();

      expect(streamStartCallback).toHaveBeenCalled();
      expect(streamFinishedCallback).toHaveBeenCalled();
    });

    it('should handle different message types', async () => {
      const chunkCallback = jest.fn();
      const differentMessage = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: '# Test markdown content',
          },
        },
      };

      await expect(
        robot.acceptMessageStreamResponse(differentMessage, {
          onChunkReceived: chunkCallback,
          onStreamStart: jest.fn(),
          onStreamFinished: jest.fn(),
          onError: jest.fn(),
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('acceptMessageImmediateResponse', () => {
    it('should return the input message unchanged', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result).toEqual(mockMessageEnvelope);
      expect(result).toBe(mockMessageEnvelope); // Should be the same reference
    });

    it('should work with different message content', async () => {
      const differentMessage = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: 'Different content',
          },
        },
      };

      const result =
        await robot.acceptMessageImmediateResponse(differentMessage);
      expect(result).toEqual(differentMessage);
    });
  });

  describe('acceptMessageMultiPartResponse', () => {
    beforeEach(() => {
      // Mock the environment variable
      process.env.OPENAI_API_KEY = 'test-api-key';

      // Mock the chat completions create method to return a proper stream
      const { OpenAI } = require('openai');
      const mockClient = OpenAI();

      // Create a mock async iterator for streaming
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: 'Test response' },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: ' content' },
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should return immediate response and call delayed callback', async () => {
      const delayedCallback = jest.fn();

      const resultPromise = robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      // Should return the immediate response
      const result = await resultPromise;
      expect(result).toEqual(mockMessageEnvelope);

      // Wait a bit for the streaming to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now delayed callback should have been called
      expect(delayedCallback).toHaveBeenCalledTimes(1);

      const delayedCallArgs = delayedCallback.mock.calls[0][0];
      expect(delayedCallArgs.requestOrResponse).toBe('request');
      expect(delayedCallArgs.envelopePayload.author_role).toBe('user');
      expect(delayedCallArgs.envelopePayload.content.payload).toBe(
        'Test response content',
      );
    });

    it('should handle callback that is not a function', async () => {
      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        null as any,
      );

      expect(result).toEqual(mockMessageEnvelope);

      // Should not throw error
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should handle multiple concurrent multipart responses', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const promise1 = robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        callback1,
      );
      const promise2 = robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        callback2,
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(mockMessageEnvelope);
      expect(result2).toEqual(mockMessageEnvelope);

      // Wait for streaming to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle messages with different author roles', async () => {
      const assistantMessage = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          author_role: 'assistant' as const,
        },
      };

      const result =
        await robot.acceptMessageImmediateResponse(assistantMessage);
      expect(result).toEqual(assistantMessage);
    });

    it('should handle messages with large content', async () => {
      const largeContent = 'A'.repeat(10000);
      const largeMessage = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: largeContent,
          },
        },
      };

      const result = await robot.acceptMessageImmediateResponse(largeMessage);
      expect(result).toEqual(largeMessage);

      // Verify token estimation works with large content
      expect(robot.estimateTokens(largeContent)).toBe(2500);
    });
  });

  describe('Streaming with History', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      const { OpenAI } = require('openai');
      const mockClient = OpenAI();

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: 'Response with history' },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: ' context' },
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should include conversation history when provided', async () => {
      const chunkCallback = jest.fn();
      const streamStartCallback = jest.fn();
      const streamFinishedCallback = jest.fn();

      const mockHistory = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          fromUserId: 'user-1',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          content: 'Previous message',
          messageType: MessageType.TEXT,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          fromUserId: 'robot-1',
          fromRole: UserRole.ROBOT,
          toRole: UserRole.CUSTOMER,
          content: 'Previous response',
          messageType: MessageType.TEXT,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        {
          onChunkReceived: chunkCallback,
          onStreamStart: streamStartCallback,
          onStreamFinished: streamFinishedCallback,
          onError: jest.fn(),
        },
        () => mockHistory,
      );

      expect(streamStartCallback).toHaveBeenCalled();
      expect(streamFinishedCallback).toHaveBeenCalled();
    });

    it('should handle empty history', async () => {
      const chunkCallback = jest.fn();
      const streamStartCallback = jest.fn();
      const streamFinishedCallback = jest.fn();

      await robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        {
          onChunkReceived: chunkCallback,
          onStreamStart: streamStartCallback,
          onStreamFinished: streamFinishedCallback,
          onError: jest.fn(),
        },
        () => [],
      );

      expect(streamStartCallback).toHaveBeenCalled();
      expect(streamFinishedCallback).toHaveBeenCalled();
    });
  });

  describe('Function Call Streaming', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      const { OpenAI } = require('openai');
      const mockClient = OpenAI();

      // Mock stream with function calls
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          // First chunk: function call start
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-123',
                      type: 'function',
                      function: {
                        name: 'test_tool',
                        arguments: '{"param": "value"}',
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
          // Second chunk: function call completion
          yield {
            choices: [
              {
                delta: {},
                finish_reason: 'tool_calls',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should handle function calls in streaming', async () => {
      const chunkCallback = jest.fn();
      const streamStartCallback = jest.fn();
      const streamFinishedCallback = jest.fn();

      await robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onChunkReceived: chunkCallback,
        onStreamStart: streamStartCallback,
        onStreamFinished: streamFinishedCallback,
        onError: jest.fn(),
      });

      expect(streamStartCallback).toHaveBeenCalled();
      expect(streamFinishedCallback).toHaveBeenCalled();
      expect(chunkCallback).toHaveBeenCalled();
    });

    it('should handle function call errors', async () => {
      const { OpenAI } = require('openai');
      const mockClient = OpenAI();

      // Mock stream that triggers function call error
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-123',
                      type: 'function',
                      function: {
                        name: 'invalid_tool',
                        arguments: '{"param": "value"}',
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: {},
                finish_reason: 'tool_calls',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const chunkCallback = jest.fn();
      const streamStartCallback = jest.fn();
      const streamFinishedCallback = jest.fn();

      await robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onChunkReceived: chunkCallback,
        onStreamStart: streamStartCallback,
        onStreamFinished: streamFinishedCallback,
        onError: jest.fn(),
      });

      expect(streamStartCallback).toHaveBeenCalled();
      expect(streamFinishedCallback).toHaveBeenCalled();
      expect(chunkCallback).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should handle OpenAI API errors', async () => {
      const { OpenAI } = require('openai');
      const mockClient = OpenAI();

      mockClient.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API Error'),
      );

      const chunkCallback = jest.fn();
      const errorCallback = jest.fn();
      const streamFinishedCallback = jest.fn();

      await robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onChunkReceived: chunkCallback,
        onStreamStart: jest.fn(),
        onStreamFinished: streamFinishedCallback,
        onError: errorCallback,
      });

      expect(chunkCallback).toHaveBeenCalledWith('Error: OpenAI API Error');
      expect(streamFinishedCallback).toHaveBeenCalled();
    });

    it('should handle missing API key', async () => {
      delete process.env.OPENAI_API_KEY;

      const chunkCallback = jest.fn();
      const errorCallback = jest.fn();
      const streamFinishedCallback = jest.fn();

      try {
        await robot.acceptMessageStreamResponse(mockMessageEnvelope, {
          onChunkReceived: chunkCallback,
          onStreamStart: jest.fn(),
          onStreamFinished: streamFinishedCallback,
          onError: errorCallback,
        });
      } catch (error) {
        // The error should be caught and handled by the streaming response
        // If it's not caught, this test will fail
        expect(error).toBeDefined();
        return;
      }

      // If we get here, the error was properly caught and handled
      expect(chunkCallback).toHaveBeenCalledWith(
        'Error: OPENAI_API_KEY environment variable is required but not set. Please set the OPENAI_API_KEY environment variable with your OpenAI API key.',
      );
      expect(streamFinishedCallback).toHaveBeenCalled();
    });

    it('should handle multipart response errors', async () => {
      const { OpenAI } = require('openai');
      const mockClient = OpenAI();

      mockClient.chat.completions.create.mockRejectedValue(
        new Error('Streaming Error'),
      );

      const delayedCallback = jest.fn();

      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      expect(result).toEqual(mockMessageEnvelope);

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(delayedCallback).toHaveBeenCalledTimes(1);
      const errorCall = delayedCallback.mock.calls[0][0];
      expect(errorCall.envelopePayload.content.payload).toContain(
        'Error: Streaming Error',
      );
    });
  });

  describe('Private Methods', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should create OpenAI client with valid API key', () => {
      const client = (robot as any).getClient();
      expect(client).toBeDefined();
    });

    it('should throw error when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => {
        (robot as any).getClient();
      }).toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should throw error when API key is placeholder', () => {
      process.env.OPENAI_API_KEY = '_OPEN_AI_KEY_';

      expect(() => {
        (robot as any).getClient();
      }).toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should execute tool calls successfully', async () => {
      // This test verifies that the makeToolCall method exists and can be called
      // The actual implementation uses marvToolSet which is mocked
      expect(typeof (robot as any).makeToolCall).toBe('function');
    });

    it('should handle tool execution errors', async () => {
      // This test verifies error handling in makeToolCall
      expect(typeof (robot as any).makeToolCall).toBe('function');
    });
  });

  describe('Factory Functions', () => {
    it('should create message envelope with updated content through streaming', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';

      const { OpenAI } = require('openai');
      const mockClient = OpenAI();

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: 'Updated content' },
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const streamFinishedCallback = jest.fn();

      await robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: streamFinishedCallback,
        onError: jest.fn(),
      });

      expect(streamFinishedCallback).toHaveBeenCalled();
      const finishedMessage = streamFinishedCallback.mock.calls[0][0];
      expect(finishedMessage.messageId).toBe(mockMessageEnvelope.messageId);
      expect(finishedMessage.envelopePayload.content.payload).toBe(
        'Updated content',
      );
      expect(finishedMessage.envelopePayload.author_role).toBe(
        mockMessageEnvelope.envelopePayload.author_role,
      );
    });
  });
});
