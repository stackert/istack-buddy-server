import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import Anthropic from '@anthropic-ai/sdk';
import { marvToolSet } from './tool-definitions/marv';

const ANTHROPIC_API_KEY = '_ANTHROPIC_API_KEY_';

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
    const apiKey = ANTHROPIC_API_KEY; // process.env.ANTHROPIC_API_KEY;

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
  ): Anthropic.Messages.MessageCreateParams {
    const userMessage = messageEnvelope.envelopePayload.content.payload;

    return {
      model: this.LLModelName,
      max_tokens: 1024,
      system: this.robotRole,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      tools: this.tools,
    };
  }

  /**
   * Execute tool calls for Formstack operations
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
  ): Promise<string> {
    try {
      // All our tools are Formstack API calls
      const result = await marvToolSet.executeToolCall(toolName, toolArgs);

      // Convert the API response to a readable string format
      if (result.isSuccess) {
        return `✅ ${toolName} completed successfully\n\nResult: ${JSON.stringify(result.response, null, 2)}`;
      } else {
        return `❌ ${toolName} failed\n\nErrors: ${result.errorItems?.join(', ') || 'Unknown error'}`;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return `❌ Error executing ${toolName}: ${errorMessage}`;
    }
  }

  /**
   * Handle streaming response using Anthropic's streaming API
   */
  public async acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    try {
      const client = this.getClient();
      const request = this.createAnthropicMessageRequest(messageEnvelope);

      const stream = await client.messages.create({
        ...request,
        stream: true,
      });

      let toolUseBlocks: any[] = [];
      let currentToolUse: any = null;

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
          chunkCallback(chunk.delta.text);
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
              chunkCallback(
                `\n\nError parsing tool arguments: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
              );
              continue;
            }
          }
          const toolResult = await this.executeToolCall(toolUse.name, toolArgs);
          chunkCallback(`\n\n${toolResult}`);
        } catch (error) {
          chunkCallback(
            `\n\nError executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      chunkCallback(`Error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Handle immediate response using Anthropic's messages API
   */
  public async acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    try {
      const client = this.getClient();
      const request = this.createAnthropicMessageRequest(messageEnvelope);

      const response = (await client.messages.create(
        request,
      )) as Anthropic.Messages.Message;

      // Extract text content and handle tool use
      let responseText = '';
      const toolUses: any[] = [];

      for (const content of response.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          toolUses.push(content);
        }
      }

      // Execute any tool calls
      for (const toolUse of toolUses) {
        try {
          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolUse.input,
          );
          responseText += `\n\n${toolResult}`;
        } catch (error) {
          responseText += `\n\nError executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }

      // Create response envelope
      const responseEnvelope: TConversationTextMessageEnvelope = {
        messageId: `response-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: responseText,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(responseText),
        },
      };

      return responseEnvelope;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      // Return error response envelope
      const errorResponse: TConversationTextMessageEnvelope = {
        messageId: `error-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `error-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: `I apologize, but I encountered an error: ${errorMessage}`,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(errorMessage),
        },
      };

      return errorResponse;
    }
  }

  /**
   * Handle multi-part response with delayed callback
   */
  public async acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (
      response: TConversationTextMessageEnvelope,
    ) => void,
  ): Promise<TConversationTextMessageEnvelope> {
    // Get immediate response first
    const immediateResponse =
      await this.acceptMessageImmediateResponse(messageEnvelope);

    // Send a delayed follow-up after processing
    setTimeout(async () => {
      try {
        const followUpRequest = this.createAnthropicMessageRequest({
          ...messageEnvelope,
          envelopePayload: {
            ...messageEnvelope.envelopePayload,
            content: {
              type: 'text/plain',
              payload: `Follow up on: "${messageEnvelope.envelopePayload.content.payload}". Is there anything else I can help you with regarding Formstack form management? I have tools available for form creation, field management, logic operations, and more.`,
            },
          },
        });

        const client = this.getClient();
        const followUpResponse = (await client.messages.create(
          followUpRequest,
        )) as Anthropic.Messages.Message;

        let followUpText = '';
        for (const content of followUpResponse.content) {
          if (content.type === 'text') {
            followUpText += content.text;
          }
        }

        const delayedResponse: TConversationTextMessageEnvelope = {
          messageId: `delayed-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `delayed-msg-${Date.now()}`,
            author_role: 'assistant',
            content: {
              type: 'text/plain',
              payload: followUpText,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: this.estimateTokens(followUpText),
          },
        };

        delayedMessageCallback(delayedResponse);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unknown error in delayed response';
        const errorResponse: TConversationTextMessageEnvelope = {
          messageId: `delayed-error-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `delayed-error-msg-${Date.now()}`,
            author_role: 'assistant',
            content: {
              type: 'text/plain',
              payload: `Error in delayed response: ${errorMessage}`,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: this.estimateTokens(errorMessage),
          },
        };

        delayedMessageCallback(errorResponse);
      }
    }, 2000);

    return immediateResponse;
  }
}
