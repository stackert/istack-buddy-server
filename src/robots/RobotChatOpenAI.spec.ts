import { RobotChatOpenAI } from './RobotChatOpenAI';
import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';

// Mock the OpenAI library
jest.mock('openai', () => {
  const mockCreate = jest.fn();

  const mockOpenAIConstructor = jest.fn(() => ({
    responses: {
      create: mockCreate,
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
    it('should resolve without any action', async () => {
      const chunkCallback = jest.fn();

      await expect(
        robot.acceptMessageStreamResponse(mockMessageEnvelope, {
          onChunkReceived: chunkCallback,
          onStreamStart: jest.fn(),
          onStreamFinished: jest.fn(),
          onError: jest.fn(),
        }),
      ).resolves.toBeUndefined();

      expect(chunkCallback).not.toHaveBeenCalled();
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
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
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

      // Delayed callback should not have been called yet
      expect(delayedCallback).not.toHaveBeenCalled();

      // Fast forward time to trigger delayed response
      jest.advanceTimersByTime(1000);

      // Now delayed callback should have been called
      expect(delayedCallback).toHaveBeenCalledTimes(1);

      const delayedCallArgs = delayedCallback.mock.calls[0][0];
      expect(delayedCallArgs.requestOrResponse).toBe('response');
      expect(delayedCallArgs.envelopePayload.author_role).toBe('assistant');
      expect(delayedCallArgs.envelopePayload.content.payload).toContain(
        'OpenAI processing complete for: Test message content',
      );
    });

    it('should handle callback that is not a function', async () => {
      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        null as any,
      );

      expect(result).toEqual(mockMessageEnvelope);

      // Should not throw error when advancing time
      expect(() => {
        jest.advanceTimersByTime(1000);
      }).not.toThrow();
    });

    it('should generate unique delayed message IDs', async () => {
      const delayedCallback1 = jest.fn();
      const delayedCallback2 = jest.fn();

      // Start first call
      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback1,
      );

      // Advance time by 1ms to ensure different timestamps
      jest.advanceTimersByTime(1);

      // Start second call
      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback2,
      );

      // Advance to trigger both callbacks
      jest.advanceTimersByTime(1000);

      const call1Args = delayedCallback1.mock.calls[0][0];
      const call2Args = delayedCallback2.mock.calls[0][0];

      // Both should have messageId starting with 'response-' and ending with '-delayed'
      expect(call1Args.messageId).toMatch(/^response-\d+-delayed$/);
      expect(call2Args.messageId).toMatch(/^response-\d+-delayed$/);

      // The message IDs should be different (different timestamps)
      expect(call1Args.messageId).not.toEqual(call2Args.messageId);
    });
  });


      // Mock the second API call (tool response)
      mockCreate.mockResolvedValueOnce({
        response: 'The weather in Paris is warm with light breeze.',
      });

      const result = await robot.sendTestMessageToRobot(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(result).toEqual(mockMessageEnvelope);
      expect(mockCreate).toHaveBeenCalledTimes(2);

      // Verify first call with tools
      expect(mockCreate).toHaveBeenNthCalledWith(1, {
        model: 'gpt-4.1',
        input: [
          { role: 'user', content: 'What is the weather like in Paris today?' },
        ],
        tools: expect.any(Array),
      });

      // Verify second call with function responses
      expect(mockCreate).toHaveBeenNthCalledWith(2, {
        model: 'gpt-4.1',
        input: expect.arrayContaining([
          expect.objectContaining({
            type: 'function_call',
            name: 'get_weather',
          }),
          expect.objectContaining({
            type: 'function_call_output',
            call_id: 'call_test_id',
          }),
        ]),
        tools: expect.any(Array),
        store: true,
      });
    });

    it('should handle empty tool responses', async () => {
      const { OpenAI } = require('openai');
      const mockClient = OpenAI();
      const mockCreate = mockClient.responses.create;
      const chunkCallback = jest.fn();

      // Mock API call with no tools
      mockCreate.mockResolvedValueOnce({
        output: [],
      });

      mockCreate.mockResolvedValueOnce({
        response: 'No tools needed.',
      });

      const result = await robot.sendTestMessageToRobot(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(result).toEqual(mockMessageEnvelope);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle API errors gracefully', async () => {
      const { OpenAI } = require('openai');
      const mockClient = OpenAI();
      const mockCreate = mockClient.responses.create;
      const chunkCallback = jest.fn();

      mockCreate.mockRejectedValue(new Error('OpenAI API error'));

      await expect(
        robot.sendTestMessageToRobot(mockMessageEnvelope, chunkCallback),
      ).rejects.toThrow('OpenAI API error');
    });
  });

  describe('Private Methods', () => {
    describe('robot_getWeather', () => {
      it('should return weather information for given location', () => {
        // Access private method for testing
        const result = (robot as any).robot_getWeather({
          location: 'New York, USA',
        });

        expect(result).toContain('Warm with light breeze');
        expect(result).toContain('New York, USA');
        expect(result).toContain('toolArgs');
      });

      it('should handle undefined toolArgs', () => {
        const result = (robot as any).robot_getWeather(undefined);

        expect(result).toContain('Warm with light breeze');
        expect(result).toContain('undefined');
      });

      it('should handle toolArgs without location', () => {
        const result = (robot as any).robot_getWeather({ other: 'data' });

        expect(result).toContain('undefined');
        expect(result).toContain('{"other":"data"}');
      });
    });

    describe('makeToolCall', () => {
      it('should handle get_weather tool call', () => {
        const result = (robot as any).makeToolCall('get_weather', {
          location: 'London, UK',
        });

        expect(result).toContain('London, UK');
        expect(result).toContain('Warm with light breeze');
      });

      it('should handle getWeather tool call (alternative name)', () => {
        const result = (robot as any).makeToolCall('getWeather', {
          location: 'Tokyo, Japan',
        });

        expect(result).toContain('Tokyo, Japan');
        expect(result).toContain('Warm with light breeze');
      });

      it('should handle unknown tool names', () => {
        const result = (robot as any).makeToolCall('unknown_tool', {
          data: 'test',
        });

        expect(result).toContain(
          "Failed to recognize the tool call: 'unknown_tool'",
        );
      });

      it('should handle empty tool name', () => {
        const result = (robot as any).makeToolCall('', { data: 'test' });

        expect(result).toContain("Failed to recognize the tool call: ''");
      });
    });

    describe('getClient', () => {
      it('should create OpenAI client', () => {
        const { OpenAI } = require('openai');

        const client = (robot as any).getClient();

        expect(OpenAI).toHaveBeenCalledWith({
          apiKey: '_OPEN_AI_KEY_',
        });
        expect(client).toBeDefined();
      });
    });
  });

  describe('Tool Configuration', () => {
    it('should have properly configured tools', () => {
      // Access the tools constant (we can't import it directly, but we can test its usage)
      const { OpenAI } = require('openai');
      const mockClient = OpenAI();
      const mockCreate = mockClient.responses.create;
      const chunkCallback = jest.fn();

      mockCreate.mockResolvedValueOnce({ output: [] });
      mockCreate.mockResolvedValueOnce({ response: 'test' });

      robot.sendTestMessageToRobot(mockMessageEnvelope, chunkCallback);

      const toolsUsed = mockCreate.mock.calls[0][0].tools;
      expect(toolsUsed).toEqual([
        {
          type: 'function',
          name: 'get_weather',
          strict: true,
          description: 'Get current temperature for a given location.',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City and country e.g. Bogotá, Colombia',
              },
            },
            required: ['location'],
            additionalProperties: false,
          },
        },
      ]);
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

    it('should handle multiple concurrent multipart responses', async () => {
      jest.useFakeTimers();

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

      jest.advanceTimersByTime(1000);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });
});
