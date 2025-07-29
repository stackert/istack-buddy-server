import { SlackyOpenAiAgent } from './SlackyOpenAiAgent';
import { slackyToolSet } from './tool-definitions/slacky';
import {
  marvToolDefinitions,
  performMarvToolCall,
} from './tool-definitions/marv';
import { createCompositeToolSet } from './tool-definitions/toolCatalog';
import type { TConversationTextMessageEnvelope } from './types';

// Mock the tool modules
jest.mock('./tool-definitions/slacky', () => ({
  slackyToolSet: {
    toolDefinitions: [
      {
        name: 'sumoLogicQuery',
        description: 'Assist users with Sumo Logic queries',
        input_schema: {
          type: 'object',
          properties: {
            fromDate: { type: 'string' },
            toDate: { type: 'string' },
          },
          required: ['fromDate', 'toDate'],
        },
      },
      {
        name: 'ssoAutofillAssistance',
        description: 'Assist users with form SSO auto-fill questions',
        input_schema: {
          type: 'object',
          properties: {
            formId: { type: 'string' },
            accountId: { type: 'string' },
          },
          required: ['formId', 'accountId'],
        },
      },
    ],
    executeToolCall: jest.fn(),
  },
}));

jest.mock('./tool-definitions/marv', () => ({
  marvToolDefinitions: [
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
      description: 'Validate form calculations and detect circular references',
      input_schema: {
        type: 'object',
        properties: {
          formId: { type: 'string' },
        },
        required: ['formId'],
      },
    },
    {
      name: 'formAndRelatedEntityOverview',
      description: 'Get comprehensive form overview with statistics',
      input_schema: {
        type: 'object',
        properties: {
          formId: { type: 'string' },
        },
        required: ['formId'],
      },
    },
  ],
  performMarvToolCall: jest.fn(),
  FsRestrictedApiRoutesEnum: {
    FormLogicValidation: 'formLogicValidation',
    FormCalculationValidation: 'formCalculationValidation',
    FormAndRelatedEntityOverview: 'formAndRelatedEntityOverview',
  },
}));

jest.mock('./tool-definitions/toolCatalog', () => ({
  createCompositeToolSet: jest.fn(() => ({
    toolDefinitions: [
      {
        name: 'sumoLogicQuery',
        description: 'Assist users with Sumo Logic queries',
        input_schema: {
          type: 'object',
          properties: {
            fromDate: { type: 'string' },
            toDate: { type: 'string' },
          },
          required: ['fromDate', 'toDate'],
        },
      },
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
    ],
    executeToolCall: jest.fn(),
  })),
}));

describe('SlackyOpenAiAgent', () => {
  let robot: SlackyOpenAiAgent;
  let mockSlackyToolSet: jest.Mocked<typeof slackyToolSet>;
  let mockPerformMarvToolCall: jest.MockedFunction<typeof performMarvToolCall>;
  let mockCreateCompositeToolSet: jest.MockedFunction<
    typeof createCompositeToolSet
  >;

  beforeEach(() => {
    robot = new SlackyOpenAiAgent();
    mockSlackyToolSet = slackyToolSet as jest.Mocked<typeof slackyToolSet>;
    mockPerformMarvToolCall = performMarvToolCall as jest.MockedFunction<
      typeof performMarvToolCall
    >;
    mockCreateCompositeToolSet = createCompositeToolSet as jest.MockedFunction<
      typeof createCompositeToolSet
    >;
    jest.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have correct basic properties', () => {
      expect(robot.name).toBe('SlackyOpenAiAgent');
      expect(robot.version).toBe('1.0.0');
      expect(robot.LLModelName).toBe('gpt-4o');
      expect(robot.LLModelVersion).toBe('gpt-4o-2024-05-13');
      expect(robot.contextWindowSizeInTokens).toBe(128000);
    });

    it('should have correct static descriptions', () => {
      expect(SlackyOpenAiAgent.descriptionShort).toContain(
        'Slack-specialized OpenAI agent',
      );
      expect(SlackyOpenAiAgent.descriptionLong).toContain(
        'Slack integration with OpenAI',
      );
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
    it('should have tool definitions from composite tool set', () => {
      expect(mockCreateCompositeToolSet).toHaveBeenCalled();
    });

    it('should convert tools to OpenAI format', () => {
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
      const mockResult = 'Tool execution result';
      const mockCompositeToolSet = (robot as any).compositeToolSet;
      mockCompositeToolSet.executeToolCall.mockResolvedValue(mockResult);

      const result = await (robot as any).executeToolCall('testTool', {
        formId: '123',
      });

      expect(mockCompositeToolSet.executeToolCall).toHaveBeenCalledWith(
        'testTool',
        { formId: '123' },
      );
      expect(result).toBe(mockResult);
    });

    it('should handle tool execution errors', async () => {
      const mockError = new Error('Tool execution failed');
      const mockCompositeToolSet = (robot as any).compositeToolSet;
      mockCompositeToolSet.executeToolCall.mockRejectedValue(mockError);

      const result = await (robot as any).executeToolCall('testTool', {
        formId: '123',
      });

      expect(result).toContain(
        'Error executing testTool: Tool execution failed',
      );
    });
  });

  describe('Message History', () => {
    it('should build OpenAI message history correctly', () => {
      const mockHistory = [
        { fromRole: 'CUSTOMER', content: 'User message 1' },
        { fromRole: 'ROBOT', content: 'Assistant response 1' },
        { fromRole: 'CUSTOMER', content: 'User message 2' },
      ];

      robot.setConversationHistory(mockHistory as any);
      const messages = (robot as any).buildOpenAIMessageHistory(
        'Current message',
      );

      expect(messages).toHaveLength(4); // 3 history + 1 current
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('User message 1');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('Assistant response 1');
      expect(messages[2].role).toBe('user');
      expect(messages[2].content).toBe('User message 2');
      expect(messages[3].role).toBe('user');
      expect(messages[3].content).toBe('Current message');
    });
  });

  describe('Direct Feedback Commands', () => {
    it('should handle /help command', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands('/help');
      expect(result).toContain('iStackBuddy (Slacky OpenAI) - Help');
    });

    it('should handle /feedback command', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/feedback This is great!',
      );
      expect(result).toContain('Thank you for your feedback');
      expect(result).toContain('This is great!');
    });

    it('should handle /rate command with positive rating', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/rate 5 Excellent service',
      );
      expect(result).toContain('Thank you for your rating');
      expect(result).toContain("😊 I'm glad I could help");
    });

    it('should handle /rate command with negative rating', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/rate -2 Could be better',
      );
      expect(result).toContain('Thank you for your rating');
      expect(result).toContain("😔 I'm sorry I couldn't help better");
    });

    it('should reject invalid rating', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/rate 10',
      );
      expect(result).toContain('Please provide a rating between -5 and +5');
    });

    it('should return null for unrecognized commands', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        'Hello world',
      );
      expect(result).toBeNull();
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
            payload: 'Help me with form validation',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 5,
        },
      };

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
            payload: 'Help me with form validation',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 5,
        },
      };

      const chunks: string[] = [];
      const chunkCallback = (chunk: string) => chunks.push(chunk);

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
            payload: 'Help me with form validation',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 5,
        },
      };

      const delayedMessages: TConversationTextMessageEnvelope[] = [];
      const delayedCallback = (message: TConversationTextMessageEnvelope) => {
        delayedMessages.push(message);
      };

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
