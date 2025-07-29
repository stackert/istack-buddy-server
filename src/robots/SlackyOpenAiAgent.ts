import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { OpenAI } from 'openai';
import { slackyToolSet } from './tool-definitions/slacky';
import {
  marvToolDefinitions,
  performMarvToolCall,
  FsRestrictedApiRoutesEnum,
} from './tool-definitions/marv';
import { createCompositeToolSet } from './tool-definitions/toolCatalog';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

/**
 * Slack-specific OpenAI Chat Robot implementation
 * Specialized for Slack integration with comprehensive tool support using OpenAI
 */
export class SlackyOpenAiAgent extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService('SlackyOpenAiAgent');

  constructor() {
    super();
    this.logger.log('SlackyOpenAiAgent constructor called - class loaded');
  }

  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 128000; // GPT-4 context window
  public readonly LLModelName: string = 'gpt-4o';
  public readonly LLModelVersion: string = 'gpt-4o-2024-05-13';
  public readonly name: string = 'SlackyOpenAiAgent';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort =
    'Slack-specialized OpenAI agent with enhanced troubleshooting tools for Intellistack Forms Core';
  static descriptionLong = `This robot provides advanced Slack integration with OpenAI's GPT-4 API, specialized for Intellistack Forms Core troubleshooting. It includes Slacky tools for Sumo Logic queries and SSO auto-fill assistance, plus form validation tools for logic validation, calculation validation, and comprehensive form overviews. Optimized for Slack conversations with immediate responses and focused troubleshooting capabilities.`;

  // Robot role/system prompt - customized for Slack
  private readonly robotRole = `
You are iStackBuddy, a specialized AI assistant for Intellistack Forms Core troubleshooting, operating within Slack.

"Forms Core" is Intellistack's legacy forms product (formally known as "Formstack").

**Your Slack Context:**
- You're responding to users in Slack channels
- Keep responses concise and well-formatted for Slack
- Use formatting appropriately for Slack (no emojis)
- Provide actionable help quickly

**Your Expertise Areas:**
- SSO troubleshooting (Forms Password Protected/SSO Protected, not account access SSO)
- Form troubleshooting (logic, rendering, configuration issues)
- Form configuration: Field/Section setup, Visibility Logic, Calculations
- Form Integration (submitActions) issues
- Comprehensive form management and field operations

 **Your Tools Include:**
**Analysis Tools:**
 - Sumo Logic Queries - for analyzing logs and submission data
 
 **SSO & Security:**
 - SSO Auto-fill Assistance - troubleshooting SSO configuration and auto-fill mapping issues

 **Form Validation & Analysis:**
 - Form Logic Validation - detect logic errors and configuration issues
 - Form Calculation Validation - check for circular references and calculation errors  
 - Form and Related Entity Overview - comprehensive form statistics and configuration details

**Communication Style for Slack:**
- Be helpful and professional yet conversational
- Use structured responses with clear sections
- Provide step-by-step guidance when appropriate
- Use clear formatting to improve readability
- Keep initial responses focused, offer to dig deeper if needed

**Important Notes:**
- Form validation tools can ONLY be used on Marv-enabled forms
- Always confirm before suggesting destructive operations
- When analyzing forms, start with the overview tool to understand the current state
- For complex issues, use multiple tools in sequence to build a complete picture

When processing tool results for FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview
Where there are lists of form associated entities (list of webhooks, submit actions, notification emails).
You should present those lists is easy to read format that include the entity ids.

The goal for that tool is to provide context (entity id) for further investigations. 

REALLY THE ONLY PURPOSE OF THAT TOOL IS TO LIST ALL ASSOCIATED ID

IMPORTANT: Never use emojis, emoticons, or any graphical symbols in your responses. Use only plain text.
`;

  // Create a minimal marv tool catalog with just our selected tools
  private readonly selectedMarvToolSet = {
    toolDefinitions: marvToolDefinitions.filter(
      (tool) =>
        tool.name === FsRestrictedApiRoutesEnum.FormLogicValidation ||
        tool.name === FsRestrictedApiRoutesEnum.FormCalculationValidation ||
        tool.name === FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
    ),
    executeToolCall: performMarvToolCall,
  };

  // Create composite tool set using the existing pattern
  private readonly compositeToolSet = createCompositeToolSet(
    slackyToolSet,
    this.selectedMarvToolSet,
  );

  // Composite tool definitions - slacky tools + selected marv tools
  private readonly tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
    this.compositeToolSet.toolDefinitions.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

  // Store conversation history for context
  private conversationHistory: IConversationMessage[] = [];

  /**
   * Simple token estimation - roughly 4 characters per token for GPT
   */
  public estimateTokens(message: string): number {
    return Math.ceil(message.length / 4);
  }

  /**
   * Get user help text specific to SlackyOpenAiAgent capabilities
   */
  public getUserHelpText(): string {
    return `🤖 **iStackBuddy (Slacky OpenAI) - Help**

I'm your AI assistant specialized in **Intellistack Forms Core** troubleshooting and support using OpenAI.

## 🛠️ **What I Can Help With:**

**Forms Core Troubleshooting:**
• SSO troubleshooting (Forms Password Protected/SSO Protected)
• Form configuration issues (fields, sections, visibility logic)
• Form rendering and display problems
• Calculation and logic debugging
• Form integration (submitActions) issues

**Advanced Analysis Tools:**
• **Sumo Logic Queries** - Analyze submission logs and trace data
• **SSO Auto-fill Assistance** - Diagnose SSO configuration issues
• **Form Validation** - Check logic and calculation errors
• **Form Overviews** - Get comprehensive form statistics and configurations

## 📋 **Available Commands:**
• \`/help\` - Show this help message
• \`/feedback <message>\` - Send feedback about our interaction
• \`/rate <rating>\` - Rate your experience (-5 to +5)

## 💡 **Tips:**
• Be specific about your issue for better assistance
• Include form IDs when asking about specific forms
• I can analyze logs and validate form configurations
• Always confirm before suggesting destructive operations

Need help? Just ask! 🚀`;
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
   * Execute tool calls using the composite tool set
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
  ): Promise<string> {
    this.logger.debug(`Executing tool: ${toolName}`, { toolArgs });
    try {
      const result = this.compositeToolSet.executeToolCall(toolName, toolArgs);
      const finalResult = typeof result === 'string' ? result : await result;
      return finalResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error executing tool ${toolName}:`, error);
      return `Error executing ${toolName}: ${errorMessage}`;
    }
  }

  /**
   * Execute all tool calls in parallel
   */
  private async executeToolAllCalls(toolCalls: any[]): Promise<any[]> {
    const results = [];
    for (const toolCall of toolCalls) {
      try {
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        const result = await this.executeToolCall(
          toolCall.function?.name || '',
          toolArgs,
        );
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          content: result,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          content: `Error executing tool: ${errorMessage}`,
        });
      }
    }
    return results;
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
      const messages = this.buildOpenAIMessageHistory(
        messageEnvelope.envelopePayload.content.payload,
      );

      const stream = await client.chat.completions.create({
        model: this.LLModelName,
        max_tokens: 1024,
        messages: [
          {
            role: 'system' as const,
            content: this.robotRole,
          },
          ...messages,
        ],
        tools: this.tools,
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
   * Set conversation history for context-aware responses
   */
  public setConversationHistory(history: IConversationMessage[]): void {
    this.conversationHistory = history;
  }

  /**
   * Convert conversation history to OpenAI message format
   */
  private buildOpenAIMessageHistory(
    currentMessage: string,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add conversation history
    for (const msg of this.conversationHistory) {
      if (msg.fromRole === UserRole.CUSTOMER) {
        messages.push({
          role: 'user' as const,
          content: msg.content,
        });
      } else if (msg.fromRole === UserRole.ROBOT) {
        messages.push({
          role: 'assistant' as const,
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({
      role: 'user' as const,
      content: currentMessage,
    });

    return messages;
  }

  /**
   * Handle direct feedback commands
   */
  private async handleDirectFeedbackCommands(
    message: string,
  ): Promise<string | null> {
    const feedbackMatch = message.match(/^\/feedback\s+(.+)$/i);
    if (feedbackMatch) {
      const feedback = feedbackMatch[1];
      this.logger.log('User feedback received:', { feedback });
      return `Thank you for your feedback! I've recorded: "${feedback}"\n\nIs there anything else I can help you with?`;
    }

    const rateMatch = message.match(/^\/rate\s+(-?\d+)(?:\s+(.+))?$/i);
    if (rateMatch) {
      const rating = parseInt(rateMatch[1]);
      const comment = rateMatch[2] || '';

      if (rating < -5 || rating > 5) {
        return `Please provide a rating between -5 and +5. You provided: ${rating}`;
      }

      this.logger.log('User rating received:', { rating, comment });

      let response = `Thank you for your rating! `;
      if (rating >= 4) {
        response += `I'm glad I could help!`;
      } else if (rating >= 0) {
        response += `I appreciate your feedback.`;
      } else {
        response += `I'm sorry I couldn't help better. I'll work to improve.`;
      }

      if (comment) {
        response += `\n\nComment: "${comment}"`;
      }

      response += `\n\nIs there anything else I can assist you with?`;
      return response;
    }

    const helpMatch = message.match(/^\/help$/i);
    if (helpMatch) {
      return this.getUserHelpText();
    }

    return null;
  }

  /**
   * Handle immediate response using OpenAI's chat completions API
   */
  public async acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    try {
      const userMessage = messageEnvelope.envelopePayload.content.payload;

      // Check for direct feedback commands first
      const feedbackResponse =
        await this.handleDirectFeedbackCommands(userMessage);
      if (feedbackResponse) {
        // we need to verify where/who/how messageId are generated.  Is it the responsibility of the robot? or conversation manager.
        return {
          messageId: `feedback-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `feedback-msg-${Date.now()}`,
            author_role: 'assistant',
            content: {
              type: 'text/plain',
              payload: feedbackResponse,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: this.estimateTokens(feedbackResponse),
          },
        };
      }

      const client = this.getClient();
      const messages = this.buildOpenAIMessageHistory(userMessage);

      const request: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: this.LLModelName,
        max_tokens: 1024,
        messages: [
          {
            role: 'system' as const,
            content: this.robotRole,
          },
          ...messages,
        ],
        tools: this.tools,
      };

      const response = await client.chat.completions.create(request);

      // Extract text content and handle tool calls
      let responseText = '';
      const toolCalls: any[] = [];

      if ('choices' in response && response.choices[0]?.message) {
        responseText = response.choices[0].message.content || '';
        toolCalls.push(...(response.choices[0].message.tool_calls || []));
      }

      // Execute any tool calls
      if (toolCalls.length > 0) {
        const toolResults = await this.executeToolAllCalls(toolCalls);

        // Add tool results to the conversation and get final response
        const finalMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
          [
            ...messages,
            {
              role: 'assistant' as const,
              content: responseText,
              tool_calls: toolCalls,
            },
            ...toolResults,
            {
              role: 'user' as const,
              content:
                'Please provide a summary of the tool results and any actionable insights.',
            },
          ];

        const finalResponse = await client.chat.completions.create({
          model: this.LLModelName,
          max_tokens: 1024,
          messages: [
            {
              role: 'system' as const,
              content: this.robotRole,
            },
            ...finalMessages,
          ],
        });

        if ('choices' in finalResponse && finalResponse.choices[0]?.message) {
          responseText = finalResponse.choices[0].message.content || '';
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
        const followUpRequest: OpenAI.Chat.Completions.ChatCompletionCreateParams =
          {
            model: this.LLModelName,
            max_tokens: 1024,
            messages: [
              {
                role: 'system' as const,
                content: this.robotRole,
              },
              {
                role: 'user' as const,
                content: `Follow up on: "${messageEnvelope.envelopePayload.content.payload}". Is there anything else I can help you with regarding Forms Core troubleshooting? I have tools available for Sumo Logic queries, SSO assistance, form validation, and more.`,
              },
            ],
            tools: this.tools,
          };

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
