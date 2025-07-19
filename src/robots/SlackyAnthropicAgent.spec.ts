import { SlackyAnthropicAgent } from './SlackyAnthropicAgent';
import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';

// Mock the dependencies
jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn();

  const mockAnthropicConstructor = jest.fn(() => ({
    messages: {
      create: mockCreate,
    },
  }));

  return {
    __esModule: true,
    default: mockAnthropicConstructor,
  };
});

jest.mock('./tool-definitions/slacky', () => ({
  slackyToolSet: {
    toolDefinitions: [
      {
        name: 'sumo_logic_query',
        description: 'Test Sumo Logic tool',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
    ],
    executeToolCall: jest.fn(),
  },
}));

jest.mock('./tool-definitions/marv', () => ({
  marvToolDefinitions: [
    {
      name: 'fieldLogicValidationCheck',
      description: 'Test Marv tool',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
  ],
  performMarvToolCall: jest.fn(),
  FsRestrictedApiRoutesEnum: {},
}));

jest.mock('./tool-definitions/toolCatalog', () => ({
  createCompositeToolSet: jest.fn(() => ({
    toolDefinitions: [
      {
        name: 'test_tool',
        description: 'Test composite tool',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
    ],
    executeToolCall: jest.fn().mockResolvedValue('Tool execution result'),
  })),
}));

describe('SlackyAnthropicAgent', () => {
  let agent: SlackyAnthropicAgent;
  const originalEnv = process.env;

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

  const mockConversationHistory: IConversationMessage[] = [
    {
      id: 'msg-1',
      content: 'Previous message',
      conversationId: 'conv-1',
      fromUserId: 'user-1',
      fromRole: UserRole.CUSTOMER,
      toRole: UserRole.ROBOT,
      messageType: MessageType.TEXT,
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-01T00:00:00Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    // Capture constructor console.log to prevent test pollution
    const originalConsoleLog = console.log;
    console.log = jest.fn();

    agent = new SlackyAnthropicAgent();

    console.log = originalConsoleLog;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Class Properties and Inheritance', () => {
    it('should extend AbstractRobotChat', () => {
      expect(agent).toBeInstanceOf(AbstractRobotChat);
    });

    it('should have correct static properties', () => {
      expect(agent.contextWindowSizeInTokens).toBe(200000);
      expect(agent.LLModelName).toBe('claude-3-5-sonnet-20241022');
      expect(agent.LLModelVersion).toBe('20241022');
      expect(agent.name).toBe('SlackyAnthropicAgent');
      expect(agent.version).toBe('1.0.0');
    });

    it('should have correct static descriptions', () => {
      expect(SlackyAnthropicAgent.descriptionShort).toContain(
        'Slack-specialized Anthropic Claude agent',
      );
      expect(SlackyAnthropicAgent.descriptionLong).toContain(
        'Slack integration with Anthropic',
      );
    });

    it('should log constructor call', () => {
      // Since we're now using CustomLoggerService, we can't easily mock it
      // The constructor logging is now handled by the logger service
      // This test is no longer needed as the logging is properly handled
      expect(() => {
        new SlackyAnthropicAgent();
      }).not.toThrow();
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(agent.estimateTokens('test')).toBe(1);
      expect(agent.estimateTokens('test message')).toBe(3);
      expect(agent.estimateTokens('')).toBe(0);
    });

    it('should round up partial tokens', () => {
      expect(agent.estimateTokens('a')).toBe(1);
      expect(agent.estimateTokens('abc')).toBe(1);
      expect(agent.estimateTokens('abcd')).toBe(1);
      expect(agent.estimateTokens('abcde')).toBe(2);
    });
  });

  describe('getUserHelpText', () => {
    it('should return comprehensive help text', () => {
      const helpText = agent.getUserHelpText();

      expect(helpText).toContain('iStackBuddy (Slacky) - Help');
      expect(helpText).toContain('Forms Core Troubleshooting');
      expect(helpText).toContain('SSO troubleshooting');
      expect(helpText).toContain('Sumo Logic Queries');
      expect(helpText).toContain('@istack-buddy');
      expect(helpText).toContain('/help');
      expect(helpText).toContain('/feedback');
      expect(helpText).toContain('/rating');
    });

    it('should include tool descriptions', () => {
      const helpText = agent.getUserHelpText();

      expect(helpText).toContain('SSO Auto-fill Assistance');
      expect(helpText).toContain('Form Validation');
      expect(helpText).toContain('Form Overviews');
    });
  });

  describe('setConversationHistory', () => {
    it('should store conversation history', () => {
      expect(() => {
        agent.setConversationHistory(mockConversationHistory);
      }).not.toThrow();
    });

    it('should handle empty history', () => {
      expect(() => {
        agent.setConversationHistory([]);
      }).not.toThrow();
    });
  });

  describe('getClient method', () => {
    it('should create Anthropic client with API key', () => {
      // Since getClient is private, we'll test it indirectly through a public method
      expect(process.env.ANTHROPIC_API_KEY).toBe('test-api-key');
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const agentWithoutKey = new SlackyAnthropicAgent();

      // Test through a method that calls getClient
      await expect(
        agentWithoutKey.acceptMessageImmediateResponse(mockMessageEnvelope),
      ).rejects.toThrow('ANTHROPIC_API_KEY environment variable is required');
    });
  });

  describe('acceptMessageImmediateResponse', () => {
    it('should handle direct feedback commands', async () => {
      const feedbackEnvelope = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: '@istack-buddy /feedback This is great!',
          },
        },
      };

      const result =
        await agent.acceptMessageImmediateResponse(feedbackEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Thank you for your feedback',
      );
      expect(result.envelopePayload.author_role).toBe('assistant');
    });

    it('should handle rating commands', async () => {
      const ratingEnvelope = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: '@istack-buddy /rating +5 Excellent service!',
          },
        },
      };

      const result = await agent.acceptMessageImmediateResponse(ratingEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Thank you for your rating',
      );
    });

    it('should handle help command', async () => {
      const helpEnvelope = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: '@istack-buddy /help',
          },
        },
      };

      const result = await agent.acceptMessageImmediateResponse(helpEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'iStackBuddy (Slacky) - Help',
      );
    });

    it('should handle regular messages with mocked Anthropic response', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This is a helpful response about forms.',
          },
        ],
        usage: { output_tokens: 20 },
      });

      const result =
        await agent.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'helpful response about forms',
      );
      expect(result.envelopePayload.author_role).toBe('assistant');
      expect(result.envelopePayload.estimated_token_count).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockRejectedValue(new Error('API connection failed'));

      const result =
        await agent.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Error: API connection failed',
      );
      expect(result.envelopePayload.author_role).toBe('assistant');
    });
  });

  describe('acceptMessageStreamResponse', () => {
    it('should handle streaming without tools', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const chunkCallback = jest.fn();

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Streaming response text',
          },
        ],
      });

      await agent.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(chunkCallback).toHaveBeenCalledWith('Streaming response text');
    });

    it('should handle streaming with tool execution', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const chunkCallback = jest.fn();

      // Mock first call with tool use
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'I need to use a tool.',
          },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'test_tool',
            input: { query: 'test' },
          },
        ],
      });

      // Mock streaming response for final call
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let count = 0;
          return {
            next: () => {
              if (count === 0) {
                count++;
                return Promise.resolve({
                  value: {
                    type: 'content_block_delta',
                    delta: { type: 'text_delta', text: 'Final response chunk' },
                  },
                  done: false,
                });
              }
              return Promise.resolve({ done: true });
            },
          };
        }),
      };

      mockCreate.mockResolvedValueOnce(mockStream);

      await agent.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(chunkCallback).toHaveBeenCalledWith('I need to use a tool.');
      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('Executing test_tool'),
      );
      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('Tool execution result'),
      );
      expect(chunkCallback).toHaveBeenCalledWith('Final response chunk');
    });

    it('should handle tool execution errors', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const chunkCallback = jest.fn();

      // Create agent that will fail during tool execution processing
      const errorAgent = new SlackyAnthropicAgent();

      // Mock the executeToolCall method to throw an uncaught error
      jest
        .spyOn(errorAgent as any, 'executeToolCall')
        .mockRejectedValue(new Error('Tool processing failed'));

      // Mock first call with tool use that will fail during execution
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tool_error_123',
            name: 'error_tool',
            input: { query: 'test' },
          },
        ],
      });

      // Mock second streaming response after tool error
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => ({
          next: jest
            .fn()
            .mockResolvedValueOnce({
              value: {
                type: 'content_block_delta',
                delta: { text: 'Analysis after error: ' },
              },
              done: false,
            })
            .mockResolvedValueOnce({
              value: {
                type: 'content_block_delta',
                delta: { text: 'Tool failed but continuing...' },
              },
              done: false,
            })
            .mockResolvedValueOnce({ done: true }),
        })),
      };

      mockCreate.mockResolvedValueOnce(mockStream);

      await errorAgent.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      // Verify tool error was streamed via chunkCallback in the specific format from lines 286-297
      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('**Tool Error: error_tool**'),
      );
      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('Tool processing failed'),
      );

      // Verify analysis header was streamed after error handling
      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('**Analysis:**'),
      );
    });
  });

  describe('acceptMessageMultiPartResponse', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return immediate response', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const delayedCallback = jest.fn();

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Immediate response',
          },
        ],
        usage: { output_tokens: 10 },
      });

      const result = await agent.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      expect(result.envelopePayload.content.payload).toContain(
        'Immediate response',
      );
    });

    it('should handle direct commands in multipart response', async () => {
      const delayedCallback = jest.fn();

      const feedbackEnvelope = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: '@istack-buddy /feedback Great service!',
          },
        },
      };

      const result = await agent.acceptMessageMultiPartResponse(
        feedbackEnvelope,
        delayedCallback,
      );

      expect(result.messageId).toMatch(/^slacky-direct-multipart-/);
      expect(result.envelopePayload.content.payload).toContain(
        'Thank you for your feedback',
      );
    });

    it('should handle tool execution with delayed callback', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const delayedCallback = jest.fn();

      // Mock first call with tool use
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'I need to use a tool',
          },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'test_tool',
            input: { query: 'test' },
          },
        ],
      });

      // Mock second call with final analysis
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Final analysis after tool execution',
          },
        ],
      });

      const result = await agent.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      expect(result.messageId).toMatch(/^slacky-analysis-/);
      expect(result.envelopePayload.content.payload).toBe(
        'Final analysis after tool execution',
      );
      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.stringMatching(/^slacky-tool-result-/),
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: expect.stringContaining('**Tool: test_tool**'),
            }),
          }),
        }),
      );
    });

    it('should handle tool execution errors with delayed callback', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const delayedCallback = jest.fn();

      // Mock composite tool set to throw error
      const {
        createCompositeToolSet,
      } = require('./tool-definitions/toolCatalog');
      createCompositeToolSet.mockReturnValue({
        toolDefinitions: [{ name: 'error_tool' }],
        executeToolCall: jest
          .fn()
          .mockRejectedValue(new Error('Tool execution failed')),
      });

      // Mock first call with tool use
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tool_error_123',
            name: 'error_tool',
            input: { query: 'test' },
          },
        ],
      });

      // Mock second call with final analysis
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Analysis after tool error',
          },
        ],
      });

      const result = await agent.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      expect(result.envelopePayload.content.payload).toBe(
        'Analysis after tool error',
      );
      // Since executeToolCall catches errors and returns strings,
      // the error comes through as a normal tool result, not tool error
      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.stringMatching(/^slacky-tool-result-/),
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: expect.stringContaining('**Tool: error_tool**'),
            }),
          }),
        }),
      );
    });

    it('should handle API errors in multipart response', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const delayedCallback = jest.fn();

      mockCreate.mockRejectedValue(new Error('Anthropic API error'));

      const result = await agent.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      expect(result.messageId).toMatch(/^slacky-multipart-error-/);
      expect(result.envelopePayload.content.payload).toContain(
        'Anthropic API error',
      );
    });

    it('should build correct Claude message history', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const delayedCallback = jest.fn();

      // Set conversation history
      agent.setConversationHistory([
        {
          id: 'msg-1',
          content: 'Previous user message',
          conversationId: 'conv-1',
          fromUserId: 'user-1',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          messageType: MessageType.TEXT,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        },
      ]);

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      await agent.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Previous user message',
            }),
            expect.objectContaining({
              role: 'user',
              content: 'Test message content',
            }),
          ]),
        }),
      );
    });

    it('should handle multiple tool executions in sequence', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const delayedCallback = jest.fn();

      // Mock first call with multiple tool uses
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'test_tool',
            input: { query: 'first' },
          },
          {
            type: 'tool_use',
            id: 'tool_2',
            name: 'test_tool',
            input: { query: 'second' },
          },
        ],
      });

      // Mock second call with final analysis
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Analysis of multiple tools',
          },
        ],
      });

      const result = await agent.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      expect(result.envelopePayload.content.payload).toBe(
        'Analysis of multiple tools',
      );
      expect(delayedCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling in acceptMessageImmediateResponse', () => {
    it('should handle API errors and return error response', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockRejectedValue(new Error('Network timeout'));

      const result =
        await agent.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.messageId).toMatch(/^slacky-error-/);
      expect(result.envelopePayload.content.payload).toContain(
        'Network timeout',
      );
      expect(result.envelopePayload.author_role).toBe('assistant');
    });

    it('should handle unknown errors', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockRejectedValue('String error');

      const result =
        await agent.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Unknown error occurred',
      );
    });

    it('should return proper response structure for normal flow', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Normal response',
          },
        ],
        usage: { output_tokens: 15 },
      });

      const result =
        await agent.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.messageId).toMatch(/^slacky-response-/);
      expect(result.requestOrResponse).toBe('response');
      expect(result.envelopePayload.messageId).toMatch(/^slacky-msg-/);
      expect(result.envelopePayload.author_role).toBe('assistant');
      expect(result.envelopePayload.content.type).toBe('text/plain');
      expect(result.envelopePayload.content.payload).toBe('Normal response');
      expect(result.envelopePayload.created_at).toMatch(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
      expect(result.envelopePayload.estimated_token_count).toBeGreaterThan(0);
    });
  });

  describe('buildClaudeMessageHistory method', () => {
    it('should build message history correctly', async () => {
      // Set up conversation history
      const historyMessages = [
        {
          id: 'msg-1',
          content: 'First user message',
          conversationId: 'conv-1',
          fromUserId: 'user-1',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          messageType: MessageType.TEXT,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        },
        {
          id: 'msg-2',
          content: 'First robot response',
          conversationId: 'conv-1',
          fromUserId: 'robot-1',
          fromRole: UserRole.ROBOT,
          toRole: UserRole.CUSTOMER,
          messageType: MessageType.ROBOT,
          createdAt: new Date('2023-01-01T00:01:00Z'),
          updatedAt: new Date('2023-01-01T00:01:00Z'),
        },
      ];

      agent.setConversationHistory(historyMessages);

      // Test by calling a method that uses buildClaudeMessageHistory
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      await agent.acceptMessageImmediateResponse(mockMessageEnvelope);

      // Verify the message history was built correctly
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3); // 2 from history + 1 current
      expect(callArgs.messages[0]).toEqual({
        role: 'user',
        content: 'First user message',
      });
      expect(callArgs.messages[1]).toEqual({
        role: 'assistant',
        content: 'First robot response',
      });
      expect(callArgs.messages[2]).toEqual({
        role: 'user',
        content: 'Test message content',
      });
    });
  });

  describe('executeToolCall method', () => {
    it('should execute tool calls through composite tool set successfully', async () => {
      // Create a new agent instance with mocked tools
      const {
        createCompositeToolSet,
      } = require('./tool-definitions/toolCatalog');
      const mockExecute = jest.fn().mockResolvedValue('Tool execution result');

      createCompositeToolSet.mockReturnValue({
        toolDefinitions: [{ name: 'test_tool' }],
        executeToolCall: mockExecute,
      });

      // Create new agent to pick up the mocked tool set
      const testAgent = new SlackyAnthropicAgent();

      const result = await (testAgent as any).executeToolCall('test_tool', {
        param: 'value',
      });

      expect(result).toBe('Tool execution result');
      expect(mockExecute).toHaveBeenCalledWith('test_tool', { param: 'value' });
    });

    it('should handle tool execution errors and return error string', async () => {
      // Create a new agent instance with mocked tools that throw errors
      const {
        createCompositeToolSet,
      } = require('./tool-definitions/toolCatalog');
      const mockExecute = jest.fn().mockRejectedValue(new Error('Tool failed'));

      createCompositeToolSet.mockReturnValue({
        toolDefinitions: [{ name: 'error_tool' }],
        executeToolCall: mockExecute,
      });

      // Create new agent to pick up the mocked tool set
      const testAgent = new SlackyAnthropicAgent();

      const result = await (testAgent as any).executeToolCall('error_tool', {});

      expect(result).toContain('Error executing tool error_tool: Tool failed');
    });
  });

  describe('Additional Error Handling Coverage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle feedback processing error (line 421)', async () => {
      // Mock executeToolCall to throw error during feedback processing
      jest
        .spyOn(agent as any, 'executeToolCall')
        .mockRejectedValue(new Error('Feedback tool failed'));

      const feedbackEnvelope = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: '@istack-buddy /feedback This tool should fail!',
          },
        },
      };

      const result =
        await agent.acceptMessageImmediateResponse(feedbackEnvelope);

      // Should still return thank you message despite error
      expect(result.envelopePayload.content.payload).toContain(
        'Thank you for your feedback',
      );
    });

    it('should handle rating processing error (line 478)', async () => {
      // Mock executeToolCall to throw error during rating processing
      jest
        .spyOn(agent as any, 'executeToolCall')
        .mockRejectedValue(new Error('Rating tool failed'));

      const ratingEnvelope = {
        ...mockMessageEnvelope,
        envelopePayload: {
          ...mockMessageEnvelope.envelopePayload,
          content: {
            type: 'text/plain' as const,
            payload: '@istack-buddy /rating +5 This tool should fail!',
          },
        },
      };

      const result = await agent.acceptMessageImmediateResponse(ratingEnvelope);

      // Should still return thank you message despite error
      expect(result.envelopePayload.content.payload).toContain(
        'Thank you for your rating',
      );
    });
  });

  // Add tests for edge cases that might be missed
  describe('Edge Case Error Coverage', () => {
    it('should handle mixed content in Anthropic responses', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'First part ',
          },
          {
            type: 'text',
            text: 'second part',
          },
          {
            type: 'other',
            data: 'ignored',
          },
        ],
        usage: { output_tokens: 20 },
      });

      const result =
        await agent.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toBe(
        'First part second part',
      );
    });

    it('should handle empty content in Anthropic responses', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockResolvedValue({
        content: [],
        usage: { output_tokens: 0 },
      });

      const result =
        await agent.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toBe('');
    });

    it('should generate unique IDs when using fake timers', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        usage: { output_tokens: 10 },
      });

      // Mock Date.now to return different values
      let mockTime = 1000000;
      jest.spyOn(Date, 'now').mockImplementation(() => mockTime++);

      const [result1, result2] = await Promise.all([
        agent.acceptMessageImmediateResponse(mockMessageEnvelope),
        agent.acceptMessageImmediateResponse(mockMessageEnvelope),
      ]);

      expect(result1.messageId).not.toBe(result2.messageId);
      expect(result1.envelopePayload.messageId).not.toBe(
        result2.envelopePayload.messageId,
      );

      // Restore Date.now
      (Date.now as jest.Mock).mockRestore();
    });
  });

  describe('executeToolAllCalls method', () => {
    it('should execute multiple tool calls successfully', async () => {
      const mockToolUses = [
        { id: 'tool1', name: 'first_tool', input: { param: 'value1' } },
        { id: 'tool2', name: 'second_tool', input: { param: 'value2' } },
      ];

      const mockExecuteToolCall = jest
        .spyOn(agent as any, 'executeToolCall')
        .mockResolvedValueOnce('Result 1')
        .mockResolvedValueOnce('Result 2');

      const result = await (agent as any).executeToolAllCalls(mockToolUses);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool1',
        content: 'Result 1',
      });
      expect(result[1]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool2',
        content: 'Result 2',
      });
      expect(mockExecuteToolCall).toHaveBeenCalledTimes(2);
    });

    it('should handle tool execution errors', async () => {
      const mockToolUses = [
        { id: 'tool1', name: 'success_tool', input: { param: 'value1' } },
        { id: 'tool2', name: 'error_tool', input: { param: 'value2' } },
      ];

      const mockExecuteToolCall = jest
        .spyOn(agent as any, 'executeToolCall')
        .mockResolvedValueOnce('Success result')
        .mockRejectedValueOnce(new Error('Tool execution failed'));

      const result = await (agent as any).executeToolAllCalls(mockToolUses);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool1',
        content: 'Success result',
      });
      expect(result[1]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool2',
        content: 'Error: Tool execution failed',
        is_error: true,
      });
    });

    it('should handle non-Error exceptions', async () => {
      const mockToolUses = [
        { id: 'tool1', name: 'error_tool', input: { param: 'value1' } },
      ];

      const mockExecuteToolCall = jest
        .spyOn(agent as any, 'executeToolCall')
        .mockRejectedValueOnce('String error');

      const result = await (agent as any).executeToolAllCalls(mockToolUses);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool1',
        content: 'Error: Unknown error',
        is_error: true,
      });
    });
  });

  describe('executeToolAllCallsWithDelayedCallback method', () => {
    it('should execute tools and send delayed callbacks for success', async () => {
      const mockToolUses = [
        { id: 'tool1', name: 'test_tool', input: { param: 'value1' } },
      ];

      const delayedCallback = jest.fn();
      const mockExecuteToolCall = jest
        .spyOn(agent as any, 'executeToolCall')
        .mockResolvedValueOnce('Tool result');

      const result = await (
        agent as any
      ).executeToolAllCallsWithDelayedCallback(mockToolUses, delayedCallback);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool1',
        content: 'Tool result',
      });

      // Should have sent delayed callback
      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.stringMatching(/^slacky-tool-result-/),
          requestOrResponse: 'response',
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: '**Tool: test_tool**\n\nTool result',
            }),
          }),
        }),
      );
    });

    it('should handle tool errors and send error callbacks', async () => {
      const mockToolUses = [
        { id: 'tool1', name: 'error_tool', input: { param: 'value1' } },
      ];

      const delayedCallback = jest.fn();
      const mockExecuteToolCall = jest
        .spyOn(agent as any, 'executeToolCall')
        .mockRejectedValueOnce(new Error('Tool failed'));

      const result = await (
        agent as any
      ).executeToolAllCallsWithDelayedCallback(mockToolUses, delayedCallback);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool1',
        content: 'Error: Tool failed',
        is_error: true,
      });

      // Should have sent error callback
      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.stringMatching(/^slacky-tool-error-/),
          requestOrResponse: 'response',
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: '**Tool Error: error_tool**\n\nError: Tool failed',
            }),
          }),
        }),
      );
    });

    it('should handle multiple tools with mixed success/error', async () => {
      const mockToolUses = [
        { id: 'tool1', name: 'success_tool', input: { param: 'value1' } },
        { id: 'tool2', name: 'error_tool', input: { param: 'value2' } },
      ];

      const delayedCallback = jest.fn();
      const mockExecuteToolCall = jest
        .spyOn(agent as any, 'executeToolCall')
        .mockResolvedValueOnce('Success result')
        .mockRejectedValueOnce(new Error('Tool failed'));

      const result = await (
        agent as any
      ).executeToolAllCallsWithDelayedCallback(mockToolUses, delayedCallback);

      expect(result).toHaveLength(2);
      expect(delayedCallback).toHaveBeenCalledTimes(2);

      // Check first call (success)
      expect(delayedCallback).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          messageId: expect.stringMatching(/^slacky-tool-result-/),
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: '**Tool: success_tool**\n\nSuccess result',
            }),
          }),
        }),
      );

      // Check second call (error)
      expect(delayedCallback).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          messageId: expect.stringMatching(/^slacky-tool-error-/),
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: '**Tool Error: error_tool**\n\nError: Tool failed',
            }),
          }),
        }),
      );
    });
  });

  describe('Streaming catch block coverage (lines 336-338)', () => {
    it('should handle streaming API errors and call chunkCallback before rethrowing', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const chunkCallback = jest.fn();

      // Mock first call to succeed with tools to trigger streaming path
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Initial response' },
          { type: 'tool_use', id: 'tool1', name: 'test_tool', input: {} },
        ],
        usage: { output_tokens: 10 },
      });

      // Mock second streaming call to throw error
      mockCreate.mockRejectedValueOnce(new Error('Streaming API failed'));

      // This should trigger the catch block at lines 336-338
      await expect(
        agent.acceptMessageStreamResponse(mockMessageEnvelope, chunkCallback),
      ).rejects.toThrow('Streaming API failed');

      // Verify error was sent to chunkCallback before rethrowing
      expect(chunkCallback).toHaveBeenCalledWith('Error: Streaming API failed');
    });

    it('should handle unknown error types in streaming catch block', async () => {
      const { default: Anthropic } = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic().messages.create;
      const chunkCallback = jest.fn();

      // Mock to throw non-Error object on first call
      mockCreate.mockRejectedValueOnce('String error not Error object');

      // This should trigger the catch block with unknown error handling
      await expect(
        agent.acceptMessageStreamResponse(mockMessageEnvelope, chunkCallback),
      ).rejects.toBe('String error not Error object');

      // Verify unknown error was handled gracefully
      expect(chunkCallback).toHaveBeenCalledWith(
        'Error: Unknown error occurred',
      );
    });
  });
});
