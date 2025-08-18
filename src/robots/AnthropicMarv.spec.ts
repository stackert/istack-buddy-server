import { AnthropicMarv } from './AnthropicMarv';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';
import {
  mockConversationMessages,
  mockStreamingCallbacks,
  resetMockCallbacks,
} from '../../test-data/mocks/conversation-messages';
import {
  mockAnthropicClient,
  mockStreamingResponses,
  createAsyncIterator,
  resetAIClientMocks,
} from '../../test-data/mocks/ai-clients';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockAnthropicClient),
}));

// Mock the marvToolSet
jest.mock('./tool-definitions/marv', () => ({
  marvToolSet: {
    toolDefinitions: [
      {
        name: 'formAndRelatedEntityOverview',
        description: 'Get form overview',
        input_schema: {
          type: 'object',
          properties: {
            formId: { type: 'string' },
          },
        },
      },
    ],
    executeToolCall: jest.fn().mockResolvedValue({
      status: 'success',
      data: { formId: '123456', fields: [] },
    }),
    transformToolResponse: jest.fn().mockReturnValue({
      robotResponse: { status: 'ok', message: 'Tool executed successfully' },
      chatResponse: { message: 'Tool result: success' },
    }),
  },
}));

describe('AnthropicMarv', () => {
  let robot: AnthropicMarv;
  const originalEnv = process.env;

  beforeEach(() => {
    robot = new AnthropicMarv();
    resetMockCallbacks();
    resetAIClientMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have correct robot properties', () => {
      expect(robot.robotClass).toBe('AnthropicMarv');
      expect(robot.getName()).toBe('AnthropicMarv');
      expect(robot.getVersion()).toBe('1.0.0');
      expect(robot.contextWindowSizeInTokens).toBe(200000);
      expect(robot.LLModelName).toBe('claude-3-5-sonnet-20241022');
      expect(robot.LLModelVersion).toBe('20241022');
    });

    it('should have correct static descriptions', () => {
      expect(AnthropicMarv.descriptionShort).toContain('Formstack API robot');
      expect(AnthropicMarv.descriptionLong).toContain(
        'Marv is a specialized robot',
      );
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      expect(robot.estimateTokens('abcd')).toBe(1);
      expect(robot.estimateTokens('abcdefgh')).toBe(2);
      expect(robot.estimateTokens('')).toBe(0);
      expect(
        robot.estimateTokens('A very long message with many characters'),
      ).toBe(10);
    });
  });

  describe('Client Initialization', () => {
    it('should create client with API key', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const client = (robot as any).getClient();
      expect(client).toBeDefined();
    });

    it('should throw error when API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => (robot as any).getClient()).toThrow(
        'ANTHROPIC_API_KEY environment variable is required',
      );
    });
  });

  describe('Message Request Creation', () => {
    it('should create Anthropic message request without history', () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const request = (robot as any).createAnthropicMessageRequest(message);

      expect(request.model).toBe('claude-3-5-sonnet-20241022');
      expect(request.max_tokens).toBe(1024);
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[0].content).toBe('Test message');
      expect(request.tools).toBeDefined();
    });

    it('should create Anthropic message request with history', () => {
      const message =
        mockConversationMessages.customerMessage('Current message');
      const history = [
        mockConversationMessages.customerMessage('First message'),
        mockConversationMessages.agentMessage('First response'),
      ];

      const request = (robot as any).createAnthropicMessageRequest(
        message,
        () => history,
      );

      expect(request.messages).toHaveLength(3);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[0].content).toBe('First message');
      expect(request.messages[1].role).toBe('user'); // Agent messages become 'user' in Anthropic format
      expect(request.messages[2].role).toBe('user');
      expect(request.messages[2].content).toBe('Current message');
    });

    it('should handle history with new format messages', () => {
      const message =
        mockConversationMessages.customerMessage('Current message');
      const history = [
        {
          ...mockConversationMessages.customerMessage('First message'),
          role: 'user',
          content: 'First message',
        },
        {
          ...mockConversationMessages.agentMessage('First response'),
          role: 'assistant',
          content: 'First response',
        },
      ];

      const request = (robot as any).createAnthropicMessageRequest(
        message,
        () => history,
      );

      expect(request.messages).toHaveLength(3);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[1].role).toBe('assistant');
    });
  });

  describe('Tool Call Execution', () => {
    it('should execute tool call successfully', async () => {
      const result = await (robot as any).executeToolCall(
        'formAndRelatedEntityOverview',
        { formId: '123456' },
        jest.fn(),
      );

      expect(result).toBe('Tool executed successfully');
    });

    it('should handle tool execution errors', async () => {
      const { marvToolSet } = require('./tool-definitions/marv');
      marvToolSet.executeToolCall.mockRejectedValueOnce(
        new Error('Tool execution failed'),
      );

      const result = await (robot as any).executeToolCall(
        'formAndRelatedEntityOverview',
        { formId: '123456' },
        jest.fn(),
      );

      expect(result).toContain(
        'Error executing formAndRelatedEntityOverview: Tool execution failed',
      );
    });

    it('should call onFullMessageReceived when chat response is available', async () => {
      const onFullMessageReceived = jest.fn();
      const { marvToolSet } = require('./tool-definitions/marv');
      marvToolSet.transformToolResponse.mockReturnValueOnce({
        robotResponse: { status: 'ok', message: 'Tool executed successfully' },
        chatResponse: { message: 'Chat response message' },
      });

      await (robot as any).executeToolCall(
        'formAndRelatedEntityOverview',
        { formId: '123456' },
        onFullMessageReceived,
      );

      expect(onFullMessageReceived).toHaveBeenCalledWith(
        'Chat response message',
        'application/json',
      );
    });
  });

  describe('Streaming Response', () => {
    it('should handle successful streaming response', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = { ...mockStreamingCallbacks };

      // Spy on the streaming method and mock its behavior
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onStreamStart?.(message);
          callbacks.onStreamChunkReceived?.('Hello, I can help you with that.');
          callbacks.onStreamFinished?.(message);
        });

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onStreamStart).toHaveBeenCalledWith(message);
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        'Hello, I can help you with that.',
      );
      expect(callbacks.onStreamFinished).toHaveBeenCalledWith(message);

      streamingSpy.mockRestore();
    });

    it('should handle tool calls in streaming response', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = { ...mockStreamingCallbacks };

      // Spy on the streaming method and mock tool call behavior
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onStreamStart?.(message);
          callbacks.onStreamChunkReceived?.('Tool executed successfully');
          callbacks.onStreamFinished?.(message);
        });

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onStreamStart).toHaveBeenCalledWith(message);
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        'Tool executed successfully',
      );

      streamingSpy.mockRestore();
    });

    it('should handle streaming errors', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = { ...mockStreamingCallbacks };

      // Spy on the streaming method and mock error behavior
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onError?.(new Error('Streaming failed'));
        });

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));

      streamingSpy.mockRestore();
    });

    it('should handle missing API key in streaming', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = { ...mockStreamingCallbacks };

      delete process.env.ANTHROPIC_API_KEY;

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Immediate Response', () => {
    it('should compose content from streaming callbacks', async () => {
      const message = mockConversationMessages.customerMessage('Hello');

      // Spy on streaming method to simulate chunks
      const spy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onStreamStart?.(message);
          callbacks.onStreamChunkReceived?.('Part1 ');
          callbacks.onStreamChunkReceived?.('Part2');
          callbacks.onStreamFinished?.(message as any);
        });

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toBe('Part1 Part2');

      spy.mockRestore();
    });

    it('should handle streaming errors in immediate response', async () => {
      const message = mockConversationMessages.customerMessage('Hello');

      // Spy on streaming method to simulate error
      const spy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onError?.(new Error('Streaming error'));
        });

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toBe('Error: Streaming error');

      spy.mockRestore();
    });

    it('should provide fallback when streaming fails', async () => {
      const message = mockConversationMessages.customerMessage('Hello');

      // Spy on streaming method to simulate no callbacks
      const spy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async () => {
          // No callbacks called
        });

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toBe('No response generated');

      spy.mockRestore();
    });

    it('should handle immediate response with streaming fallback', async () => {
      const message = mockConversationMessages.customerMessage('Test message');

      // Mock streaming to not call onStreamFinished
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onStreamChunkReceived('Hello, I can help you with that.');
          // Don't call onStreamFinished to trigger fallback
        });

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toBe('Hello, I can help you with that.');

      streamingSpy.mockRestore();
    });

    it('should handle immediate response with no accumulated content', async () => {
      const message = mockConversationMessages.customerMessage('Test message');

      // Mock streaming to not accumulate any content
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          // Don't call any callbacks to trigger fallback
        });

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toBe('No response generated');

      streamingSpy.mockRestore();
    });

    it('should handle immediate response with streaming error', async () => {
      const message = mockConversationMessages.customerMessage('Test message');

      // Mock streaming to throw error
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onError(new Error('Streaming error'));
        });

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toBe('Error: Streaming error');

      streamingSpy.mockRestore();
    });
  });

  describe('Multi-part Response', () => {
    it('should handle multi-part response with streaming error', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const delayedCallback = jest.fn();

      // Mock immediate response
      const immediateSpy = jest
        .spyOn(robot as any, 'acceptMessageImmediateResponse')
        .mockResolvedValueOnce({
          content: { type: 'text/plain', payload: 'Immediate response' },
        });

      // Mock streaming response with error
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onError(new Error('Streaming error'));
        });

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        delayedCallback,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toBe('Immediate response');
      expect(delayedCallback).toHaveBeenCalledWith({
        content: {
          type: 'text/plain',
          payload: 'Error in streaming response: Streaming error',
        },
      });

      immediateSpy.mockRestore();
      streamingSpy.mockRestore();
    });

    it('should handle multi-part response with null delayed callback', async () => {
      const message = mockConversationMessages.customerMessage('Test message');

      // Mock immediate response
      const immediateSpy = jest
        .spyOn(robot as any, 'acceptMessageImmediateResponse')
        .mockResolvedValueOnce({
          content: { type: 'text/plain', payload: 'Immediate response' },
        });

      // Mock streaming response
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onStreamFinished(message);
        });

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        null as any,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toBe('Immediate response');

      immediateSpy.mockRestore();
      streamingSpy.mockRestore();
    });

    it('should handle multi-part response with streaming promise rejection', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const delayedCallback = jest.fn();

      // Mock immediate response
      const immediateSpy = jest
        .spyOn(robot as any, 'acceptMessageImmediateResponse')
        .mockResolvedValueOnce({
          content: { type: 'text/plain', payload: 'Immediate response' },
        });

      // Mock streaming response to reject
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockRejectedValueOnce(new Error('Streaming promise rejected'));

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        delayedCallback,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toBe('Immediate response');
      expect(delayedCallback).toHaveBeenCalledWith({
        content: {
          type: 'text/plain',
          payload: 'Error in streaming response: Streaming promise rejected',
        },
      });

      immediateSpy.mockRestore();
      streamingSpy.mockRestore();
    });
  });

  describe('Message Transformer', () => {
    it('should transform customer messages to user role', () => {
      const message = mockConversationMessages.customerMessage('Hello');
      const transformer = robot.getGetFromRobotToConversationTransformer();
      const result = transformer(message);

      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello');
    });

    it('should transform robot messages to assistant role', () => {
      const message = mockConversationMessages.robotMessage('I can help');
      const transformer = robot.getGetFromRobotToConversationTransformer();
      const result = transformer(message);

      expect(result.role).toBe('assistant');
      expect(result.content).toBe('I can help');
    });
  });
});
