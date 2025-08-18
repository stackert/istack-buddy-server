/**
 * Reusable mocks for AI clients (Anthropic and OpenAI)
 */

// Mock Anthropic client
export const mockAnthropicClient = {
  messages: {
    create: jest.fn(),
  },
};

// Mock OpenAI client
export const mockOpenAIClient = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

// Mock streaming responses
export const mockStreamingResponses = {
  // Anthropic streaming chunks
  anthropicChunks: [
    {
      type: 'content_block_start',
      content_block: {
        type: 'text',
        text: '',
      },
    },
    {
      type: 'content_block_delta',
      delta: {
        type: 'text_delta',
        text: 'Hello, I can help you with that.',
      },
    },
    {
      type: 'content_block_stop',
      content_block: {
        type: 'text',
        text: 'Hello, I can help you with that.',
      },
    },
  ],

  // Anthropic tool use chunks
  anthropicToolUseChunks: [
    {
      type: 'content_block_start',
      content_block: {
        type: 'tool_use',
        id: 'tool_1',
        name: 'formAndRelatedEntityOverview',
        input: '',
      },
    },
    {
      type: 'content_block_delta',
      delta: {
        type: 'input_json_delta',
        partial_json: '{"formId": "123456"}',
      },
    },
    {
      type: 'content_block_stop',
      content_block: {
        type: 'tool_use',
        id: 'tool_1',
        name: 'formAndRelatedEntityOverview',
        input: '{"formId": "123456"}',
      },
    },
  ],

  // OpenAI streaming chunks
  openAIChunks: [
    {
      choices: [
        {
          delta: {
            content: 'Hello, I can help you with that.',
          },
          finish_reason: 'stop',
        },
      ],
    },
  ],

  // OpenAI tool call chunks
  openAIToolCallChunks: [
    {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'formAndRelatedEntityOverview',
                  arguments: '{"formId": "123456"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    },
  ],
};

// Mock successful responses
export const mockSuccessfulResponses = {
  anthropic: {
    content: [
      {
        type: 'text',
        text: 'Hello, I can help you with that.',
      },
    ],
    usage: {
      input_tokens: 10,
      output_tokens: 20,
    },
  },

  openai: {
    choices: [
      {
        message: {
          content: 'Hello, I can help you with that.',
          role: 'assistant',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  },
};

// Mock error responses
export const mockErrorResponses = {
  anthropic: new Error('Anthropic API error: Rate limit exceeded'),
  openai: new Error('OpenAI API error: Invalid API key'),
};

// Helper to create async iterators for streaming
export const createAsyncIterator = (chunks: any[]) => {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
};

// Reset all mocks
export const resetAIClientMocks = () => {
  mockAnthropicClient.messages.create.mockClear();
  mockOpenAIClient.chat.completions.create.mockClear();
};
