# Test Mocks

This directory contains reusable mocks for testing the iStack Buddy Server application.

## Files

### `conversation-messages.ts`

Reusable mock conversation messages and streaming callbacks for testing robot interactions.

**Exports:**

- `mockConversationMessages` - Factory functions for creating different types of conversation messages
  - `customerMessage(content)` - Customer messages
  - `agentMessage(content)` - Agent messages
  - `robotMessage(content)` - Robot messages
  - `formMessage(content)` - Form-related messages for Marv
  - `slackMessage(content)` - Slack-related messages for Slacky
- `mockConversationHistory` - Array of sample conversation history
- `mockStreamingCallbacks` - Mock streaming callback functions
- `resetMockCallbacks()` - Helper to reset all mock callbacks

### `ai-clients.ts`

Reusable mocks for AI client interactions (Anthropic and OpenAI).

**Exports:**

- `mockAnthropicClient` - Mock Anthropic client
- `mockOpenAIClient` - Mock OpenAI client
- `mockStreamingResponses` - Mock streaming response chunks
  - `anthropicChunks` - Anthropic streaming chunks
  - `anthropicToolUseChunks` - Anthropic tool use chunks
  - `openAIChunks` - OpenAI streaming chunks
  - `openAIToolCallChunks` - OpenAI tool call chunks
- `mockSuccessfulResponses` - Mock successful API responses
- `mockErrorResponses` - Mock error responses
- `createAsyncIterator(chunks)` - Helper to create async iterators for streaming
- `resetAIClientMocks()` - Helper to reset all AI client mocks

## Usage

```typescript
import {
  mockConversationMessages,
  mockStreamingCallbacks,
} from '../test-data/mocks/conversation-messages';
import {
  mockAnthropicClient,
  createAsyncIterator,
} from '../test-data/mocks/ai-clients';

// Create a test message
const message = mockConversationMessages.customerMessage(
  'Hello, can you help me?',
);

// Use mock callbacks
const callbacks = { ...mockStreamingCallbacks };

// Mock streaming response
mockAnthropicClient.messages.create.mockResolvedValue(
  createAsyncIterator(mockStreamingResponses.anthropicChunks),
);
```

## Benefits

1. **Reusability** - Common test data and mocks can be shared across test files
2. **Consistency** - Standardized mock structures ensure consistent testing
3. **Maintainability** - Changes to mock structures only need to be made in one place
4. **Reduced Over-mocking** - Focus on testing actual behavior rather than complex mock setup
5. **Better Coverage** - More comprehensive tests with less effort

## Coverage Improvements

These mocks have been used to significantly improve test coverage for:

- **AnthropicMarv.ts**: Improved from 31.06% to 62.13% coverage
- **SlackyOpenAiAgent.ts**: Improved from 15.86% to 23.65% coverage

The mocks enable testing of complex scenarios like:

- Streaming responses with tool calls
- Error handling in various contexts
- Message transformation and history handling
- API client interactions
- Multi-part response patterns
