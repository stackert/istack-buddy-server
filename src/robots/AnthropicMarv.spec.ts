import { AnthropicMarv } from './AnthropicMarv';
import { AbstractRobotChat } from './AbstractRobotChat';
import { marvToolDefinitions } from './tool-definitions/marv/marvToolDefinitions';
import { performMarvToolCall } from './tool-definitions/marv/performMarvToolCall';
import type { TConversationTextMessageEnvelope } from './types';
//src/robots/tool-definitions
// Mock the dependencies
//jest.mock('./api/marvToolDefinitions', () => ({
jest.mock('./tool-definitions/marv/marvToolDefinitions', () => ({
  marvToolDefinitions: [
    {
      name: 'formLiteAdd',
      description: 'Create a new form',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
    {
      name: 'fieldLiteAdd',
      description: 'Add a field to a form',
      input_schema: {
        type: 'object',
        properties: {
          formId: { type: 'string' },
          fieldType: { type: 'string' },
        },
        required: ['formId', 'fieldType'],
      },
    },
  ],
}));

jest.mock('./tool-definitions/marv/performMarvToolCall', () => ({
  performMarvToolCall: jest.fn(),
}));

// Mock Anthropic SDK
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
const mockPerformMarvToolCall = performMarvToolCall as jest.MockedFunction<
  typeof performMarvToolCall
>;

describe('AnthropicMarv', () => {
  let marv: AnthropicMarv;
  const originalEnv = process.env;

  const mockMessageEnvelope: TConversationTextMessageEnvelope = {
    messageId: 'test-message-id',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: 'test-payload-id',
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: 'Please create a new form called "Test Form"',
      },
      created_at: '2023-01-01T00:00:00Z',
      estimated_token_count: 10,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    marv = new AnthropicMarv();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Class Properties and Inheritance', () => {
    it('should extend AbstractRobotChat', () => {
      expect(marv).toBeInstanceOf(AbstractRobotChat);
    });

    it('should have correct static properties', () => {
      expect(marv.contextWindowSizeInTokens).toBe(200000);
      expect(marv.LLModelName).toBe('claude-3-5-sonnet-20241022');
      expect(marv.LLModelVersion).toBe('20241022');
      expect(marv.name).toBe('AnthropicMarv');
      expect(marv.version).toBe('1.0.0');
    });

    it('should have correct static descriptions', () => {
      expect(AnthropicMarv.descriptionShort).toContain(
        'Specialized Formstack API robot',
      );
      expect(AnthropicMarv.descriptionLong).toContain(
        'Marv is a specialized robot focused on Formstack form management',
      );
    });

    it('should use formstack tool definitions', () => {
      expect(marvToolDefinitions).toBeDefined();
      expect(Array.isArray(marvToolDefinitions)).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(marv.estimateTokens('test')).toBe(1);
      expect(marv.estimateTokens('hello world')).toBe(3);
      expect(marv.estimateTokens('')).toBe(0);
      expect(marv.estimateTokens('a'.repeat(16))).toBe(4);
    });

    it('should round up partial tokens', () => {
      expect(marv.estimateTokens('hello')).toBe(2);
    });
  });

  describe('getClient - API Key Validation', () => {
    it('should create Anthropic client with API key', () => {
      const AnthropicConstructor = require('@anthropic-ai/sdk').default;
      const client = (marv as any).getClient();
      expect(AnthropicConstructor).toHaveBeenCalledWith({
        apiKey:
          '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',
      });
      expect(client).toBeDefined();
    });
  });

  describe('Private Methods', () => {
    it('should create proper Anthropic message request', () => {
      const request = (marv as any).createAnthropicMessageRequest(
        mockMessageEnvelope,
      );

      expect(request).toEqual({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: expect.stringContaining('You are Marv'),
        messages: [
          {
            role: 'user',
            content: 'Please create a new form called "Test Form"',
          },
        ],
        tools: expect.any(Array),
      });
    });

    it('should include system prompt about Formstack operations', () => {
      const request = (marv as any).createAnthropicMessageRequest(
        mockMessageEnvelope,
      );

      expect(request.system).toContain('Formstack form management');
      expect(request.system).toContain('formLiteAdd');
      expect(request.system).toContain('fieldLiteAdd');
      expect(request.system).toContain('fieldLogicStashCreate');
      expect(request.system).toContain('Marv-enabled forms');
    });
  });

  describe('Tool Execution - Formstack API Integration', () => {
    it('should execute successful Formstack API call', async () => {
      const mockApiResponse = {
        isSuccess: true,
        response: {
          id: '12345',
          name: 'Test Form',
          url: 'https://formstack.com/forms/12345',
        },
        errorItems: null,
      };

      mockPerformMarvToolCall.mockResolvedValue(mockApiResponse);

      const result = await (marv as any).executeToolCall('formLiteAdd', {
        name: 'Test Form',
      });

      expect(mockPerformMarvToolCall).toHaveBeenCalledWith('formLiteAdd', {
        name: 'Test Form',
      });
      expect(result).toContain('✅ formLiteAdd completed successfully');
      expect(result).toContain('"id": "12345"');
      expect(result).toContain('"name": "Test Form"');
    });

    it('should handle failed Formstack API call with error items', async () => {
      const mockApiResponse = {
        isSuccess: false,
        response: null,
        errorItems: ['Invalid form name', 'Missing required field'],
      };

      mockPerformMarvToolCall.mockResolvedValue(mockApiResponse);

      const result = await (marv as any).executeToolCall('formLiteAdd', {
        name: '',
      });

      expect(result).toContain('❌ formLiteAdd failed');
      expect(result).toContain('Invalid form name, Missing required field');
    });

    it('should handle failed API call without error items', async () => {
      const mockApiResponse = {
        isSuccess: false,
        response: null,
        errorItems: null,
      };

      mockPerformMarvToolCall.mockResolvedValue(mockApiResponse);

      const result = await (marv as any).executeToolCall('fieldRemove', {
        fieldId: 'invalid',
      });

      expect(result).toContain('❌ fieldRemove failed');
      expect(result).toContain('Unknown error');
    });

    it('should handle API call throwing an error', async () => {
      mockPerformMarvToolCall.mockRejectedValue(
        new Error('Network connection failed'),
      );

      const result = await (marv as any).executeToolCall('fieldLiteAdd', {
        formId: '12345',
        fieldType: 'text',
      });

      expect(result).toContain('❌ Error executing fieldLiteAdd');
      expect(result).toContain('Network connection failed');
    });

    it('should handle API call throwing non-Error object', async () => {
      mockPerformMarvToolCall.mockRejectedValue('String error');

      const result = await (marv as any).executeToolCall(
        'fieldLogicStashCreate',
        {
          formId: '12345',
        },
      );

      expect(result).toContain('❌ Error executing fieldLogicStashCreate');
      expect(result).toContain('Unknown error');
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
              delta: { type: 'text_delta', text: 'I can help you ' },
            },
            {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'create that form.' },
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
      const chunkCallback = jest.fn();

      await marv.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(chunkCallback).toHaveBeenCalledWith('I can help you ');
      expect(chunkCallback).toHaveBeenCalledWith('create that form.');
    });

    it('should handle tool use in streaming with successful API call', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_use_123',
                name: 'formLiteAdd',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"name":',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '"Test Form"}',
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
      mockPerformMarvToolCall.mockResolvedValue({
        isSuccess: true,
        response: { id: '67890', name: 'Test Form' },
        errorItems: null,
      });

      const chunkCallback = jest.fn();
      await marv.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(mockPerformMarvToolCall).toHaveBeenCalledWith('formLiteAdd', {
        name: 'Test Form',
      });
      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('✅ formLiteAdd completed successfully'),
      );
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
                name: 'fieldLiteAdd',
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

      const chunkCallback = jest.fn();
      await marv.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(chunkCallback).toHaveBeenCalledWith(
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
                name: 'fieldRemove',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"fieldId":"invalid"}',
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
      mockPerformMarvToolCall.mockRejectedValue(new Error('Field not found'));

      const chunkCallback = jest.fn();
      await marv.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error executing fieldRemove'),
      );
    });

    it('should handle mixed content and tool use in streaming', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_delta',
              delta: {
                type: 'text_delta',
                text: 'Let me create that form for you. ',
              },
            },
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'tool_use_123',
                name: 'formLiteAdd',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"name":"New Form"}',
              },
            },
            {
              type: 'content_block_stop',
            },
            {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Form created successfully!' },
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
      mockPerformMarvToolCall.mockResolvedValue({
        isSuccess: true,
        response: { id: '54321', name: 'New Form' },
        errorItems: null,
      });

      const chunkCallback = jest.fn();
      await marv.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(chunkCallback).toHaveBeenCalledWith(
        'Let me create that form for you. ',
      );
      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('✅ formLiteAdd completed successfully'),
      );
      expect(chunkCallback).toHaveBeenCalledWith('Form created successfully!');
    });

    it('should handle streaming API error', async () => {
      mockCreate.mockRejectedValue(new Error('Streaming API Error'));

      const chunkCallback = jest.fn();

      await expect(
        marv.acceptMessageStreamResponse(mockMessageEnvelope, chunkCallback),
      ).rejects.toThrow('Streaming API Error');

      expect(chunkCallback).toHaveBeenCalledWith('Error: Streaming API Error');
    });

    it('should handle streaming API error with non-Error object', async () => {
      mockCreate.mockRejectedValue('String streaming error');

      const chunkCallback = jest.fn();

      try {
        await marv.acceptMessageStreamResponse(
          mockMessageEnvelope,
          chunkCallback,
        );
      } catch (error) {
        expect(error).toBe('String streaming error');
      }

      expect(chunkCallback).toHaveBeenCalledWith(
        'Error: Unknown error occurred',
      );
    });
  });

  describe('Immediate Response - Complete Tool Coverage', () => {
    it('should handle response with successful tool use', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: "I'll create that form for you. ",
          },
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'formLiteAdd',
            input: { name: 'Test Form' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockPerformMarvToolCall.mockResolvedValue({
        isSuccess: true,
        response: {
          id: '98765',
          name: 'Test Form',
          url: 'https://example.com',
        },
        errorItems: null,
      });

      const result =
        await marv.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        "I'll create that form for you.",
      );
      expect(result.envelopePayload.content.payload).toContain(
        '✅ formLiteAdd completed successfully',
      );
      expect(result.envelopePayload.content.payload).toContain('"id": "98765"');
    });

    it('should handle tool execution failure in immediate response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'fieldLiteAdd',
            input: { formId: 'invalid', fieldType: 'text' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockPerformMarvToolCall.mockResolvedValue({
        isSuccess: false,
        response: null,
        errorItems: ['Form not found', 'Invalid field type'],
      });

      const result =
        await marv.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        '❌ fieldLiteAdd failed',
      );
      expect(result.envelopePayload.content.payload).toContain(
        'Form not found, Invalid field type',
      );
    });

    it('should handle tool execution throwing error in immediate response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_use_123',
            name: 'fieldLogicStashApply',
            input: { formId: '12345' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockPerformMarvToolCall.mockRejectedValue(
        new Error('Logic stash not found'),
      );

      const result =
        await marv.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        '❌ Error executing fieldLogicStashApply: Logic stash not found',
      );
    });

    it('should handle multiple tool uses in immediate response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Creating form and adding field... ',
          },
          {
            type: 'tool_use',
            id: 'tool_use_1',
            name: 'formLiteAdd',
            input: { name: 'Multi Tool Form' },
          },
          {
            type: 'tool_use',
            id: 'tool_use_2',
            name: 'fieldLiteAdd',
            input: { formId: '12345', fieldType: 'email' },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);
      mockPerformMarvToolCall
        .mockResolvedValueOnce({
          isSuccess: true,
          response: { id: '12345', name: 'Multi Tool Form' },
          errorItems: null,
        })
        .mockResolvedValueOnce({
          isSuccess: true,
          response: { id: '67890', type: 'email', label: 'Email Address' },
          errorItems: null,
        });

      const result =
        await marv.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Creating form and adding field...',
      );
      expect(result.envelopePayload.content.payload).toContain(
        '✅ formLiteAdd completed successfully',
      );
      expect(result.envelopePayload.content.payload).toContain(
        '✅ fieldLiteAdd completed successfully',
      );
      expect(mockPerformMarvToolCall).toHaveBeenCalledTimes(2);
    });

    it('should generate proper response structure', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'This is a helpful response about Formstack operations.',
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result =
        await marv.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.requestOrResponse).toBe('response');
      expect(result.envelopePayload.author_role).toBe('assistant');
      expect(result.envelopePayload.content.type).toBe('text/plain');
      expect(result.envelopePayload.content.payload).toBe(
        'This is a helpful response about Formstack operations.',
      );
      expect(result.envelopePayload.estimated_token_count).toBeGreaterThan(0);
      expect(result.messageId).toMatch(/^response-\d+$/);
      expect(result.envelopePayload.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should handle empty response content', async () => {
      const mockResponse = { content: [] };
      mockCreate.mockResolvedValue(mockResponse);

      const result =
        await marv.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toBe('');
      expect(result.envelopePayload.estimated_token_count).toBe(0);
    });

    it('should handle API errors gracefully in immediate response', async () => {
      mockCreate.mockRejectedValue(new Error('API connection failed'));

      const result =
        await marv.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.requestOrResponse).toBe('response');
      expect(result.envelopePayload.author_role).toBe('assistant');
      expect(result.envelopePayload.content.payload).toContain(
        'I apologize, but I encountered an error: API connection failed',
      );
    });

    it('should handle unknown errors in immediate response', async () => {
      mockCreate.mockRejectedValue('String error');

      const result =
        await marv.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toContain(
        'Unknown error occurred',
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
        content: [{ type: 'text', text: 'Form operation completed' }],
      };

      const followUpResponse = {
        content: [{ type: 'text', text: 'What else can I help you with?' }],
      };

      mockCreate
        .mockResolvedValueOnce(immediateResponse)
        .mockResolvedValueOnce(followUpResponse);

      const delayedCallback = jest.fn();

      const result = await marv.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      expect(result.envelopePayload.content.payload).toBe(
        'Form operation completed',
      );

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestOrResponse: 'response',
          messageId: expect.stringMatching(/^delayed-\d+$/),
          envelopePayload: expect.objectContaining({
            author_role: 'assistant',
            content: expect.objectContaining({
              payload: 'What else can I help you with?',
            }),
          }),
        }),
      );
    });

    it('should create proper follow-up request with Formstack context', async () => {
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

      await marv.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(mockCreate).toHaveBeenCalledTimes(2);
      const followUpCall = mockCreate.mock.calls[1][0];
      expect(followUpCall.messages[0].content).toContain('Follow up on:');
      expect(followUpCall.messages[0].content).toContain(
        'Please create a new form called "Test Form"',
      );
      expect(followUpCall.messages[0].content).toContain(
        'Formstack form management',
      );
      expect(followUpCall.messages[0].content).toContain(
        'form creation, field management, logic operations',
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

      await marv.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        delayedCallback,
      );

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(delayedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.stringMatching(/^delayed-error-\d+$/),
          envelopePayload: expect.objectContaining({
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

      await marv.acceptMessageMultiPartResponse(
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
  });

  describe('Integration Tests', () => {
    it('should validate complete Formstack workflow', () => {
      expect(marv.name).toBe('AnthropicMarv');
      expect(marv.version).toBe('1.0.0');
      expect(marv.contextWindowSizeInTokens).toBe(200000);
      expect(marv.LLModelName).toBe('claude-3-5-sonnet-20241022');

      const testMessage = 'Create a form with email field';
      const estimatedTokens = marv.estimateTokens(testMessage);
      expect(estimatedTokens).toBeGreaterThan(0);

      const request = (marv as any).createAnthropicMessageRequest(
        mockMessageEnvelope,
      );
      expect(request.system).toContain('You are Marv');
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
      expect(request.tools).toBe(marvToolDefinitions);
    });

    it('should handle complex Formstack operation scenario', async () => {
      const streamResponse = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let chunkIndex = 0;
          const chunks = [
            {
              type: 'content_block_delta',
              delta: {
                type: 'text_delta',
                text: 'Creating form with logic... ',
              },
            },
            {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                id: 'stream_tool',
                name: 'formLiteAdd',
              },
            },
            {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: '{"name":"Complex Form"}',
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
      mockPerformMarvToolCall.mockResolvedValue({
        isSuccess: true,
        response: {
          id: '11111',
          name: 'Complex Form',
          fields: [],
          logic: [],
        },
        errorItems: null,
      });

      const chunkCallback = jest.fn();
      await marv.acceptMessageStreamResponse(
        mockMessageEnvelope,
        chunkCallback,
      );

      expect(chunkCallback).toHaveBeenCalledWith(
        'Creating form with logic... ',
      );
      expect(chunkCallback).toHaveBeenCalledWith(
        expect.stringContaining('✅ formLiteAdd completed successfully'),
      );
      expect(mockPerformMarvToolCall).toHaveBeenCalledWith('formLiteAdd', {
        name: 'Complex Form',
      });
    });
  });
});
