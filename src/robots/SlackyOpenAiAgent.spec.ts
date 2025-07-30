import { SlackyOpenAiAgent } from './SlackyOpenAiAgent';
import type { TConversationTextMessageEnvelope } from './types';

// Mock OpenAI
const mockOpenAI = {
  Chat: {
    Completions: {
      create: jest.fn(),
    },
  },
};

jest.mock('openai', () => ({
  default: jest.fn(() => mockOpenAI),
  OpenAI: jest.fn(() => mockOpenAI),
}));

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
    ],
    executeToolCall: jest.fn(),
  },
}));

jest.mock('./tool-definitions/marv', () => ({
  marvToolDefinitions: [
    {
      name: 'fsRestrictedApiFormAndRelatedEntityOverview',
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
    FormLogicValidation: 'fsRestrictedApiFormLogicValidation',
    FormCalculationValidation: 'fsRestrictedApiFormCalculationValidation',
    FormAndRelatedEntityOverview: 'fsRestrictedApiFormAndRelatedEntityOverview',
  },
}));

jest.mock('./tool-definitions/toolCatalog', () => ({
  createCompositeToolSet: jest.fn(() => ({
    toolDefinitions: [
      {
        name: 'fsRestrictedApiFormAndRelatedEntityOverview',
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
    executeToolCall: jest.fn(),
  })),
}));

describe('SlackyOpenAiAgent', () => {
  let robot: SlackyOpenAiAgent;

  beforeEach(() => {
    robot = new SlackyOpenAiAgent();
    jest.clearAllMocks();

    // Set up environment
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    // Clean up any monitoring intervals
    robot.stopMonitoring();
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

  describe('Client Creation', () => {
    it('should throw error when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => {
        (robot as any).getClient();
      }).toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should create client when OPENAI_API_KEY is set', () => {
      expect(() => {
        (robot as any).getClient();
      }).not.toThrow();
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool calls successfully', async () => {
      const mockResult = {
        isSuccess: true,
        response: { formId: '123', submissions: '5' },
      };
      const mockCompositeToolSet = (robot as any).compositeToolSet;
      mockCompositeToolSet.executeToolCall.mockResolvedValue(mockResult);

      const result = await (robot as any).executeToolCall(
        'fsRestrictedApiFormAndRelatedEntityOverview',
        {
          formId: '123',
        },
      );

      expect(mockCompositeToolSet.executeToolCall).toHaveBeenCalledWith(
        'fsRestrictedApiFormAndRelatedEntityOverview',
        { formId: '123' },
      );
      expect(result).toBe(mockResult);
    });

    it('should handle tool execution errors', async () => {
      const mockError = new Error('Tool execution failed');
      const mockCompositeToolSet = (robot as any).compositeToolSet;
      mockCompositeToolSet.executeToolCall.mockRejectedValue(mockError);

      const result = await (robot as any).executeToolCall(
        'fsRestrictedApiFormAndRelatedEntityOverview',
        {
          formId: '123',
        },
      );

      expect(result).toContain(
        'Error executing fsRestrictedApiFormAndRelatedEntityOverview: Tool execution failed',
      );
    });
  });

  describe('Message History Building', () => {
    it('should build OpenAI message history correctly', () => {
      const mockHistory = [
        { fromRole: 'cx-customer' as any, content: 'User message 1' },
        { fromRole: 'robot' as any, content: 'Assistant response 1' },
        { fromRole: 'cx-customer' as any, content: 'User message 2' },
      ];

      const messages = (robot as any).buildOpenAIMessageHistory(
        'Current message',
        mockHistory as any,
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

    it('should not duplicate current message if already in history', () => {
      const mockHistory = [
        { fromRole: 'cx-customer' as any, content: 'User message 1' },
        { fromRole: 'cx-customer' as any, content: 'Current message' },
      ];

      const messages = (robot as any).buildOpenAIMessageHistory(
        'Current message',
        mockHistory as any,
      );

      expect(messages).toHaveLength(2); // Should not add duplicate
      expect(messages[1].content).toBe('Current message');
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
      expect(result).toContain("I'm glad I could help");
    });

    it('should return null for unrecognized commands', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        'Hello world',
      );
      expect(result).toBeNull();
    });
  });

  describe('acceptMessageMultiPartResponse', () => {
    it('should return immediate acknowledgment and start monitoring', async () => {
      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Tell me about form 123',
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

      // Should return immediate acknowledgment
      expect(response.messageId).toContain('ack-');
      expect(response.envelopePayload.content.payload).toBe('Working on it...');
      expect(response.requestOrResponse).toBe('response');
    });
  });

  describe('Tool Response Generation', () => {
    it('should create meaningful response from successful tool results', () => {
      const toolResults = [
        {
          tool_call_id: 'call_123',
          role: 'tool',
          content: {
            isSuccess: true,
            response: {
              formId: '5375703',
              submissions: '2',
              version: '4',
              fieldCount: 56,
              isActive: true,
              url: 'https://example.com/form',
              submitActions: [
                { id: '123', name: 'Action 1' },
                { id: '456', name: 'Action 2' },
              ],
            },
          },
        },
      ];

      const response = (robot as any).createFallbackResponse(toolResults);

      expect(response).toContain('## Form Overview: 5375703');
      expect(response).toContain('**Total Submissions:** 2');
      expect(response).toContain('**Version:** 4');
      expect(response).toContain('**Field Count:** 56');
      expect(response).toContain('**Status:** Active');
      expect(response).toContain('**Submit Actions (2):**');
      expect(response).toContain('• Action 1 (ID: 123)');
      expect(response).toContain('• Action 2 (ID: 456)');
    });

    it('should handle tool errors gracefully', () => {
      const toolResults = [
        {
          tool_call_id: 'call_123',
          role: 'tool',
          content: {
            isSuccess: false,
            response: null,
            errorItems: ['The form was not found'],
          },
        },
      ];

      const response = (robot as any).createFallbackResponse(toolResults);

      expect(response).toContain(
        'I attempted to process your request but encountered some issues:',
      );
      expect(response).toContain('• The form was not found');
      expect(response).toContain(
        'Please verify the form ID or try a different approach.',
      );
    });
  });

  describe('Monitoring System', () => {
    it('should start and stop monitoring correctly', () => {
      // Start monitoring
      (robot as any).startResponseMonitoring(
        { messageId: 'test' } as TConversationTextMessageEnvelope,
        jest.fn(),
      );

      expect((robot as any).isActivelyListeningForResponse).toBe(true);
      expect((robot as any).activeMonitoringIntervals.size).toBeGreaterThan(0);

      // Stop monitoring
      robot.stopMonitoring();

      expect((robot as any).isActivelyListeningForResponse).toBe(false);
      expect((robot as any).activeMonitoringIntervals.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key in immediate response', async () => {
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
    });
  });
});
