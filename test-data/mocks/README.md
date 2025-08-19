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

### `slack-events.ts`

Reusable mocks for Slack events and API responses.

**Exports:**

- `mockSlackEvents` - Factory functions for creating Slack events
  - `appMention(text, options)` - App mention events
  - `message(text, options)` - Message events
  - `urlVerification(challenge)` - URL verification challenges
  - `request(event, eventId)` - Request objects
  - `response()` - Response objects
- `mockSlackApiResponses` - Mock Slack API responses
  - `success(data)` - Successful API responses
  - `error(error)` - Error responses
  - `conversationCreated(id)` - Conversation creation responses
- `mockSlackServiceMethods` - Mock service methods
  - `sendSlackMessage` - Mock message sending
  - `addSlackReaction` - Mock reaction adding
  - `getOrCreateConversation` - Mock conversation management
- `resetSlackMocks()` - Helper to reset all Slack mocks

### `logger.ts`

Reusable mocks for the CustomLoggerService.

**Exports:**

- `MockLoggerService` - TypeScript interface for the mock logger
- `createMockLogger()` - Factory function to create new logger mock instances
- `mockLogger` - Pre-configured mock logger instance
- `mockLoggerProvider` - NestJS provider configuration for the logger
- `resetLoggerMocks()` - Helper to reset all logger mocks
- `setupLoggerMockImplementations()` - Setup default implementations
- `expectLoggerCalled(method, message)` - Helper for asserting logger calls
- `expectLoggerCalledWithContext(message, context)` - Helper for context logging assertions
- `mockLoggerResponses` - Mock specific logger behaviors for testing error paths

### `nest-logger.ts`

Reusable mocks for NestJS `Logger`.

**Exports:**

- `MockNestLogger` - TypeScript interface for the mock NestJS logger
- `mockNestLogger` - Pre-configured mock NestJS logger instance
- `mockNestLoggerProvider` - NestJS provider configuration for the logger
- `resetNestLoggerMocks()` - Helper to reset all NestJS logger mocks
- `expectNestLoggerCalled(method, message)` - Helper for asserting NestJS logger calls
- `expectNestLoggerCalledWithContext(message, context)` - Helper for context logging assertions

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
import {
  mockSlackEvents,
  mockSlackApiResponses,
} from '../test-data/mocks/slack-events';
import {
  mockLogger,
  mockLoggerProvider,
  resetLoggerMocks,
  expectLoggerCalled,
} from '../test-data/mocks/logger';
import {
  mockNestLogger,
  mockNestLoggerProvider,
  resetNestLoggerMocks,
  expectNestLoggerCalled,
} from '../test-data/mocks/nest-logger';

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

// Create Slack events
const slackEvent = mockSlackEvents.appMention('Hello @istack-buddy');
const req = mockSlackEvents.request(slackEvent);
const res = mockSlackEvents.response();

// Mock Slack API responses
const conversation = mockSlackApiResponses.conversationCreated('conv-123');

// Use logger mock in NestJS tests
const module = await Test.createTestingModule({
  providers: [
    MyService,
    mockLoggerProvider, // Use centralized logger mock
  ],
}).compile();

// Reset logger mocks in beforeEach
beforeEach(() => {
  resetLoggerMocks();
});

// Assert logger calls
expectLoggerCalled('log', 'Expected log message');
expectLoggerCalled('error', /Error pattern/);

// Use NestJS logger mock
const nestModule = await Test.createTestingModule({
  providers: [
    MyService,
    mockNestLoggerProvider, // Use centralized NestJS logger mock
  ],
}).compile();

// Reset NestJS logger mocks in beforeEach
beforeEach(() => {
  resetNestLoggerMocks();
});

// Assert NestJS logger calls
expectNestLoggerCalled('log', 'Expected log message');
expectNestLoggerCalled('warn', /Warning pattern/);
```

## Benefits

1. **Reusability** - Common test data and mocks can be shared across test files
2. **Consistency** - Standardized mock structures ensure consistent testing
3. **Maintainability** - Changes to mock structures only need to be made in one place
4. **Reduced Over-mocking** - Focus on testing actual behavior rather than complex mock setup
5. **Better Coverage** - More comprehensive tests with less effort
6. **One-Level Mocking** - Avoid deeply nested mocks for more reliable tests

## Coverage Improvements

These mocks have been used to significantly improve test coverage for:

- **AnthropicMarv.ts**: Improved from 31.06% to 62.13% coverage
- **SlackyOpenAiAgent.ts**: Improved from 15.86% to 23.65% coverage
- **IstackBuddySlackApiService.ts**: Comprehensive coverage of Slack event handling, lifecycle management, and short code processing

The mocks enable testing of complex scenarios like:

- Streaming responses with tool calls
- Error handling in various contexts
- Message transformation and history handling
- API client interactions
- Multi-part response patterns
- Slack event processing and lifecycle management
- Short code command handling
- Conversation creation and management
