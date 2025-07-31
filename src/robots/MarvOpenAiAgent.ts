import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import { OpenAI } from 'openai';
import { marvToolSet } from './tool-definitions/marv';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

/**
 * Marv OpenAI - Specialized Formstack API Robot
 * Focused on Formstack form management and field operations using OpenAI
 */
export class MarvOpenAiAgent extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService('MarvOpenAiAgent');

  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 128000; // GPT-4 context window
  public readonly LLModelName: string = 'gpt-4o';
  public readonly LLModelVersion: string = 'gpt-4o-2024-05-13';
  public readonly name: string = 'MarvOpenAiAgent';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort =
    'Specialized Formstack API robot for form creation, field management, and advanced form operations using OpenAI';
  static descriptionLong =
    'Marv OpenAI is a specialized robot focused on Formstack form management using OpenAI. It provides comprehensive form lifecycle management including form creation, field addition/removal, logic stash operations, unique label slug management, and developer copy creation. All operations are performed through real Formstack API calls on Marv-enabled forms.';

  // Robot role/system prompt
  private readonly robotRole = `
You are Marv OpenAI, an iStackBuddy robot specializing in Formstack form management and API operations using OpenAI.

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

IMPORTANT: Never use emojis, emoticons, or any graphical symbols in your responses. Use only plain text.
`;

  // Tool definitions for OpenAI API (only Formstack tools)
  private readonly tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
    marvToolSet.toolDefinitions.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

  /**
   * Simple token estimation - roughly 4 characters per token for GPT
   */
  public estimateTokens(message: string): number {
    return Math.ceil(message.length / 4);
  }

  /**
   * Get OpenAI client with API key from environment
   */
  private getClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is required but not set. ' +
          'Please set it to your OpenAI API key.',
      );
    }

    return new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Convert our message envelope to OpenAI format
   */
  private createOpenAIMessageRequest(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): OpenAI.Chat.Completions.ChatCompletionCreateParams {
    const userMessage = messageEnvelope.envelopePayload.content.payload;

    const messages = [
      {
        role: 'system' as const,
        content: this.robotRole,
      },
      {
        role: 'user' as const,
        content: userMessage,
      },
    ];

    // Debug log the conversation being sent to the robot
    const conversationForLog = messages.map((msg) => ({
      author:
        msg.role === 'user'
          ? 'user'
          : msg.role === 'system'
            ? 'system'
            : 'robot',
      content: msg.content,
    }));

    this.logger.debug('Conversation being sent to robot:', conversationForLog);

    return {
      model: this.LLModelName,
      max_tokens: 1024,
      messages,
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
        return `${toolName} completed successfully\n\nResult: ${JSON.stringify(result.response, null, 2)}`;
      } else {
        return `${toolName} failed\n\nErrors: ${result.errorItems?.join(', ') || 'Unknown error'}`;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return `Error executing ${toolName}: ${errorMessage}`;
    }
  }

  /**
   * Handle streaming response using OpenAI's streaming API
   */
  public async acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    try {
      const client = this.getClient();
      const request = this.createOpenAIMessageRequest(messageEnvelope);

      const stream = await client.chat.completions.create({
        ...request,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          chunkCallback(content);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      chunkCallback(`Error in streaming response: ${errorMessage}`);
    }
  }

  /**
   * Handle immediate response using OpenAI's chat completions API
   */
  public async acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    try {
      const client = this.getClient();
      const request = this.createOpenAIMessageRequest(messageEnvelope);

      const response = await client.chat.completions.create(request);

      // Extract text content and handle tool calls
      let responseText = '';
      const toolCalls: any[] = [];

      if ('choices' in response && response.choices[0]?.message) {
        responseText = response.choices[0].message.content || '';
        toolCalls.push(...(response.choices[0].message.tool_calls || []));
      }

      // Execute any tool calls
      for (const toolCall of toolCalls) {
        try {
          const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
          const toolResult = await this.executeToolCall(
            toolCall.function?.name || '',
            toolArgs,
          );
          responseText += `\n\n${toolResult}`;
        } catch (error) {
          responseText += `\n\nError executing tool ${toolCall.function?.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }

      // Create response envelope
      // we need to verify where/who/how messageId are generated.  Is it the responsibility of the robot? or conversation manager.
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
      // we need to verify where/who/how messageId are generated.  Is it the responsibility of the robot? or conversation manager.
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
        const followUpRequest = this.createOpenAIMessageRequest({
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
        const followUpResponse =
          await client.chat.completions.create(followUpRequest);

        let followUpText = '';
        if (
          'choices' in followUpResponse &&
          followUpResponse.choices[0]?.message
        ) {
          followUpText = followUpResponse.choices[0].message.content || '';
        }

        // we need to verify where/who/how messageId are generated.  Is it the responsibility of the robot? or conversation manager.
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
        // we need to verify where/who/how messageId are generated.  Is it the responsibility of the robot? or conversation manager.
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
