import { AbstractRobotChat } from './AbstractRobotChat';
import type {
  IStreamingCallbacks,
  TConversationMessageContentString,
} from './types';
import type { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import type { TConversationMessageContent } from '../ConversationLists/types';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import Anthropic from '@anthropic-ai/sdk';
import { slackyToolSet } from './tool-definitions/slacky';
import {
  marvToolDefinitions,
  performMarvToolCall,
  FsRestrictedApiRoutesEnum,
} from './tool-definitions/marv';
import { createCompositeToolSet } from './tool-definitions/toolCatalog';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

// Helper functions for the streaming pattern
const noOp = (...args: any[]) => {};

/**
 * Slack-specific Anthropic Claude Chat Robot implementation
 * Specialized for Slack integration with comprehensive tool support
 */
export class SlackyAnthropicAgent extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService();

  constructor() {
    super();
    this.logger.log('SlackyAnthropicAgent constructor called - class loaded');
  }

  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 200000;
  public readonly LLModelName: string = 'claude-3-5-sonnet-20241022';
  public readonly LLModelVersion: string = '20241022';
  public readonly name: string = 'SlackyAnthropicAgent';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort =
    'Slack-specialized Anthropic Claude agent with enhanced troubleshooting tools for Intellistack Forms Core';
  static descriptionLong = `This robot provides advanced Slack integration with Anthropic's Claude API, specialized for Intellistack Forms Core troubleshooting. It includes Slacky tools for Sumo Logic queries and SSO auto-fill assistance, plus form validation tools for logic validation, calculation validation, and comprehensive form overviews. Optimized for Slack conversations with immediate responses and focused troubleshooting capabilities.`;

  // Robot role/system prompt - customized for Slack
  private readonly robotRole = `
You are iStackBuddy, a specialized AI assistant for Intellistack Forms Core troubleshooting, operating within Slack.

"Forms Core" is Intellistack's legacy forms product (formally known as "Formstack").

**Your Slack Context:**
- You're responding to users in Slack channels
- Keep responses concise and well-formatted for Slack
- Use emojis and formatting appropriately for Slack
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

 🧮 **Form Validation & Analysis:**
 - Form Logic Validation - detect logic errors and configuration issues
 - Form Calculation Validation - check for circular references and calculation errors  
 - Form and Related Entity Overview - comprehensive form statistics and configuration details

**Communication Style for Slack:**
- Be helpful and professional yet conversational
- Use structured responses with clear sections
- Provide step-by-step guidance when appropriate
- Include relevant emojis to improve readability
- Keep initial responses focused, offer to dig deeper if needed

**Important Notes:**
- Form validation tools can ONLY be used on Marv-enabled forms
- Always confirm before suggesting destructive operations
- When analyzing forms, start with the overview tool to understand the current state
- For complex issues, use multiple tools in sequence to build a complete picture



When processing tool results for FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview
Where there are lists of form associated entities (list of webhooks, submit actions, notofication emails).
You should present those lists is easy to read format that include the entity ids.

The goal for that tool is to provide context (entity id) for further investigations. 

REALLY THE ONLY PURPOSE OF THAT TOOL IS TO LIST ALL ASSOCIATED ID
`;

  // Selected Marv tools (just the 3 we want)
  private readonly selectedMarvTools: Anthropic.Messages.Tool[] =
    marvToolDefinitions.filter(
      (tool) =>
        tool.name === FsRestrictedApiRoutesEnum.FormLogicValidation ||
        tool.name === FsRestrictedApiRoutesEnum.FormCalculationValidation ||
        tool.name === FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
    );

  // Create a minimal marv tool catalog with just our selected tools
  private readonly selectedMarvToolSet = {
    toolDefinitions: this.selectedMarvTools,
    executeToolCall: performMarvToolCall,
  };

  // Create composite tool set using the existing pattern
  private readonly compositeToolSet = createCompositeToolSet(
    slackyToolSet,
    this.selectedMarvToolSet,
  );

  // Composite tool definitions - slacky tools + selected marv tools
  private readonly tools: Anthropic.Messages.Tool[] =
    this.compositeToolSet.toolDefinitions;

  // Store conversation history for context
  private conversationHistory: IConversationMessage[] = [];

  /**
   * Simple token estimation - roughly 4 characters per token for Claude
   */
  public estimateTokens(message: string): number {
    return Math.ceil(message.length / 4);
  }

  /**
   * Get user help text specific to SlackyAnthropicAgent capabilities
   */
  public getUserHelpText(): string {
    return `🤖 **iStackBuddy (Slacky) - Help**

I'm your AI assistant specialized in **Intellistack Forms Core** troubleshooting and support.

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

## **Knowledge Base Coverage:**

I'm backed by specialized knowledge bases depending on the channel:
• **#forms-sso** → Forms SSO-specific knowledge base
• **#cx-formstack** → General Forms Core knowledge base
• **Other channels** → General troubleshooting knowledge

## 💬 **How to Use:**

**Ask Questions:**
\`@istack-buddy How do I fix form validation errors?\`
\`@istack-buddy Why isn't my SSO auto-fill working?\`
\`@istack-buddy Can you analyze submission logs for form 12345?\`

**Give Feedback:**
\`@istack-buddy /feedback [your feedback]\`
\`@istack-buddy /rating [+5 to -5] [optional comment]\`

**Get Help:**
\`@istack-buddy /help\` (shows this message)

## **Specialized Features:**

• **Thread Support** - Works in channels and thread replies
• **Context Aware** - Understands your troubleshooting context
• **Tool Integration** - Can perform advanced analysis and lookups
• **Immediate Responses** - Fast feedback and rating collection

I'm designed to help you solve Forms Core issues quickly and effectively. Just ask me anything about forms, SSO, troubleshooting, or data analysis!`;
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
   * Execute a tool call using the composite tool set
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
  ): Promise<string> {
    try {
      const result = await this.compositeToolSet.executeToolCall(
        toolName,
        toolArgs,
      );
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error) {
      this.logger.error(`Error executing tool ${toolName}`, error);
      return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Execute all tool calls and return formatted results
   */
  private async executeToolAllCalls(toolUses: any[]): Promise<any[]> {
    const toolResultMessages: any[] = [];

    for (const toolUse of toolUses) {
      try {
        const toolResult = await this.executeToolCall(
          toolUse.name,
          toolUse.input,
        );

        toolResultMessages.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult,
        });
      } catch (error) {
        toolResultMessages.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          is_error: true,
        });
      }
    }

    return toolResultMessages;
  }

  /**
   * Execute all tool calls with delayed callback notifications and return formatted results
   */
  private async executeToolAllCallsWithDelayedCallback(
    toolUses: any[],
    delayedMessageCallback: (message: any) => void,
  ): Promise<any[]> {
    const toolResultMessages: any[] = [];

    for (const toolUse of toolUses) {
      try {
        const toolResult = await this.executeToolCall(
          toolUse.name,
          toolUse.input,
        );

        // Send raw tool result immediately via delayed callback
        delayedMessageCallback({
          messageId: `slacky-tool-result-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `slacky-tool-msg-${Date.now()}`,
            author_role: 'assistant',
            content: {
              type: 'text/plain',
              payload: `**Tool: ${toolUse.name}**\n\n${toolResult}`,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: this.estimateTokens(toolResult),
          },
        });

        toolResultMessages.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult,
        });
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;

        // Send raw tool error immediately via delayed callback
        delayedMessageCallback({
          messageId: `slacky-tool-error-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `slacky-tool-error-msg-${Date.now()}`,
            author_role: 'assistant',
            content: {
              type: 'text/plain',
              payload: `**Tool Error: ${toolUse.name}**\n\n${errorMsg}`,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: this.estimateTokens(errorMsg),
          },
        });

        toolResultMessages.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: errorMsg,
          is_error: true,
        });
      }
    }

    return toolResultMessages;
  }

  /**
   * Stream response from Anthropic API with proper tool result handling
   */
  public async acceptMessageStreamResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<void> {
    const client = this.getClient();
    const userMessage = message.content.payload;

    try {
      // Call onStreamStart if provided
      if (callbacks.onStreamStart) {
        callbacks.onStreamStart(message);
      }

      // Initial request to Claude
      const initialResponse = (await client.messages.create({
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
      })) as Anthropic.Messages.Message;

      // Check if Claude wants to use any tools
      let responseText = '';
      const toolUses: any[] = [];
      let accumulatedContent = '';

      for (const content of initialResponse.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          toolUses.push(content);
        }
      }

      // If no tools were used, stream the response directly
      if (toolUses.length === 0) {
        accumulatedContent += responseText;
        callbacks.onStreamChunkReceived(responseText);

        // Call onStreamFinished with minimal data
        if (typeof callbacks.onStreamFinished === 'function') {
          callbacks.onStreamFinished(message);
        }
        return;
      }

      // Stream initial response if any
      if (responseText) {
        accumulatedContent += responseText;
        callbacks.onStreamChunkReceived(responseText);
      }

      // Execute tools and collect results
      const toolResultMessages: any[] = [];

      for (const toolUse of toolUses) {
        try {
          const executingMsg = `\n\nExecuting ${toolUse.name}...`;
          accumulatedContent += executingMsg;
          callbacks.onStreamChunkReceived(executingMsg);

          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolUse.input,
          );

          // Stream raw tool result for user visibility
          const toolResultMsg = `\n\n**Tool: ${toolUse.name}**\n${toolResult}`;
          accumulatedContent += toolResultMsg;
          callbacks.onStreamChunkReceived(toolResultMsg);

          // Collect for Claude processing
          toolResultMessages.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: toolResult,
          });
        } catch (error) {
          const errorMsg = `Error executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;

          // Stream raw error for user visibility
          const errorMsgFormatted = `\n\n**Tool Error: ${toolUse.name}**\n${errorMsg}`;
          accumulatedContent += errorMsgFormatted;
          callbacks.onStreamChunkReceived(errorMsgFormatted);

          // Collect for Claude processing
          toolResultMessages.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: errorMsg,
            is_error: true,
          });
        }
      }

      // Stream Claude's analysis header
      const analysisHeader = '\n\n---\n\n**Analysis:**\n';
      accumulatedContent += analysisHeader;
      callbacks.onStreamChunkReceived(analysisHeader);

      // Stream follow-up request to Claude with tool results
      const finalStream = await client.messages.create({
        model: this.LLModelName,
        max_tokens: 1024,
        system: this.robotRole,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
          {
            role: 'assistant',
            content: initialResponse.content,
          },
          ...toolResultMessages,
        ],
        stream: true,
      });

      for await (const chunk of finalStream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          accumulatedContent += chunk.delta.text;
          callbacks.onStreamChunkReceived(chunk.delta.text);
        }
      }

      // Call onStreamFinished with minimal data
      if (typeof callbacks.onStreamFinished === 'function') {
        callbacks.onStreamFinished(message);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Call onError if provided
      if (typeof callbacks.onError === 'function') {
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
   * Set conversation history for context-aware responses
   */
  public setConversationHistory(history: IConversationMessage[]): void {
    this.conversationHistory = history;
  }

  /**
   * Convert conversation history to Claude message format
   */
  private buildClaudeMessageHistory(currentMessage: string): any[] {
    const messages: any[] = [];

    // Add conversation history
    for (const msg of this.conversationHistory) {
      if (msg.fromRole === UserRole.CUSTOMER) {
        messages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.fromRole === UserRole.ROBOT) {
        messages.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({
      role: 'user',
      content: currentMessage,
    });

    return messages;
  }

  /**
   * Handle direct feedback/rating commands from the user
   */
  private async handleDirectFeedbackCommands(
    message: string,
  ): Promise<string | null> {
    const trimmedMessage = message.trim();

    // Debug logging for direct command processing
    this.logger.debug('Direct command check', {
      rawMessage: message,
      trimmedMessage: trimmedMessage,
    });

    // Check for @istack-buddy /help pattern (supports both @istack-buddy and <@USERID> formats)
    const helpMatch = trimmedMessage.match(
      /(?:@istack-buddy|<@[^>]+>)\s+\/help(?:\s|$)/i,
    );
    this.logger.debug('Help command check', { matched: !!helpMatch });
    if (helpMatch) {
      this.logger.log('Help command detected');
      return this.getUserHelpText();
    }

    // Check for @istack-buddy /feedback pattern (supports both @istack-buddy and <@USERID> formats)
    const feedbackMatch = trimmedMessage.match(
      /(?:@istack-buddy|<@[^>]+>)\s+\/feedback\s+(.+)/i,
    );
    this.logger.debug('Feedback command check', { matched: !!feedbackMatch });
    if (feedbackMatch) {
      this.logger.log('Feedback command detected');
      const feedbackContent = feedbackMatch[1].trim();

      // Call the feedback tool
      try {
        const toolResult = await this.executeToolCall('collect_user_feedback', {
          feedback: feedbackContent,
          category: 'other', // Default category since user didn't specify
        });

        return `Thank you for your feedback! We appreciate your input to help improve our service.`;
      } catch (error) {
        this.logger.error('Error processing feedback', error);
        return `Thank you for your feedback! We appreciate your input to help improve our service.`;
      }
    }

    // Check for @istack-buddy /rating pattern (supports both @istack-buddy and <@USERID> formats)
    const ratingMatch = trimmedMessage.match(
      /(?:@istack-buddy|<@[^>]+>)\s+\/rating\s+([+-]?\d+)(?:\s+(.+))?/i,
    );
    this.logger.debug('Rating command check', { matched: !!ratingMatch });
    if (ratingMatch) {
      this.logger.log('Rating command detected');
      const rating = parseInt(ratingMatch[1]);
      const comment = ratingMatch[2]?.trim() || '';

      // Validate rating range
      if (rating < -5 || rating > 5) {
        return `**Invalid Rating**

Ratings must be between -5 and +5. Please provide a rating in this range.

**Examples:**
• \`@istack-buddy /rating +4 Very helpful!\`
• \`@istack-buddy /rating -2 Information was wrong\`
• \`@istack-buddy /rating 0\`

**Rating Scale:**
• -5: World War III bad  
• -2: Misleading or just wrong  
• -1: Information had inaccuracies
• 0: Not good/not bad
• +1: A little helpful
• +2: Helpful, will use again
• +5: Nominate iStackBuddy for world peace prize`;
      }

      // Call the rating tool
      try {
        const toolResult = await this.executeToolCall('collect_user_rating', {
          rating: rating,
          context: 'overall_service',
          comment: comment || undefined,
        });

        return `Thank you for your rating of ${rating >= 0 ? '+' : ''}${rating}/5! We appreciate your feedback to help us improve our service.`;
      } catch (error) {
        this.logger.error('Error processing rating', error);
        return `Thank you for your rating! We appreciate your feedback to help us improve our service.`;
      }
    }

    this.logger.debug('No direct commands detected - will go to Claude');
    return null;
  }

  /**
   * Handle immediate response using Anthropic's messages API
   */
  public async acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  > {
    const userMessage = message.content.payload;

    // Check for direct feedback/rating commands FIRST (before needing API key)
    const directCommandResult =
      await this.handleDirectFeedbackCommands(userMessage);
    if (directCommandResult) {
      return {
        content: {
          type: 'text/plain',
          payload: directCommandResult,
        },
      };
    }

    // Only initialize client if we need Claude for normal conversation
    const client = this.getClient();

    try {
      // Build conversation history for Claude
      const messages = this.buildClaudeMessageHistory(userMessage);

      // Initial request to Claude with conversation history
      const initialResponse = (await client.messages.create({
        model: this.LLModelName,
        max_tokens: 1024,
        system: this.robotRole,
        messages: messages,
        tools: this.tools,
      })) as Anthropic.Messages.Message;

      // Check if Claude wants to use any tools
      let responseText = '';
      const toolUses: any[] = [];

      for (const content of initialResponse.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          toolUses.push(content);
        }
      }

      // If no tools were used, return the response directly
      if (toolUses.length === 0) {
        return {
          content: {
            type: 'text/plain',
            payload: responseText,
          },
        };
      }

      // If tools were used, execute them and get Claude's final response
      const toolResultMessages = await this.executeToolAllCalls(toolUses);

      // Get Claude's final response with tool results
      const finalResponse = (await client.messages.create({
        model: this.LLModelName,
        max_tokens: 1024,
        system: this.robotRole,
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: initialResponse.content,
          },
          {
            role: 'user',
            content: toolResultMessages,
          },
        ],
      })) as Anthropic.Messages.Message;

      let finalResponseText = '';
      for (const content of finalResponse.content) {
        if (content.type === 'text') {
          finalResponseText += content.text;
        }
      }

      return {
        content: {
          type: 'text/plain',
          payload: finalResponseText,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        content: {
          type: 'text/plain',
          payload: `I apologize, but I encountered an error: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Multi-part response with proper tool result handling
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
    const userMessage = message.content.payload;

    // Debug logging for multipart response processing
    this.logger.debug('MultiPart response processing', {
      userMessage: userMessage,
    });

    // Check for direct feedback/rating commands FIRST (before needing API key)
    const directCommandResult =
      await this.handleDirectFeedbackCommands(userMessage);
    this.logger.debug('Direct command check result', {
      hasDirectCommand: !!directCommandResult,
    });
    if (directCommandResult) {
      this.logger.log('Returning direct command response');
      return {
        type: 'text/plain',
        payload: directCommandResult,
      };
    }

    // Only initialize client if we need Claude for normal conversation
    const client = this.getClient();

    try {
      // Build conversation history for Claude
      const messages = this.buildClaudeMessageHistory(userMessage);

      // Initial request to Claude with conversation history
      const initialResponse = (await client.messages.create({
        model: this.LLModelName,
        max_tokens: 1024,
        system: this.robotRole,
        messages: messages,
        tools: this.tools,
      })) as Anthropic.Messages.Message;

      // Check if Claude wants to use any tools
      let responseText = '';
      const toolUses: any[] = [];

      for (const content of initialResponse.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          toolUses.push(content);
        }
      }

      // If no tools were used, return the response directly
      if (toolUses.length === 0) {
        return {
          type: 'text/plain',
          payload: responseText,
        };
      }

      // Execute tools and send raw results immediately
      const toolResultMessages =
        await this.executeToolAllCallsWithDelayedCallback(
          toolUses,
          delayedMessageCallback,
        );

      // Get Claude's final analysis with tool results
      const finalResponse = (await client.messages.create({
        model: this.LLModelName,
        max_tokens: 1024,
        system: this.robotRole,
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: initialResponse.content,
          },
          {
            role: 'user',
            content: toolResultMessages,
          },
        ],
      })) as Anthropic.Messages.Message;

      let finalResponseText = '';
      for (const content of finalResponse.content) {
        if (content.type === 'text') {
          finalResponseText += content.text;
        }
      }

      // Return Claude's analysis as the main response
      return {
        type: 'text/plain',
        payload: finalResponseText,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        type: 'text/plain',
        payload: `I apologize, but I encountered an error: ${errorMessage}`,
      };
    }
  }
}
