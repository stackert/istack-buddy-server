import { OpenAI } from 'openai';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import {
  IConversationMessage,
  IConversationMessageOpenAI,
} from '../chat-manager/interfaces/message.interface';
import { AbstractRobotChat } from './AbstractRobotChat';
import { marvToolSet } from './tool-definitions/marv';
import type {
  TConversationTextMessageEnvelope,
  TRobotResponseEnvelope,
  IStreamingCallbacks,
} from './types';

// Type for tracking function calls during streaming
type StreamingFunctionCall = {
  index: number;
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
} | null;

const noOp = (...args: any[]) => {};
const log = (...args: any[]) => {
  console.log(...args);
};

// Factory for creating message envelope with updated content

// Factory for creating message envelope with updated content
const createMessageEnvelopeWithContent = (
  originalEnvelope: TConversationTextMessageEnvelope,
  newContent: string,
): TConversationTextMessageEnvelope => ({
  ...originalEnvelope,
  envelopePayload: {
    ...originalEnvelope.envelopePayload,
    content: {
      ...originalEnvelope.envelopePayload.content,
      payload: newContent,
    },
  },
});

const fakeLogger = {
  debug: noOp,
  log: noOp,
  error: noOp,
  warn: noOp,
  verbose: noOp,
};

// OpenAI API key will be read from environment at runtime
// Convert Marv tools to OpenAI format
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
  marvToolSet.toolDefinitions.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));

class RobotChatOpenAI extends AbstractRobotChat {
  // logger = new CustomLoggerService('RobotChatOpenAI');
  logger = fakeLogger;

  constructor() {
    super();
  }

  public readonly version: string = '1.0.0-test-dev';

  public readonly LLModelName: string = 'o4-mini';
  public readonly LLModelVersion: string = 'o4-mini-2025-04-16';

  public readonly contextWindowSizeInTokens: number = 128000; // GPT-4 context window

  public estimateTokens(message: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(message.length / 4);
  }

  get name(): string {
    return this.constructor.name;
  }

  /**
   * Accepts a message and streams the response in real-time.
   *
   * @TMC_ We may want to allow options parameter ({disableStreaming: true}) to control streaming behavior
   */
  public async acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage[],
  ): Promise<void> {
    const userMessage = messageEnvelope.envelopePayload.content.payload;
    let accumulatedContent = '';

    try {
      const openAiClient = this.getClient();
      // Call onStreamStart with initial message
      if (callbacks.onStreamStart) {
        callbacks.onStreamStart(messageEnvelope);
      }

      // Build conversation history if provided
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        // _TMC_ Why is this necessary?
        // This should come from the class definition.
        // see: src/robots/SlackyAnthropicAgent.ts as example
        {
          role: 'system',
          content:
            'You are a helpful assistant with access to tools. When asked about forms, use the tools to get information. Always use tools when they would be helpful.',
        },
      ];

      if (getHistory) {
        const history = getHistory();
        this.logger.debug('Building conversation history', {
          historyLength: history.length,
        });

        // Convert history to OpenAI format
        for (const msg of history) {
          // Check if this is already in the new format (has role property)
          if ('role' in msg && typeof msg.role === 'string') {
            // Already in new format
            messages.push({
              role: msg.role as 'user' | 'assistant',
              content: (msg.content as any).payload || msg.content,
            });
          } else {
            // Convert from old format
            if (msg.fromRole === UserRole.CUSTOMER) {
              messages.push({
                role: 'user',
                content: (msg.content as any).payload || msg.content,
              });
            } else if (msg.fromRole === UserRole.ROBOT) {
              messages.push({
                role: 'assistant',
                content: (msg.content as any).payload || msg.content,
              });
            }
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

      let currentFunctionCall: StreamingFunctionCall | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle function calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            // Initialize function call
            if (
              !currentFunctionCall ||
              currentFunctionCall.index !== toolCall.index
            ) {
              currentFunctionCall = {
                index: toolCall.index,
                id: toolCall.id || '',
                type: toolCall.type || 'function',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || '',
                },
              };
            }

            // Accumulate function call data
            if (currentFunctionCall && toolCall.function?.name) {
              currentFunctionCall.function.name = toolCall.function.name;
            }
            if (currentFunctionCall && toolCall.function?.arguments) {
              currentFunctionCall.function.arguments +=
                toolCall.function.arguments;
            }
          }
        }

        // Handle content (text)
        const content = delta?.content;
        if (content) {
          accumulatedContent += content;
          callbacks.onStreamChunkReceived(content);
        }

        // Handle function call completion
        if (
          chunk.choices[0]?.finish_reason === 'tool_calls' &&
          currentFunctionCall
        ) {
          try {
            // Execute the function call
            const functionName = currentFunctionCall.function.name;
            const functionArgs = JSON.parse(
              currentFunctionCall.function.arguments,
            );

            this.logger.debug('Executing function call', {
              functionName,
              functionArgs,
            });

            const toolResult = await this.makeToolCall(
              functionName,
              functionArgs,
            );

            // Stream the function result in chunks
            const functionResult = `\n[Function call: ${functionName}] Result: ${toolResult}\n`;
            accumulatedContent += functionResult;
            const chunkSize = 50; // Break into smaller chunks
            for (let i = 0; i < functionResult.length; i += chunkSize) {
              // _TMC_ Why is this necessary?
              // Why are we 'simulating' streaming
              // I don't know there is a limit on chunk size?
              // If there is good reason to intentionally chunk the response
              // then keep it as is.  Otherwise send a larch chunk.
              const chunk = functionResult.slice(i, i + chunkSize);
              callbacks.onStreamChunkReceived(chunk);
              // Small delay to simulate streaming
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          } catch (error) {
            this.logger.error('Error executing function call', {
              error,
              currentFunctionCall,
            });
            const errorMessage = `\n[Error executing function call: ${error.message}]\n`;
            accumulatedContent += errorMessage;
            callbacks.onStreamChunkReceived(errorMessage);
          }

          // Reset for next function call
          currentFunctionCall = null;
        }
      }
    } catch (error) {
      this.logger.error('Error in streaming response', { error });
      const errorMessage = `Error: ${error.message}`;
      accumulatedContent += errorMessage;
      callbacks.onStreamChunkReceived(errorMessage);
    } finally {
      // Call onStreamFinished with minimal data
      if (typeof callbacks.onStreamFinished === 'function') {
        callbacks.onStreamFinished(accumulatedContent, 'assistant');
      }
    }
  }

  public async acceptMessageImmediateResponse(
    inboundMessage: TConversationTextMessageEnvelope,
  ): Promise<TRobotResponseEnvelope> {
    // Convert the inbound message to a robot response format without messageId
    return {
      requestOrResponse: 'response',
      envelopePayload: {
        author_role: 'assistant',
        content: {
          type: 'text/plain',
          payload: 'This is a placeholder response from RobotChatOpenAI',
        },
        created_at: new Date().toISOString(),
        estimated_token_count: 0,
      },
    };
  }

  /**
   * @TMC_ New implementation using acceptMessageStreamResponse
   * Calls acceptMessageStreamResponse and sends immediate response, then promises to send second message when streaming completes
   */
  public async acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (
      response: TConversationTextMessageEnvelope,
    ) => void,
  ): Promise<TConversationTextMessageEnvelope> {
    // Send immediate response first
    const immediateResponse =
      await this.acceptMessageImmediateResponse(messageEnvelope);

    // Start streaming in background and promise to send delayed message when complete
    this.acceptMessageStreamResponse(messageEnvelope, {
      onStreamChunkReceived: (chunk: string) => {
        // Handle chunks if needed
      },
      onStreamStart: (message) => {
        // Handle stream start if needed
      },
      onStreamFinished: (content: string, authorRole: string) => {
        // Create a minimal message envelope for the callback
        const finishedMessage: TConversationTextMessageEnvelope = {
          messageId: '', // Will be set by conversation manager
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: '', // Will be set by conversation manager
            author_role: authorRole as any,
            content: {
              type: 'text/plain',
              payload: content,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: this.estimateTokens(content),
          },
        };
        // Send the complete response as delayed message
        if (
          delayedMessageCallback &&
          typeof delayedMessageCallback === 'function'
        ) {
          delayedMessageCallback(finishedMessage);
        }
      },
      onFullMessageReceived: (content: string) => {
        // Handle full message if needed
      },
      onError: (error) => {
        // Handle error in delayed message
        const errorMessage = createMessageEnvelopeWithContent(
          messageEnvelope,
          `Error in streaming response: ${error.message}`,
        );
        if (
          delayedMessageCallback &&
          typeof delayedMessageCallback === 'function'
        ) {
          delayedMessageCallback(errorMessage);
        }
      },
    }).catch((error) => {
      // Handle any errors in the streaming process
      const errorMessage = createMessageEnvelopeWithContent(
        messageEnvelope,
        `Error in streaming response: ${error.message}`,
      );
      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        delayedMessageCallback(errorMessage);
      }
    });

    // Convert TRobotResponseEnvelope to TConversationTextMessageEnvelope for return
    const immediateResponseWithIds: TConversationTextMessageEnvelope = {
      messageId: '', // Will be set by conversation manager
      requestOrResponse: immediateResponse.requestOrResponse,
      envelopePayload: {
        messageId: '', // Will be set by conversation manager
        author_role: immediateResponse.envelopePayload.author_role,
        content: immediateResponse.envelopePayload.content,
        created_at: immediateResponse.envelopePayload.created_at,
        estimated_token_count:
          immediateResponse.envelopePayload.estimated_token_count,
      },
    };

    return immediateResponseWithIds;
  }

  private async makeToolCall(toolName: string, toolArgs: any): Promise<string> {
    this.logger.debug(`Executing tool: ${toolName}`, { toolArgs });
    try {
      const result = marvToolSet.executeToolCall(toolName, toolArgs);
      const finalResult = typeof result === 'string' ? result : await result;
      this.logger.debug(`Tool ${toolName} executed successfully`, {
        resultType: typeof finalResult,
      });
      const jsonResult = JSON.stringify(finalResult, null, 2);
      this.logger.debug(`Complete tool result`, { result: jsonResult });
      return jsonResult;
    } catch (error) {
      this.logger.error(`Tool ${toolName} execution failed`, error);
      return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private getClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === '_OPEN_AI_KEY_') {
      throw new Error(
        `OPENAI_API_KEY environment variable is required but not set. Please set the OPENAI_API_KEY environment variable with your OpenAI API key.`,
      );
    }

    return new OpenAI({
      apiKey: apiKey,
    });
  }
}

export { RobotChatOpenAI };
