import { MarvOpenAiAgent } from './MarvOpenAiAgent';
import { marvToolSet } from './tool-definitions/marv';
import type { TConversationTextMessageEnvelope } from './types';

// Mock the marvToolSet module
jest.mock('./tool-definitions/marv', () => ({
  marvToolSet: {
    toolDefinitions: [
      {
        name: 'formLogicValidation',
        description: 'Validate form logic for errors and issues',
        input_schema: {
          type: 'object',
          properties: {
            formId: { type: 'string' },
          },
          required: ['formId'],
        },
      },
      {
        name: 'formCalculationValidation',
        description:
          'Validate form calculations and detect circular references',
        input_schema: {
          type: 'object',
          properties: {
            formId: { type: 'string' },
          },
          required: ['formId'],
        },
      },
    ],
    executeToolCall: jest.fn(),
  },
}));

describe('MarvOpenAiAgent', () => {
  let robot: MarvOpenAiAgent;
  let mockMarvToolSet: jest.Mocked<typeof marvToolSet>;

  beforeEach(() => {
    robot = new MarvOpenAiAgent();
    mockMarvToolSet = marvToolSet as jest.Mocked<typeof marvToolSet>;
    jest.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have correct basic properties', () => {
      expect(robot.name).toBe('MarvOpenAiAgent');
      expect(robot.version).toBe('1.0.0');
      expect(robot.LLModelName).toBe('gpt-4o');
      expect(robot.LLModelVersion).toBe('gpt-4o-2024-05-13');
      expect(robot.contextWindowSizeInTokens).toBe(128000);
    });

    it('should have correct static descriptions', () => {
      expect(MarvOpenAiAgent.descriptionShort).toContain('Formstack API robot');
      expect(MarvOpenAiAgent.descriptionLong).toContain('Marv OpenAI');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      const message = 'Hello world';
      const estimatedTokens = robot.estimateTokens(message);
      expect(estimatedTokens).toBe(Math.ceil(message.length / 4));
    });
  });

  describe('Tool Definitions', () => {
    it('should have tool definitions from marvToolSet', () => {
      expect(mockMarvToolSet.toolDefinitions).toBeDefined();
      expect(Array.isArray(mockMarvToolSet.toolDefinitions)).toBe(true);
    });

    it('should convert marv tools to OpenAI format', () => {
      // Access the private tools property for testing
      const tools = (robot as any).tools;
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);

      // Check that tools are in OpenAI format
      tools.forEach((tool: any) => {
        expect(tool.type).toBe('function');
        expect(tool.function).toBeDefined();
        expect(tool.function.name).toBeDefined();
        expect(tool.function.description).toBeDefined();
        expect(tool.function.parameters).toBeDefined();
      });
    });
  });

  describe('Client Creation', () => {
    it('should throw error when OPENAI_API_KEY is not set', () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      expect(() => {
        (robot as any).getClient();
      }).toThrow('OPENAI_API_KEY environment variable is required');

      if (originalEnv) {
        process.env.OPENAI_API_KEY = originalEnv;
      }
    });

    it('should create client when OPENAI_API_KEY is set', () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      expect(() => {
        (robot as any).getClient();
      }).not.toThrow();

      if (originalEnv) {
        process.env.OPENAI_API_KEY = originalEnv;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool calls successfully', async () => {
      const mockResult = {
        isSuccess: true,
        response: { status: 'success' },
      };
      mockMarvToolSet.executeToolCall.mockResolvedValue(mockResult);

      const result = await (robot as any).executeToolCall('testTool', {
        formId: '123',
      });

      expect(mockMarvToolSet.executeToolCall).toHaveBeenCalledWith('testTool', {
        formId: '123',
      });
      expect(result).toContain('testTool completed successfully');
      expect(result).toContain('"status": "success"');
    });

    it('should handle tool execution errors', async () => {
      const mockResult = {
        isSuccess: false,
        errorItems: ['Error 1', 'Error 2'],
      };
      mockMarvToolSet.executeToolCall.mockResolvedValue(mockResult);

      const result = await (robot as any).executeToolCall('testTool', {
        formId: '123',
      });

      expect(result).toContain('testTool failed');
      expect(result).toContain('Error 1, Error 2');
    });

    it('should handle tool execution exceptions', async () => {
      mockMarvToolSet.executeToolCall.mockRejectedValue(new Error('API Error'));

      const result = await (robot as any).executeToolCall('testTool', {
        formId: '123',
      });

      expect(result).toContain('Error executing testTool: API Error');
    });
  });

  describe('Message Request Creation', () => {
    it('should create OpenAI message request correctly', () => {
      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Hello, can you help me with form validation?',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 10,
        },
      };

      const request = (robot as any).createOpenAIMessageRequest(
        messageEnvelope,
      );

      expect(request.model).toBe('gpt-4o');
      expect(request.max_tokens).toBe(1024);
      expect(request.messages).toHaveLength(2);
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[1].role).toBe('user');
      expect(request.messages[1].content).toBe(
        'Hello, can you help me with form validation?',
      );
      expect(request.tools).toBeDefined();
    });
  });

  describe('Message Response Handling', () => {
    it('should handle immediate response correctly', async () => {
      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Validate form 123',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 5,
        },
      };

      // Mock successful tool execution
      mockMarvToolSet.executeToolCall.mockResolvedValue({
        isSuccess: true,
        response: { validation: 'passed' },
      });

      const response =
        await robot.acceptMessageImmediateResponse(messageEnvelope);

      expect(response.messageId).toContain('response-');
      expect(response.requestOrResponse).toBe('response');
      expect(response.envelopePayload.author_role).toBe('assistant');
      expect(response.envelopePayload.content.type).toBe('text/plain');
      expect(response.envelopePayload.content.payload).toBeDefined();
    });

    it('should handle streaming response correctly', async () => {
      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Validate form 123',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 5,
        },
      };

      const chunks: string[] = [];
      const chunkCallback = (chunk: string) => chunks.push(chunk);

      // Mock successful tool execution
      mockMarvToolSet.executeToolCall.mockResolvedValue({
        isSuccess: true,
        response: { validation: 'passed' },
      });

      await robot.acceptMessageStreamResponse(messageEnvelope, chunkCallback);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle multi-part response correctly', async () => {
      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Validate form 123',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 5,
        },
      };

      const delayedMessages: TConversationTextMessageEnvelope[] = [];
      const delayedCallback = (message: TConversationTextMessageEnvelope) => {
        delayedMessages.push(message);
      };

      // Mock successful tool execution
      mockMarvToolSet.executeToolCall.mockResolvedValue({
        isSuccess: true,
        response: { validation: 'passed' },
      });

      const response = await robot.acceptMessageMultiPartResponse(
        messageEnvelope,
        delayedCallback,
      );

      expect(response.messageId).toContain('response-');
      expect(response.requestOrResponse).toBe('response');

      // Wait for delayed callback
      await new Promise((resolve) => setTimeout(resolve, 2500));
      expect(delayedMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle client creation errors gracefully', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Test message',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 2,
        },
      };

      const response =
        await robot.acceptMessageImmediateResponse(messageEnvelope);

      expect(response.envelopePayload.content.payload).toContain(
        'encountered an error',
      );
      expect(response.envelopePayload.content.payload).toContain(
        'OPENAI_API_KEY',
      );

      if (originalEnv) {
        process.env.OPENAI_API_KEY = originalEnv;
      }
    });
  });
});
