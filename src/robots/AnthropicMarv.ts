import { AbstractRobotChat } from './AbstractRobotChat';
import type {
  TConversationTextMessageEnvelope,
  IStreamingCallbacks,
} from './types';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import Anthropic from '@anthropic-ai/sdk';
import { marvToolSet } from './tool-definitions/marv';

// Helper functions for the streaming pattern
const noOp = (...args: any[]) => {};

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

/**
 * Anthropic Marv - Specialized Formstack API Robot
 * Focused on Formstack form management and field operations
 */
export class AnthropicMarv extends AbstractRobotChat {
  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 200000;
  public readonly LLModelName: string = 'claude-3-5-sonnet-20241022';
  public readonly LLModelVersion: string = '20241022';
  public readonly name: string = 'AnthropicMarv';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort =
    'Specialized Formstack API robot for form creation, field management, and advanced form operations';
  static descriptionLong =
    'Marv is a specialized robot focused on Formstack form management. It provides comprehensive form lifecycle management including form creation, field addition/removal, logic stash operations, unique label slug management, and developer copy creation. All operations are performed through real Formstack API calls on Marv-enabled forms.';

  // Robot role/system prompt
  private readonly robotRole = `
You are Marv, an iStackBuddy robot specializing in Formstack form management and API operations.

Your primary focus is on helping users manage Formstack forms through direct API operations. You have access to a comprehensive set of Formstack tools:

**Form Management:**
- Create new forms with initial field sets (formLiteAdd)
- Create developer copies of existing forms (formDeveloperCopy)

**Field Operations:**
- Add individual fields to forms (fieldLiteAdd)
- Remove fields from forms (fieldRemove)

**Logic Management:**
- Create logic stash (backup current field logic) (fieldLogicStashCreate)
- Apply logic stash (restore backed up logic) (fieldLogicStashApply)
- Apply and remove logic stash (restore then delete backup) (fieldLogicStashApplyAndRemove)
- Remove logic stash (delete backup without applying) (fieldLogicStashRemove)
- Remove all logic from form fields (fieldLogicRemove)

**Label Management:**
- Add unique slugs to field labels for easier identification (fieldLabelUniqueSlugAdd)
- Remove unique slugs from field labels (fieldLabelUniqueSlugRemove)

**Validation & Analysis:**
- Validate form logic for errors and issues (formLogicValidation)
- Validate form calculations and detect circular references (formCalculationValidation)
- Get comprehensive form overview with statistics (formAndRelatedEntityOverview)

**IMPORTANT CONSTRAINTS:**
- Most operations can ONLY be performed on Marv-enabled forms
- All operations use real Formstack API calls
- You work with actual form IDs, field IDs, and make permanent changes
- Always confirm operations that modify or delete data

Your goal is to help users efficiently manage their Formstack forms through these specialized tools. Be precise, helpful, and always confirm destructive operations.
`;

  // Tool definitions for Anthropic API (only Formstack tools)
  private readonly tools: Anthropic.Messages.Tool[] =
    marvToolSet.toolDefinitions;

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
   * Convert our message envelope to Anthropic format
   */
  private createAnthropicMessageRequest(
    messageEnvelope: TConversationTextMessageEnvelope,
    getHistory?: () => IConversationMessage[],
  ): Anthropic.Messages.MessageCreateParams {
    const userMessage = messageEnvelope.envelopePayload.content.payload;

    // Build conversation history if provided
    const messages: Anthropic.Messages.MessageParam[] = [];

    if (getHistory) {
      const history = getHistory();
      for (const msg of history) {
        messages.push({
          role:
            msg.fromRole === UserRole.CUSTOMER ||
            msg.fromRole === UserRole.AGENT
              ? 'user'
              : 'assistant',
          content: msg.content,
        });
      }
    }

    // Add the current message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    return {
      model: this.LLModelName,
      max_tokens: 1024,
      system: this.robotRole,
      messages: messages,
      tools: this.tools,
    };
  }

  /**
   * Execute tool calls for Formstack operations
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
    onFullMessageReceived?: (content: string) => void,
  ): Promise<string> {
    try {
      // All our tools are Formstack API calls
      const response = await marvToolSet.executeToolCall(toolName, toolArgs);

      // Transform the response using the tool set's transformer
      const { robotResponse, chatResponse } =
        marvToolSet.transformToolResponse?.(toolName, response) || {
          robotResponse: {
            status: 'ok',
            message: `${toolName} completed successfully`,
          },
        };

      // If there's a chat response, send it as a full message
      if (chatResponse && onFullMessageReceived) {
        console.log(
          'Sending chat response to onFullMessageReceived:',
          chatResponse.message.substring(0, 100) + '...',
        );
        onFullMessageReceived(chatResponse.message);
      } else {
        console.log(
          'No chat response or onFullMessageReceived callback available',
        );
      }

      // Return the robot response
      return robotResponse.message;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return `Error executing ${toolName}: ${errorMessage}`;
    }
  }

  /**
   * Handle streaming response using Anthropic's streaming API
   */
  public async acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage[],
  ): Promise<void> {
    try {
      // if (true && !process.env.DOES_NOT_EXIST) {
      //   throw Error('XX Test Error Handler XX..');
      // }

      const client = this.getClient();
      const request = this.createAnthropicMessageRequest(
        messageEnvelope,
        getHistory,
      );

      // Call onStreamStart if provided
      if (callbacks.onStreamStart) {
        callbacks.onStreamStart(messageEnvelope);
      }

      const stream = await client.messages.create({
        ...request,
        stream: true,
      });

      const toolUseBlocks: any[] = [];
      let currentToolUse: any = null;
      let accumulatedContent = '';

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_start' &&
          chunk.content_block.type === 'tool_use'
        ) {
          currentToolUse = { ...chunk.content_block, input: '' };
        } else if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          accumulatedContent += chunk.delta.text;
          callbacks.onStreamChunkReceived(chunk.delta.text);
        } else if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'input_json_delta'
        ) {
          if (currentToolUse) {
            currentToolUse.input =
              (currentToolUse.input || '') + chunk.delta.partial_json;
          }
        } else if (chunk.type === 'content_block_stop' && currentToolUse) {
          toolUseBlocks.push(currentToolUse);
          currentToolUse = null;
        }
      }

      // Process any tool calls that were made
      for (const toolUse of toolUseBlocks) {
        try {
          // Handle case where input might already be parsed or needs parsing
          let toolArgs = toolUse.input;
          if (typeof toolArgs === 'string') {
            try {
              toolArgs = JSON.parse(toolArgs);
            } catch (parseError) {
              callbacks.onStreamChunkReceived(
                `\n\nError parsing tool arguments: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
              );
              continue;
            }
          }
          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolArgs,
            callbacks.onFullMessageReceived,
          );
          callbacks.onStreamChunkReceived(`\n\n${toolResult}`);
          accumulatedContent += `\n\n${toolResult}`;
        } catch (error) {
          callbacks.onStreamChunkReceived(
            `\n\nError executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          accumulatedContent += `\n\nError executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }

      // Call onStreamFinished with minimal data
      if (typeof callbacks.onStreamFinished === 'function') {
        callbacks.onStreamFinished(accumulatedContent, 'assistant');
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
   * Handle immediate response using Anthropic's messages API
   * TODO - REFACTOR TO USE super class predefined callbacks - need to define them in super class.
   * WARN - THESE CALL BACKS ARE STUBBED AND SERVE NO PURPOSE
   */
  public async acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    getHistory?: () => IConversationMessage[],
  ): Promise<TConversationTextMessageEnvelope> {
    try {
      // Use the streaming pattern to get the complete response
      let finalResponse: TConversationTextMessageEnvelope | null = null;
      let accumulatedContent = '';

      await this.acceptMessageStreamResponse(
        messageEnvelope,
        {
          onStreamChunkReceived: (chunk: string) => {
            if (chunk !== null) {
              accumulatedContent += chunk;
            }
          },
          onStreamStart: (message) => {
            // Handle stream start if needed
          },
          onStreamFinished: (content: string, authorRole: string) => {
            // Store the content for return
            accumulatedContent = content;
          },
          onFullMessageReceived: (content: string) => {
            // Handle full message if needed
          },
          onError: (error) => {
            throw error;
          },
        },
        getHistory,
      );

      // Create the final response envelope with minimal data
      finalResponse = {
        messageId: '', // Will be set by conversation manager
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: '', // Will be set by conversation manager
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: accumulatedContent,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(accumulatedContent),
        },
      };

      return finalResponse;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorResponse: TConversationTextMessageEnvelope = {
        messageId: '', // Will be set by conversation manager
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: '', // Will be set by conversation manager
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: `Error: ${errorMessage}`,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(errorMessage),
        },
      };

      return errorResponse;
    }
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
    getHistory?: () => IConversationMessage[],
  ): Promise<TConversationTextMessageEnvelope> {
    // Send immediate response first - TODO: Change to use acceptMessageStreamResponse directly
    const immediateResponse = await this.acceptMessageImmediateResponse(
      messageEnvelope,
      getHistory,
    );

    // Start streaming in background and promise to send delayed message when complete
    this.acceptMessageStreamResponse(
      messageEnvelope,
      {
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
      },
      getHistory,
    ).catch((error) => {
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

    return immediateResponse;
  }
}
