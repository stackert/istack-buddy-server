# OpenAI Streaming Test

This directory contains test scripts for the OpenAI streaming functionality.

## Files

- `stream-openai-response.ts` - Tests the real OpenAI API streaming (requires valid API key)
- `README.md` - This documentation

## Usage

### API Test (Requires OpenAI API Key)

```bash
# The script automatically loads environment variables from .env.live
npx ts-node docs-living/debug-logging/streaming/stream-openai-response.ts
```

## Implementation Details

The streaming functionality is implemented in `src/robots/RobotChatOpenAI.ts` in the `acceptMessageStreamResponse` method:

```typescript
public async acceptMessageStreamResponse(
  messageEnvelope: TConversationTextMessageEnvelope,
  chunkCallback: (chunk: string) => void,
  getHistory?: () => IConversationMessage[],
): Promise<void> {
  const openAiClient = this.getClient();
  const userMessage = messageEnvelope.envelopePayload.content.payload;

  try {
    // Build conversation history if provided
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (getHistory) {
      const history = getHistory();
      // Convert history to OpenAI format
      for (const msg of history) {
        if (msg.fromRole === UserRole.CUSTOMER) {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.fromRole === UserRole.ROBOT) {
          messages.push({ role: 'assistant', content: msg.content });
        }
      }
    }

    // Add current message
    messages.push({ role: 'user', content: userMessage });

    const stream = await openAiClient.chat.completions.create({
      model: this.LLModelName,
      messages,
      tools,
      stream: true,
    });

    let currentFunctionCall: any = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Handle function calls
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            // Initialize or accumulate function call data
            if (!currentFunctionCall || currentFunctionCall.index !== toolCall.index) {
              currentFunctionCall = {
                index: toolCall.index,
                id: toolCall.id || '',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || '',
                },
              };
            }

            // Accumulate function call data
            if (toolCall.function?.name) {
              currentFunctionCall.function.name = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              currentFunctionCall.function.arguments += toolCall.function.arguments;
            }
          }
        }
      }

      // Handle content (text)
      const content = delta?.content;
      if (content) {
        chunkCallback(content);
      }

      // Handle function call completion
      if (chunk.choices[0]?.finish_reason === 'tool_calls' && currentFunctionCall) {
        try {
          const functionName = currentFunctionCall.function.name;
          const functionArgs = JSON.parse(currentFunctionCall.function.arguments);
          const toolResult = this.makeToolCall(functionName, functionArgs);

          // Stream the function result
          chunkCallback(`\n[Function call: ${functionName}] Result: ${toolResult}\n`);
        } catch (error) {
          chunkCallback(`\n[Error executing function call: ${error.message}]\n`);
        }

        currentFunctionCall = null;
      }
    }
  } catch (error) {
    this.logger.error('Error in streaming response', { error });
    chunkCallback(`Error: ${error.message}`);
  }
}
```

### Tool Support

The robot includes two tools that can be called by the model:

1. **`get_weather`** - Get current temperature for a given location
2. **`describe_form`** - Get detailed information about a specific form by its ID

Function calls are now fully supported in streaming mode, providing a more streamlined experience than polling-based approaches. The streaming implementation:

- Detects function calls in the stream
- Accumulates function call data across chunks
- Executes functions when complete
- Streams function results back to the user
- Handles multiple function calls in a single response

## Test Message

The test demonstrates a two-message conversation:

1. **First message**: "we are testing/debugging. Return a random number and a thought of the day"
2. **Second message**: "Please describe form 12345"

The robot receives the full conversation history and responds contextually, including making function calls when needed. This demonstrates how the system handles multiple messages in a conversation and executes function calls in streaming mode.

### Conversation History Support

The streaming implementation now supports conversation history through the `getHistory` parameter:

```typescript
await robot.acceptMessageStreamResponse(
  messageEnvelope,
  (chunk: string) => {
    process.stdout.write(chunk);
  },
  () => conversationHistory, // Pass conversation history
);
```

This allows the robot to maintain context across multiple messages in a conversation.
