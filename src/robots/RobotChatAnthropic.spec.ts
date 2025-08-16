import { RobotChatAnthropic } from './RobotChatAnthropic';
import { AbstractRobotChat } from './AbstractRobotChat';
import { slackyToolSet } from './tool-definitions';
import { anthropicToolSet } from './tool-definitions/toolCatalog';
import { UserRole } from '../chat-manager/dto/create-message.dto';

import { marvToolSet } from './tool-definitions/marv';
import type { TConversationTextMessageEnvelope } from './types';

// Mock the dependencies
jest.mock('./tool-definitions', () => ({
  slackyToolSet: {
    toolDefinitions: [
      {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
          },
          required: ['param1'],
        },
      },
    ],
    executeToolCall: jest.fn(),
  },
}));

jest.mock('./tool-definitions/marv', () => ({
  marvToolSet: {
    toolDefinitions: [
      {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
          },
          required: ['param1'],
        },
      },
    ],
    executeToolCall: jest.fn().mockResolvedValue('Tool executed successfully'),
  },
}));

jest.mock('./tool-definitions/marv/fsApiClient', () => {
  const mockInstance = {
    setApiKey: jest.fn(),
  };
  return {
    FsApiClient: jest.fn().mockImplementation(() => mockInstance),
    fsApiClient: mockInstance,
  };
});

// Get the mocked module to access the mock instance
const { fsApiClient: mockFsApiClient } = jest.mocked(
  require('./tool-definitions/marv/fsApiClient'),
) as any;

// Mock Anthropic SDK with more sophisticated mocking
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
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

// Get the mocked modules
const mockslackyToolSet = slackyToolSet as jest.Mocked<typeof slackyToolSet>;
const mockMarvToolSet = marvToolSet as jest.Mocked<typeof marvToolSet>;
const mockExecuteToolCall = marvToolSet.executeToolCall as jest.MockedFunction<
  typeof marvToolSet.executeToolCall
>;

describe('RobotChatAnthropic', () => {
  let robot: RobotChatAnthropic;
  const originalEnv = process.env;

  const mockMessageEnvelope: TConversationTextMessageEnvelope = {
    messageId: 'test-message-id',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: 'test-payload-id',
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: 'Hello, can you help me with a form issue?',
      },
      created_at: '2023-01-01T00:00:00Z',
      estimated_token_count: 10,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      ANTHROPIC_API_KEY: 'sk-ant-api03-test-key-for-testing',
      FORMSTACK_API_KEY: 'test-formstack-key',
    };
    robot = new RobotChatAnthropic();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Class Properties and Inheritance', () => {
    it('should extend AbstractRobotChat', () => {
      expect(robot).toBeInstanceOf(AbstractRobotChat);
    });

    it('should have correct static properties', () => {
      expect(robot.contextWindowSizeInTokens).toBe(200000);
      expect(robot.LLModelName).toBe('claude-3-5-sonnet-20241022');
      expect(robot.LLModelVersion).toBe('20241022');
      expect(robot.name).toBe('RobotChatAnthropic');
      expect(robot.version).toBe('1.0.0');
    });

    it('should have correct static descriptions', () => {
      expect(RobotChatAnthropic.descriptionShort).toContain(
        'Anthropic Claude chat robot',
      );
      expect(RobotChatAnthropic.descriptionLong).toContain(
        'advanced chat functionality',
      );
    });

    it('should have fsApiClient available for API operations', () => {
      expect(mockFsApiClient).toBeDefined();
    });

    it('should have tools property initialized', () => {
      expect((robot as any).tools).toBeDefined();
      expect(Array.isArray((robot as any).tools)).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(robot.estimateTokens('test')).toBe(1);
      expect(robot.estimateTokens('hello world')).toBe(3);
      expect(robot.estimateTokens('')).toBe(0);
      expect(robot.estimateTokens('a'.repeat(16))).toBe(4);
    });

    it('should round up partial tokens', () => {
      expect(robot.estimateTokens('hello')).toBe(2);
    });
  });

  describe('getClient - API Key Validation', () => {
    it('should create Anthropic client with API key', () => {
      const AnthropicConstructor = require('@anthropic-ai/sdk').default;
      const client = (robot as any).getClient();
      expect(AnthropicConstructor).toHaveBeenCalledWith({
        apiKey: 'sk-ant-api03-test-key-for-testing',
      });
      expect(client).toBeDefined();
    });

    it('should throw error when API key is missing', () => {
      // Temporarily remove API key
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => (robot as any).getClient()).toThrow(
        'ANTHROPIC_API_KEY environment variable is required but not set',
      );

      // Restore API key
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    });
  });

  describe('Private Methods', () => {
    it('should create proper Anthropic message request', () => {
      const request = (robot as any).createAnthropicMessageRequest(
        mockMessageEnvelope,
      );

      expect(request).toEqual({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: expect.stringContaining('iStackBuddy robot'),
        messages: [
          {
            role: 'user',
            content: 'Hello, can you help me with a form issue?',
          },
        ],
        tools: expect.any(Array),
      });
    });

    it('should include system prompt about Forms Core', () => {
      const request = (robot as any).createAnthropicMessageRequest(
        mockMessageEnvelope,
      );

      expect(request.system).toContain('Forms Core');
      expect(request.system).toContain('Intellistack');
      expect(request.system).toContain('SSO troubleshooting');
      expect(request.system).toContain('Sumo Logic Queries');
    });

    it('should build Claude message history with conversation history', () => {
      const history = [
        {
          fromRole: UserRole.CUSTOMER,
          content: 'User message 1',
        } as any,
        {
          fromRole: UserRole.ROBOT,
          content: 'Robot response 1',
        } as any,
        {
          fromRole: UserRole.CUSTOMER,
          content: 'User message 2',
        } as any,
      ];

      robot.setConversationHistory(history);
      const messages = (robot as any).buildClaudeMessageHistory(
        'Current message',
      );

      expect(messages).toHaveLength(4); // 3 history + 1 current
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'User message 1',
      });
      expect(messages[1]).toEqual({
        role: 'assistant',
        content: 'Robot response 1',
      });
      expect(messages[2]).toEqual({
        role: 'user',
        content: 'User message 2',
      });
      expect(messages[3]).toEqual({
        role: 'user',
        content: 'Current message',
      });
    });

    it('should build Claude message history with only current message when no history', () => {
      robot.setConversationHistory([]);
      const messages = (robot as any).buildClaudeMessageHistory(
        'Current message',
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'Current message',
      });
    });

    it('should build Claude message history ignoring non-CUSTOMER/ROBOT roles', () => {
      const history = [
        {
          fromRole: UserRole.CUSTOMER,
          content: 'User message',
        } as any,
        {
          fromRole: UserRole.AGENT,
          content: 'Agent message', // Should be ignored
        } as any,
        {
          fromRole: UserRole.ROBOT,
          content: 'Robot response',
        } as any,
      ];

      robot.setConversationHistory(history);
      const messages = (robot as any).buildClaudeMessageHistory(
        'Current message',
      );

      expect(messages).toHaveLength(3); // 2 valid history + 1 current
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });

    it('should execute tool call with string result', async () => {
      mockMarvToolSet.executeToolCall.mockResolvedValue('String result');

      const result = await (robot as any).executeToolCall('test_tool', {
        param: 'value',
      });

      expect(result).toBe('"String result"');
      expect(mockMarvToolSet.executeToolCall).toHaveBeenCalledWith(
        'test_tool',
        { param: 'value' },
      );
    });

    it('should execute tool call with Promise result', async () => {
      mockMarvToolSet.executeToolCall.mockResolvedValue('Promise result');

      const result = await (robot as any).executeToolCall('test_tool', {
        param: 'value',
      });

      expect(result).toBe('"Promise result"');
    });

    it('should handle tool execution error', async () => {
      mockMarvToolSet.executeToolCall.mockRejectedValue(
        new Error('Tool error'),
      );

      const result = await (robot as any).executeToolCall('failing_tool', {
        param: 'value',
      });

      expect(result).toBe('Error executing tool failing_tool: Tool error');
    });

    it('should handle tool execution error with non-Error object', async () => {
      mockMarvToolSet.executeToolCall.mockRejectedValue('String error');

      const result = await (robot as any).executeToolCall('failing_tool', {
        param: 'value',
      });

      expect(result).toBe('Error executing tool failing_tool: Unknown error');
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool call and return string result', async () => {
      mockMarvToolSet.executeToolCall.mockResolvedValue(
        'Tool executed successfully',
      );

      const result = await (robot as any).executeToolCall('test_tool', {
        param1: 'value1',
      });

      expect(mockMarvToolSet.executeToolCall).toHaveBeenCalledWith(
        'test_tool',
        { param1: 'value1' },
      );
      expect(result).toBe('"Tool executed successfully"');
    });

    it('should execute tool call and await Promise result', async () => {
      mockMarvToolSet.executeToolCall.mockResolvedValue('Async tool result');

      const result = await (robot as any).executeToolCall('async_tool', {
        param1: 'value1',
      });

      expect(result).toBe('"Async tool result"');
    });
  });

  describe('Streaming Response - Complete Coverage', () => {
    it('should handle streaming text response chunks', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Hello ' },
            },
            {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'world!' },
            },
          ];

          return {
            async next() {
              if (chunkIndex < chunks.length) {
                return { value: chunks[chunkIndex++], done: false };
              }
              return { done: true };
            },
          };
        }),
      };

      mockCreate.mockResolvedValue(mockStream);
      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };

      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith('Hello ');
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith('world!');
    });

    it('should handle tool use in streaming response with complete flow', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_use_123',
                name: 'test_tool',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"param1":',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '"test_value"}',
              },
            },
            {
              type: 'content_block_stop',
            },
          ];

          return {
            async next() {
              if (chunkIndex < chunks.length) {
                return { value: chunks[chunkIndex++], done: false };
              }
              return { done: true };
            },
          };
        }),
      };

      mockCreate.mockResolvedValue(mockStream);
      mockMarvToolSet.executeToolCall.mockResolvedValue(
        'Tool result from streaming',
      );

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };
      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(mockMarvToolSet.executeToolCall).toHaveBeenCalledWith(
        'test_tool',
        { param1: 'test_value' },
      );
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        '\n\n"Tool result from streaming"',
      );
    });

    it('should handle tool use without currentToolUse set', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"param1":"orphaned"}',
              },
            },
            // No tool_use start block, so currentToolUse is null
          ];

          return {
            async next() {
              if (chunkIndex < chunks.length) {
                return { value: chunks[chunkIndex++], done: false };
              }
              return { done: true };
            },
          };
        }),
      };

      mockCreate.mockResolvedValue(mockStream);

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };
      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      // Should not call tool execution since no tool use was properly set up
      expect(mockslackyToolSet.executeToolCall).not.toHaveBeenCalled();
    });

    it('should handle JSON parse error in streaming tool input', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_use_123',
                name: 'test_tool',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: 'invalid json {',
              },
            },
            {
              type: 'content_block_stop',
            },
          ];

          return {
            async next() {
              if (chunkIndex < chunks.length) {
                return { value: chunks[chunkIndex++], done: false };
              }
              return { done: true };
            },
          };
        }),
      };

      mockCreate.mockResolvedValue(mockStream);

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };
      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing tool arguments'),
      );
    });

    it('should handle tool execution error in streaming', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_use_123',
                name: 'failing_tool',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"param1":"test"}',
              },
            },
            {
              type: 'content_block_stop',
            },
          ];

          return {
            async next() {
              if (chunkIndex < chunks.length) {
                return { value: chunks[chunkIndex++], done: false };
              }
              return { done: true };
            },
          };
        }),
      };

      mockCreate.mockResolvedValue(mockStream);
      mockMarvToolSet.executeToolCall.mockRejectedValue(
        new Error('Tool execution failed'),
      );

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };
      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error executing tool failing_tool: Tool execution failed',
        ),
      );
    });

    it('should handle tool execution error with non-Error object', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_use_123',
                name: 'failing_tool',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"param1":"test"}',
              },
            },
            {
              type: 'content_block_stop',
            },
          ];

          return {
            async next() {
              if (chunkIndex < chunks.length) {
                return { value: chunks[chunkIndex++], done: false };
              }
              return { done: true };
            },
          };
        }),
      };

      mockCreate.mockResolvedValue(mockStream);
      mockMarvToolSet.executeToolCall.mockRejectedValue('String error');

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };
      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error executing tool failing_tool: Unknown error',
        ),
      );
    });

    it('should handle mixed content and tool use in streaming', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Let me help you. ' },
            },
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_use_123',
                name: 'test_tool',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"param1":"value"}',
              },
            },
            {
              type: 'content_block_stop',
            },
            {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Analysis complete.' },
            },
          ];

          return {
            async next() {
              if (chunkIndex < chunks.length) {
                return { value: chunks[chunkIndex++], done: false };
              }
              return { done: true };
            },
          };
        }),
      };

      mockCreate.mockResolvedValue(mockStream);
      mockMarvToolSet.executeToolCall.mockResolvedValue(
        'Tool analysis results',
      );

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };
      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        'Let me help you. ',
      );
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        '\n\n"Tool analysis results"',
      );
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        'Analysis complete.',
      );
    });

    it('should handle streaming API error', async () => {
      mockCreate.mockRejectedValue(new Error('Streaming API Error'));

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };

      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle streaming API error with non-Error object', async () => {
      mockCreate.mockRejectedValue('String streaming error');

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };

      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith('String streaming error');
    });
  });

  describe('Immediate Response - Complete Tool Coverage', () => {
    it('should handle response with tool use and successful execution', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Let me help you with that form issue. ',
          },
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'test_tool',
            input: { param1: 'test_value' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockMarvToolSet.executeToolCall.mockResolvedValue(
        'Tool executed successfully',
      );

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Let me help you with that form issue.',
      );
      expect(result.envelopePayload.content.payload).toContain(
        '"Tool executed successfully"',
      );
      expect(mockMarvToolSet.executeToolCall).toHaveBeenCalledWith(
        'test_tool',
        { param1: 'test_value' },
      );
    });

    it('should handle tool execution error in immediate response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'failing_tool',
            input: { param1: 'test' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockMarvToolSet.executeToolCall.mockRejectedValue(
        new Error('Tool failed'),
      );

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Error executing tool failing_tool: Tool failed',
      );
    });

    it('should handle tool execution error with non-Error object', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'failing_tool',
            input: { param1: 'test' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockMarvToolSet.executeToolCall.mockRejectedValue('String error');

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Error executing tool failing_tool: Unknown error',
      );
    });

    it('should handle multiple tool uses in immediate response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Processing your request... ',
          },
          {
            type: 'tool_use',
            id: 'tool_use_1',
            name: 'tool_one',
            input: { param: 'value1' },
          },
          {
            type: 'tool_use',
            id: 'tool_use_2',
            name: 'tool_two',
            input: { param: 'value2' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockMarvToolSet.executeToolCall
        .mockResolvedValueOnce('Result from tool one')
        .mockResolvedValueOnce('Result from tool two');

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Processing your request...',
      );
      expect(result.envelopePayload.content.payload).toContain(
        '"Result from tool one"',
      );
      expect(result.envelopePayload.content.payload).toContain(
        '"Result from tool two"',
      );
      expect(mockMarvToolSet.executeToolCall).toHaveBeenCalledTimes(2);
    });

    it('should generate proper response structure', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'This is a helpful response about your form issue.',
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.requestOrResponse).toBe('response');
      expect(result.envelopePayload.author_role).toBe('assistant');
      expect(result.envelopePayload.content.type).toBe('text/plain');
      expect(result.envelopePayload.content.payload).toBe(
        'This is a helpful response about your form issue.',
      );
      expect(result.envelopePayload.estimated_token_count).toBeGreaterThan(0);
      // messageId is not part of TRobotResponseEnvelope - it's added by conversation manager
      expect(result.envelopePayload.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should handle empty response content', async () => {
      const mockResponse = { content: [] };
      mockCreate.mockResolvedValue(mockResponse);

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toBe('');
      expect(result.envelopePayload.estimated_token_count).toBe(0);
    });

    it('should handle API errors gracefully in immediate response', async () => {
      mockCreate.mockRejectedValue(new Error('API connection failed'));

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.requestOrResponse).toBe('response');
      expect(result.envelopePayload.author_role).toBe('assistant');
      expect(result.envelopePayload.content.payload).toContain(
        'I apologize, but I encountered an error: API connection failed',
      );
    });

    it('should handle unknown errors in immediate response', async () => {
      mockCreate.mockRejectedValue('String error');

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Unknown error occurred',
      );
    });

    it('should handle response with mixed content types', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Part 1. ',
          },
          {
            type: 'unknown_type',
            data: 'ignored', // Should be ignored
          },
          {
            type: 'text',
            text: 'Part 2.',
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toBe('Part 1. Part 2.');
    });

    it('should handle response with only tool use content', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'test_tool',
            input: { param1: 'test_value' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockMarvToolSet.executeToolCall.mockResolvedValue(
        'Tool executed successfully',
      );

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toBe(
        '\n\n"Tool executed successfully"',
      );
    });

    it('should handle response with tool use error', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'failing_tool',
            input: { param1: 'test' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockMarvToolSet.executeToolCall.mockRejectedValue(
        new Error('Tool failed'),
      );

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Error executing tool failing_tool: Tool failed',
      );
    });

    it('should handle response with tool use non-Error error', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'failing_tool',
            input: { param1: 'test' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockMarvToolSet.executeToolCall.mockRejectedValue('String error');

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Error executing tool failing_tool: Unknown error',
      );
    });
  });

  describe('Multi-part Response - Complete Delayed Callback Coverage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle multi-part response with successful delayed callback', async () => {
      const immediateResponse = {
        content: [{ type: 'text', text: 'Immediate response' }],
      };

      const followUpResponse = {
        content: [{ type: 'text', text: 'Follow-up response' }],
      };

      mockCreate
        .mockResolvedValueOnce(immediateResponse)
        .mockResolvedValueOnce(followUpResponse);

      const delayedCallback = jest.fn();

      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      // Check immediate response
      expect(result.envelopePayload.content.payload).toBe('Immediate response');

      // Fast-forward time to trigger delayed callback
      jest.advanceTimersByTime(2000);
      await Promise.resolve(); // Allow async operations to complete

      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestOrResponse: 'response',
          messageId: expect.stringMatching(/^delayed-\d+$/),
          envelopePayload: expect.objectContaining({
            messageId: expect.stringMatching(/^delayed-msg-\d+$/),
            author_role: 'assistant',
            content: expect.objectContaining({
              payload: 'Follow-up response',
            }),
            estimated_token_count: expect.any(Number),
            created_at: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
            ),
          }),
        }),
      );
    });

    it('should handle error in delayed callback', async () => {
      const immediateResponse = {
        content: [{ type: 'text', text: 'Immediate response' }],
      };

      mockCreate
        .mockResolvedValueOnce(immediateResponse)
        .mockRejectedValueOnce(new Error('Delayed API error'));

      const delayedCallback = jest.fn();

      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      // Fast-forward time
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.stringMatching(/^delayed-error-\d+$/),
          envelopePayload: expect.objectContaining({
            messageId: expect.stringMatching(/^delayed-error-msg-\d+$/),
            content: expect.objectContaining({
              payload: expect.stringContaining(
                'Error in delayed response: Delayed API error',
              ),
            }),
          }),
        }),
      );
    });

    it('should handle non-Error in delayed callback', async () => {
      const immediateResponse = {
        content: [{ type: 'text', text: 'Immediate response' }],
      };

      mockCreate
        .mockResolvedValueOnce(immediateResponse)
        .mockRejectedValueOnce('String delayed error');

      const delayedCallback = jest.fn();

      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: expect.stringContaining(
                'Error in delayed response: Unknown error in delayed response',
              ),
            }),
          }),
        }),
      );
    });

    it('should create proper follow-up request', async () => {
      const immediateResponse = {
        content: [{ type: 'text', text: 'Immediate response' }],
      };

      const followUpResponse = {
        content: [{ type: 'text', text: 'Follow-up response' }],
      };

      mockCreate
        .mockResolvedValueOnce(immediateResponse)
        .mockResolvedValueOnce(followUpResponse);

      const delayedCallback = jest.fn();

      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      // Verify the follow-up request was created correctly
      expect(mockCreate).toHaveBeenCalledTimes(2);
      const followUpCall = mockCreate.mock.calls[1][0];
      expect(followUpCall.messages[0].content).toContain('Follow up on:');
      expect(followUpCall.messages[0].content).toContain(
        'Hello, can you help me with a form issue?',
      );
      expect(followUpCall.messages[0].content).toContain(
        'Sumo Logic queries and SSO auto-fill troubleshooting',
      );
    });

    it('should handle mixed content types in delayed response', async () => {
      const immediateResponse = {
        content: [{ type: 'text', text: 'Immediate response' }],
      };

      const followUpResponse = {
        content: [
          { type: 'text', text: 'Part 1. ' },
          { type: 'unknown_type', data: 'ignored' }, // Should be ignored
          { type: 'text', text: 'Part 2.' },
        ],
      };

      mockCreate
        .mockResolvedValueOnce(immediateResponse)
        .mockResolvedValueOnce(followUpResponse);

      const delayedCallback = jest.fn();

      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: 'Part 1. Part 2.',
            }),
          }),
        }),
      );
    });

    it('should handle delayed response with only non-text content', async () => {
      const immediateResponse = {
        content: [{ type: 'text', text: 'Immediate response' }],
      };

      const followUpResponse = {
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'test_tool', input: {} },
          { type: 'unknown_type', data: 'ignored' },
        ],
      };

      mockCreate
        .mockResolvedValueOnce(immediateResponse)
        .mockResolvedValueOnce(followUpResponse);

      const delayedCallback = jest.fn();

      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: '', // No text content
            }),
          }),
        }),
      );
    });

    it('should handle delayed response with empty content array', async () => {
      const immediateResponse = {
        content: [{ type: 'text', text: 'Immediate response' }],
      };

      const followUpResponse = {
        content: [],
      };

      mockCreate
        .mockResolvedValueOnce(immediateResponse)
        .mockResolvedValueOnce(followUpResponse);

      const delayedCallback = jest.fn();

      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          envelopePayload: expect.objectContaining({
            content: expect.objectContaining({
              payload: '', // Empty content
            }),
          }),
        }),
      );
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete message flow', () => {
      expect(robot.name).toBe('RobotChatAnthropic');
      expect(robot.version).toBe('1.0.0');
      expect(robot.contextWindowSizeInTokens).toBe(200000);
      expect(robot.LLModelName).toBe('claude-3-5-sonnet-20241022');

      const testMessage = 'Hello, this is a test message';
      const estimatedTokens = robot.estimateTokens(testMessage);
      expect(estimatedTokens).toBeGreaterThan(0);

      const request = (robot as any).createAnthropicMessageRequest(
        mockMessageEnvelope,
      );
      expect(request.system).toContain('iStackBuddy robot');
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
    });

    it('should handle complex integration scenario with all features', async () => {
      // Test streaming with tools, immediate response with tools, and multi-part
      const streamResponse = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Analyzing... ' },
            },
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'stream_tool',
                name: 'analysis_tool',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"query":"test"}',
              },
            },
            {
              type: 'content_block_stop',
            },
          ];

          return {
            async next() {
              if (chunkIndex < chunks.length) {
                return { value: chunks[chunkIndex++], done: false };
              }
              return { done: true };
            },
          };
        }),
      };

      mockCreate.mockResolvedValueOnce(streamResponse);
      mockMarvToolSet.executeToolCall.mockResolvedValue(
        'Integration test successful',
      );

      const callbacks = {
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      };
      await robot.acceptMessageStreamResponse(mockMessageEnvelope, callbacks);

      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        'Analyzing... ',
      );
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        '\n\n"Integration test successful"',
      );
      expect(mockMarvToolSet.executeToolCall).toHaveBeenCalledWith(
        'analysis_tool',
        { query: 'test' },
      );
    });
  });
});
