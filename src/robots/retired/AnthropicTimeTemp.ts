import { AbstractRobotChat } from './AbstractRobotChat';
import type {
  IStreamingCallbacks,
  TConversationMessageContentString,
} from './types';
import {
  IConversationMessage,
  IConversationMessageAnthropic,
} from '../chat-manager/interfaces/message.interface';
import type { TConversationMessageContent } from '../ConversationLists/types';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import Anthropic from '@anthropic-ai/sdk';
import { timeTempToolSet } from './tool-definitions/timetemp';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

// Helper functions for the streaming pattern
const noOp = (...args: any[]) => {};

/**
 * Anthropic TimeTemp - Dev/Debug Robot for Function Call Demonstrations
 * Focused on demonstrating serial and parallel function/tool calls
 */
export class AnthropicTimeTemp extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService();

  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 200000;

  // public readonly LLModelName: string = 'claude-3-5-sonnet-20241022';
  // public readonly LLModelVersion: string = '20241022';

  public readonly LLModelName: string = 'claude-opus-4-1-20250805';
  public readonly LLModelVersion: string = '20250805';

  public readonly name: string = 'AnthropicTimeTemp';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort =
    'Dev/debug robot to demonstrate serial and parallel function/tool calls with time and temperature data';
  static descriptionLong =
    'TimeTemp is a specialized robot focused on demonstrating different patterns of function/tool calls. It provides time and temperature data for cities through dummy functions that return random but realistic data. The robot can demonstrate single function calls, serial function calls (where function 2 input requires function 1 output), parallel function calls (independent functions), and zero function calls.';

  // Robot role/system prompt
  private readonly robotRole = `
You are TimeTemp, a robot that demonstrates function call patterns. You MUST call ALL functions mentioned in a request before stopping.

**Tools:**
- getTime(city: string): Get time for a city
- getTemp(city: string): Get temperature for a city

**When to call parallel:**
- When user asks for "time AND temperature" (uses "and")
- When user asks for multiple independent pieces of information
- Example: "What's the time in London and temperature in Paris?"

**When to call serial:**
- When user asks for "time, THEN temperature" (uses "then")
- When user asks for sequential operations
- Example: "Get the time in Tokyo, then get the temperature in Tokyo"
- IMPORTANT: For serial calls, you MUST call BOTH functions in sequence
- Step 1: Call the first function
- Step 2: Call the second function
- NEVER stop after Step 1

**Rules:**
- Call parallel: Use both functions at once
- Call serial: Call first function, then second function
- Always complete all requested function calls
- Never stop halfway through
- If user asks for "time, then temperature" - you MUST call BOTH getTime AND getTemp
- If user asks for "time and temperature" - you MUST call BOTH getTime AND getTemp
- ALWAYS call ALL functions mentioned in the request
- IMPORTANT: After calling the first function, you MUST continue and call the second function
- Do not stop after the first function call - always complete the sequence
- CRITICAL: When you see multiple functions requested, call ALL of them before stopping
`;

  // Tool definitions for Anthropic API
  private readonly tools: Anthropic.Messages.Tool[] =
    timeTempToolSet.toolDefinitions;

  /**
   * Simple token estimation - roughly 4 characters per token for Claude
   */
  public estimateTokens(message: string): number {
    return Math.ceil(message.length / 4);
  }

  /**
   * Get Anthropic client with API key from environment
   */
  private getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is required but not set. ' +
          'Please set it to your Anthropic API key.',
      );
    }

    return new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Convert our message to Anthropic format
   */
  private createAnthropicMessageRequest(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Anthropic.Messages.MessageCreateParams {
    const userMessage = message.content.payload;

    // Build conversation history if provided
    const messages: Anthropic.Messages.MessageParam[] = [];

    if (getHistory) {
      const history = getHistory();
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
          messages.push({
            role:
              msg.fromRole === UserRole.CUSTOMER ||
              msg.fromRole === UserRole.AGENT
                ? 'user'
                : 'assistant',
            content: (msg.content as any).payload || msg.content,
          });
        }
      }
    }

    // Add the current message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    return {
      model: this.LLModelName,
      max_tokens: 2048,
      system: this.robotRole,
      messages: messages,
      tools: this.tools,
    };
  }

  /**
   * Execute tool calls for time and temperature operations
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
    onFullMessageReceived?: (content: string, contentType?: string) => void,
  ): Promise<string> {
    try {
      // Execute the tool call
      const response = await timeTempToolSet.executeToolCall(
        toolName,
        toolArgs,
      );

      // Return the response directly
      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return `Error executing ${toolName}: ${errorMessage}`;
    }
  }

  /**
   * Handle streaming response using Anthropic's messages API with multi-turn tool support
   */
  public async acceptMessageStreamResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<void> {
    try {
      const client = this.getClient();
      const request = this.createAnthropicMessageRequest(message, getHistory);

      // Call onStreamStart if provided
      if (callbacks.onStreamStart) {
        callbacks.onStreamStart(message);
      }

      // Start the conversation
      let response = await client.messages.create({
        ...request,
        stream: false,
      });

      let toolResults: any[] = [];

      // Continue the conversation until no more tool calls are needed
      while (response.stop_reason === 'tool_use') {
        // Extract and stream text content
        for (const content of response.content) {
          if (content.type === 'text') {
            callbacks.onStreamChunkReceived(content.text);
          }
        }

        // Process tool calls and collect results
        const newToolResults: any[] = [];
        for (const content of response.content) {
          if (content.type === 'tool_use') {
            try {
              const toolResult = await this.executeToolCall(
                content.name,
                content.input,
              );
              newToolResults.push({
                tool_use_id: content.id,
                content: toolResult,
              });
            } catch (error) {
              const errorMsg = `Error executing tool ${content.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              newToolResults.push({
                tool_use_id: content.id,
                content: errorMsg,
              });
            }
          }
        }

        // Add tool results to the conversation
        toolResults.push(...newToolResults);

        // Continue the conversation with tool results
        const messages = [
          ...request.messages,
          {
            role: 'assistant' as const,
            content: response.content,
          },
          {
            role: 'user' as const,
            content: newToolResults.map((result) => ({
              type: 'tool_result' as const,
              tool_use_id: result.tool_use_id,
              content: result.content,
            })),
          },
        ];

        response = await client.messages.create({
          model: this.LLModelName,
          max_tokens: 2048,
          system: this.robotRole,
          messages: messages,
          tools: this.tools,
          stream: false,
        });
      }

      // Add final text content
      for (const content of response.content) {
        if (content.type === 'text') {
          callbacks.onStreamChunkReceived(content.text);
        }
      }

      // Call onStreamFinished
      if (typeof callbacks.onStreamFinished === 'function') {
        callbacks.onStreamFinished(message);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Call onError if provided
      if (callbacks.onError) {
        callbacks.onError(error);
      } else {
        // Fallback to onStreamChunkReceived for error
        callbacks.onStreamChunkReceived(
          `Error in streaming response: ${errorMessage}`,
        );
      }
    }
  }

  /**
   * Handle immediate response using the streaming pattern
   */
  public async acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  > {
    try {
      // Use the streaming pattern to get the complete response
      let finalContent: TConversationMessageContentString | null = null;
      let accumulatedContent = '';

      await this.acceptMessageStreamResponse(
        message,
        {
          onStreamChunkReceived: (chunk: string) => {
            accumulatedContent += chunk;
          },
          onStreamStart: (message) => {
            // Handle stream start if needed
          },
          onStreamFinished: (message) => {
            // Create the final response
            finalContent = {
              type: 'text/plain',
              payload: accumulatedContent,
            };
          },
          onFullMessageReceived: (message) => {
            // Handle full message if needed
          },
          onError: (error) => {
            throw error;
          },
        },
        getHistory,
      );

      if (!finalContent) {
        // Fallback to accumulated content if streaming didn't work
        finalContent = {
          type: 'text/plain',
          payload: accumulatedContent || 'No response generated',
        };
      }

      return { content: finalContent };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        content: {
          type: 'text/plain',
          payload: `Error: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Multi-part response using direct streaming wrapper
   * Sends immediate response, then streams additional content through callback
   */
  public async acceptMessageMultiPartResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    delayedMessageCallback: (
      response: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      >,
    ) => void,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<TConversationMessageContentString> {
    let accumulatedContent = '';
    let hasSentImmediate = false;

    // Start streaming directly
    await this.acceptMessageStreamResponse(
      message,
      {
        onStreamChunkReceived: (chunk: string) => {
          accumulatedContent += chunk;

          // Send immediate response on first chunk if not sent yet
          if (!hasSentImmediate) {
            hasSentImmediate = true;
            // Could trigger immediate response here if needed
          }
        },
        onStreamStart: (message) => {
          // Handle stream start if needed
        },
        onStreamFinished: (message) => {
          // Send the complete response as delayed message
          if (
            delayedMessageCallback &&
            typeof delayedMessageCallback === 'function'
          ) {
            delayedMessageCallback({
              content: {
                type: 'text/plain',
                payload: accumulatedContent,
              },
            });
          }
        },
        onFullMessageReceived: (message) => {
          // Handle full message if needed
        },
        onError: (error) => {
          // Handle error if needed
          if (delayedMessageCallback) {
            delayedMessageCallback({
              content: {
                type: 'text/plain',
                payload: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            });
          }
        },
      },
      getHistory,
    );

    // Return initial response (could be empty or first chunk)
    return {
      type: 'text/plain',
      payload: accumulatedContent || 'Processing...',
    };
  }
}
