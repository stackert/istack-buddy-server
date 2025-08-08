import { AbstractRobotChat } from './AbstractRobotChat';
import type {
  TConversationTextMessageEnvelope,
  IStreamingCallbacks,
} from './types';
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
  private isActivelyListeningForResponse: boolean = false;
  private activeMonitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private toolStatus: {
    executing: string[];
    completed: string[];
    errors: string[];
  } = { executing: [], completed: [], errors: [] };
  private readonly pollIntervalMs: number = 15000; // 15 seconds
  private readonly noToolsTimeoutMs: number = 30000; // 30 seconds timeout when no tools are called
  private readMessageIds: Set<string> = new Set();
  private lastToolResults: any[] = [];
  private currentCallback:
    | ((response: TConversationTextMessageEnvelope) => void)
    | null = null;
  private hasSentFinalResponse: boolean = false;

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
    return `**iStackBuddy (Slacky OpenAI) - Help**

I'm your AI assistant specialized in **Intellistack Forms Core** troubleshooting and support using OpenAI.

## **What I Can Help With:**

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

## **Available Commands:**
• \`/help\` - Show this help message
• \`/feedback <message>\` - Send feedback about our interaction
• \`/rate <rating>\` - Rate your experience (-5 to +5)

## **Tips:**
• Be specific about your issue for better assistance
• Include form IDs when asking about specific forms
• I can analyze logs and validate form configurations
• Always confirm before suggesting destructive operations

Need help? Just ask!`;
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

    // Update status to executing
    this.updateToolStatus(toolName, 'executing');

    try {
      const result = this.compositeToolSet.executeToolCall(toolName, toolArgs);
      const finalResult = typeof result === 'string' ? result : await result;
      this.logger.log(`Tool ${toolName} result: "${finalResult}"`);

      // Update status to completed
      this.updateToolStatus(toolName, 'completed');

      return finalResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error executing tool ${toolName}:`, error);

      // Update status to error
      this.updateToolStatus(toolName, 'error');

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
        const toolName = toolCall.function?.name || '';
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');

        // Log tool call and response for debugging (but don't send to Slack)
        const toolCallMessage = `Calling tool: ${toolName} with arguments: ${JSON.stringify(toolArgs, null, 2)}`;
        this.logger.log(toolCallMessage);

        const result = await this.executeToolCall(toolName, toolArgs);

        const toolResponseMessage = `Tool ${toolName} returned: ${JSON.stringify(result, null, 2)}`;
        this.logger.log(toolResponseMessage);

        results.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          content: result,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Send tool error message to Slack
        const toolErrorMessage = `Tool ${toolCall.function?.name || 'unknown'} failed: ${errorMessage}`;
        this.logger.log(toolErrorMessage);
        if (this.currentCallback) {
          this.currentCallback(this.createToolStatusResponse(toolErrorMessage));
        }

        results.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          content: `Error executing tool: ${errorMessage}`,
        });
      }
    }

    // Store the results for final response generation
    this.lastToolResults = results;
    this.logger.log(`Stored ${results.length} tool results for final response`);
    this.logger.log(
      `Tool results content: ${JSON.stringify(results, null, 2)}`,
    );

    return results;
  }

  /**
   * Handle streaming response using OpenAI's streaming API
   */
  public async acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage[],
  ): Promise<void> {
    try {
      const client = this.getClient();

      // Use getHistory callback if provided, otherwise fall back to internal conversationHistory
      const history = getHistory ? getHistory() : this.conversationHistory;
      const messages = this.buildOpenAIMessageHistory(
        messageEnvelope.envelopePayload.content.payload,
        history,
      );

      // Call onStreamStart if provided
      if (callbacks.onStreamStart) {
        callbacks.onStreamStart(messageEnvelope);
      }

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

      let accumulatedContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          accumulatedContent += content;
          callbacks.onStreamChunkReceived(content);
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
   * @deprecated Use getHistory parameter in accept* methods instead
   */
  public setConversationHistory(history: IConversationMessage[]): void {
    this.conversationHistory = history;
  }

  /**
   * Update tool status and trigger callback if needed
   */
  private updateToolStatus(
    toolName: string,
    status: 'executing' | 'completed' | 'error',
  ): void {
    // Remove from all arrays first
    this.toolStatus.executing = this.toolStatus.executing.filter(
      (t) => t !== toolName,
    );
    this.toolStatus.completed = this.toolStatus.completed.filter(
      (t) => t !== toolName,
    );
    this.toolStatus.errors = this.toolStatus.errors.filter(
      (t) => t !== toolName,
    );

    // Add to appropriate array
    switch (status) {
      case 'executing':
        this.toolStatus.executing.push(toolName);
        break;
      case 'completed':
        this.toolStatus.completed.push(toolName);
        break;
      case 'error':
        this.toolStatus.errors.push(toolName);
        break;
    }

    this.logger.log(`Tool status updated: ${toolName} -> ${status}`);
  }

  /**
   * Get current tool status for monitoring
   */
  private getToolStatus(): string | null {
    if (this.toolStatus.executing.length > 0) {
      return `Executing tools: ${this.toolStatus.executing.join(', ')}`;
    }
    if (this.toolStatus.completed.length > 0) {
      return `Completed tools: ${this.toolStatus.completed.join(', ')}`;
    }
    if (this.toolStatus.errors.length > 0) {
      return `Tool errors: ${this.toolStatus.errors.join(', ')}`;
    }
    return null;
  }

  /**
   * Create tool status response envelope
   */
  private createToolStatusResponse(
    status: string,
  ): TConversationTextMessageEnvelope {
    return {
      messageId: `status-${Date.now()}`,
      requestOrResponse: 'response',
      envelopePayload: {
        messageId: `status-msg-${Date.now()}`,
        author_role: 'assistant',
        content: {
          type: 'text/plain',
          payload: status,
        },
        created_at: new Date().toISOString(),
        estimated_token_count: this.estimateTokens(status),
      },
    };
  }

  /**
   * Check for new unread messages and return them
   * Note: This is a simplified version since the robot doesn't have direct access to chatManagerService
   * In a real implementation, this would need to be passed in or accessed differently
   */
  /**
   * Get unread messages from the robot's conversation history
   * TODO: Future enhancement - may want to add conversationId parameter for more sophisticated conversation management
   */
  private async getUnreadMessages(originalMessageId: string): Promise<any[]> {
    try {
      // For now, we'll use the conversation history we already have
      // In a real implementation, this would query the chat manager service
      const unreadMessages = this.conversationHistory.filter(
        (msg: any) =>
          !this.readMessageIds.has(msg.messageId) &&
          msg.fromRole === 'customer' &&
          msg.messageId !== originalMessageId,
      );

      // Mark these messages as read
      unreadMessages.forEach((msg: any) => {
        this.readMessageIds.add(msg.messageId);
      });

      return unreadMessages;
    } catch (error) {
      this.logger.error('Error getting unread messages:', error);
      return [];
    }
  }

  /**
   * Start monitoring for responses and tool status updates
   */
  private startResponseMonitoring(
    originalMessage: TConversationTextMessageEnvelope,
    sendMessageToSlack: (response: TConversationTextMessageEnvelope) => void,
  ): void {
    const monitoringId = `monitor-${Date.now()}`;
    const startTime = Date.now();
    const timeoutMs = 3 * 60 * 1000; // 3 minutes
    let hasSentFinalResponse = false;

    this.isActivelyListeningForResponse = true;

    const interval = setInterval(async () => {
      try {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = timeoutMs - elapsedTime;

        // Check for new user messages using conversation history
        const unreadMessages = await this.getUnreadMessages(
          originalMessage.messageId,
        );

        this.logger.log(
          `Checking for new messages. Found: ${unreadMessages.length}, conversation history length: ${this.conversationHistory.length}`,
        );

        if (unreadMessages.length > 0) {
          this.logger.log(
            `New user messages detected: ${unreadMessages.length} messages, stopping monitoring`,
          );
          clearInterval(interval);
          this.activeMonitoringIntervals.delete(monitoringId);
          this.isActivelyListeningForResponse = false;
          return;
        }

        // Check timeout
        if (elapsedTime > timeoutMs) {
          this.logger.log('Monitoring timeout reached (3 minutes)');
          clearInterval(interval);
          this.activeMonitoringIntervals.delete(monitoringId);
          this.isActivelyListeningForResponse = false;
          return;
        }

        // Log debug message for monitoring (but don't send to Slack)
        const debugMessage = `debug: no new messages found yet, polling time remaining: ${Math.round(remainingTime / 1000)}s (elapsed: ${Math.round(elapsedTime / 1000)}s)`;
        this.logger.log(debugMessage);

        // Check for tool status updates - only send once per tool completion
        const toolStatus = this.getToolStatus();
        if (toolStatus && !hasSentFinalResponse && !this.hasSentFinalResponse) {
          this.logger.log(`Sending tool status update: ${toolStatus}`);
          sendMessageToSlack(this.createToolStatusResponse(toolStatus));
        }

        // Check if we have final results (all tools completed or errored)
        const totalTools =
          this.toolStatus.executing.length +
          this.toolStatus.completed.length +
          this.toolStatus.errors.length;

        // If we have tools and they're all done, OR if we've been polling for a while with no tools
        const shouldSendFinalResponse =
          (totalTools > 0 && this.toolStatus.executing.length === 0) ||
          (totalTools === 0 && elapsedTime > this.noToolsTimeoutMs); // Use class member instead of hardcoded value

        if (
          shouldSendFinalResponse &&
          !hasSentFinalResponse &&
          !this.hasSentFinalResponse
        ) {
          // All tools have completed (success or error), or we've waited long enough with no tools
          this.logger.log(
            `Sending final response. Tools: ${totalTools}, elapsed: ${elapsedTime}ms`,
          );
          hasSentFinalResponse = true;
          this.hasSentFinalResponse = true;

          const finalResponse = await this.generateFinalResponse();
          sendMessageToSlack(finalResponse);

          // DON'T stop monitoring here - continue polling for new user messages
          // Only stop on timeout or new user message
        }
      } catch (error) {
        this.logger.error('Error in response monitoring:', error);
        clearInterval(interval);
        this.activeMonitoringIntervals.delete(monitoringId);
        this.isActivelyListeningForResponse = false;
      }
    }, this.pollIntervalMs); // Poll every 15 seconds

    this.activeMonitoringIntervals.set(monitoringId, interval);
  }

  /**
   * Generate final response based on tool results
   */
  private async generateFinalResponse(): Promise<TConversationTextMessageEnvelope> {
    const client = this.getClient();

    // Calculate total tools
    const totalTools =
      this.toolStatus.executing.length +
      this.toolStatus.completed.length +
      this.toolStatus.errors.length;

    // Create a summary request based on tool results
    const summaryRequest: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: this.LLModelName,
      max_tokens: 1024,
      messages: [
        {
          role: 'system' as const,
          content: this.robotRole,
        },
        {
          role: 'user' as const,
          content:
            totalTools > 0
              ? `Based on the following tool execution results, provide a comprehensive summary and actionable insights:\n\n${JSON.stringify(this.lastToolResults, null, 2)}\n\nCompleted tools: ${this.toolStatus.completed.join(', ')}. Failed tools: ${this.toolStatus.errors.join(', ')}.`
              : `Provide a helpful response to the user's request. No tools were executed, so provide general assistance or ask for more specific information.`,
        },
      ],
    };

    try {
      // If we have tool results, use the fallback response method which handles errors properly
      if (this.lastToolResults.length > 0) {
        const responseText = this.createFallbackResponse(this.lastToolResults);
        this.logger.log(`Generated fallback response: "${responseText}"`);
        return {
          messageId: `final-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `final-msg-${Date.now()}`,
            author_role: 'assistant',
            content: {
              type: 'text/plain',
              payload: responseText,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: this.estimateTokens(responseText),
          },
        };
      }

      // Otherwise, generate a response using the AI
      const response = await client.chat.completions.create(summaryRequest);
      let responseText = '';

      if ('choices' in response && response.choices[0]?.message) {
        responseText = response.choices[0].message.content || '';
      }

      if (!responseText || responseText.trim() === '') {
        responseText = this.createFallbackResponse(this.lastToolResults);
      }

      return {
        messageId: `final-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `final-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: responseText,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(responseText),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        messageId: `error-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `error-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: `I encountered an error generating the final response: ${errorMessage}`,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(errorMessage),
        },
      };
    }
  }

  /**
   * Create a fallback response when the final API call fails or returns empty
   */
  private createFallbackResponse(toolResults: any[]): string {
    // AI DO NOT REMOVE THIS COMMENT
    // 'createFallbackResponse' is a product of an poor understanding of OpenAi API - I believe
    // it's possible we need a fall back response but in vibe-coding AI uses as a crutch.
    // We're going to look at 'events' which may remove the need to 'poll' which will
    // remove the need for 'createFallbackResponse'
    this.logger.log(
      `createFallbackResponse called with ${toolResults.length} tool results`,
    );
    this.logger.log(
      `Tool results for fallback: ${JSON.stringify(toolResults, null, 2)}`,
    );

    // Parse tool results - they come as strings but may contain JSON objects
    const parsedResults = toolResults.map((result) => {
      if (typeof result.content === 'string') {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(result.content);
          return { ...result, content: parsed };
        } catch (e) {
          // If not JSON, keep as string
          return result;
        }
      }
      return result;
    });

    this.logger.log('Parsed tool results:', {
      parsedResults: parsedResults,
    });

    const errors = parsedResults
      .filter(
        (result) =>
          result.content &&
          typeof result.content === 'object' &&
          result.content.errorItems,
      )
      .flatMap((result) => result.content.errorItems || []);

    const successes = parsedResults.filter(
      (result) =>
        result.content &&
        typeof result.content === 'object' &&
        result.content.isSuccess === true,
    );

    // Debug logging to see what we're filtering
    this.logger.log('Filtered tool results:', {
      errors: errors,
      successes: successes,
      successCount: successes.length,
    });

    if (errors.length > 0) {
      return `I attempted to process your request but encountered some issues:\n\n${errors.map((error) => `• ${error}`).join('\n')}\n\nPlease verify the form ID or try a different approach.`;
    } else if (successes.length > 0) {
      // Actually use the tool results to create a meaningful response
      const successResult = successes[0];
      this.logger.log('Processing success result:', {
        successResult: successResult,
        hasContent: !!successResult.content,
        hasResponse: !!(
          successResult.content && successResult.content.response
        ),
      });

      if (successResult.content && successResult.content.response) {
        const data = successResult.content.response;
        this.logger.log('Processing response data:', {
          data: data,
          hasFormId: !!data.formId,
          formId: data.formId,
        });

        // Create a comprehensive summary of the form data
        let summary = `## Form Overview: ${data.formId}\n\n`;

        if (data.url) {
          summary += `**Form URL:** ${data.url}\n`;
        }
        if (data.submissions !== undefined) {
          summary += `**Total Submissions:** ${data.submissions}\n`;
        }
        if (data.submissionsToday !== undefined) {
          summary += `**Submissions Today:** ${data.submissionsToday}\n`;
        }
        if (data.version) {
          summary += `**Version:** ${data.version}\n`;
        }
        if (data.fieldCount) {
          summary += `**Field Count:** ${data.fieldCount}\n`;
        }
        if (data.isActive !== undefined) {
          summary += `**Status:** ${data.isActive ? 'Active' : 'Inactive'}\n`;
        }

        if (data.submitActions && data.submitActions.length > 0) {
          summary += `\n**Submit Actions (${data.submitActions.length}):**\n`;
          data.submitActions.forEach((action: any) => {
            summary += `• ${action.name} (ID: ${action.id})\n`;
          });
        }

        if (data.notificationEmails && data.notificationEmails.length > 0) {
          summary += `\n**Notification Emails (${data.notificationEmails.length}):**\n`;
          data.notificationEmails.forEach((email: any) => {
            summary += `• ${email.name} (ID: ${email.id})\n`;
          });
        }

        if (data.confirmationEmails && data.confirmationEmails.length > 0) {
          summary += `\n**Confirmation Emails (${data.confirmationEmails.length}):**\n`;
          data.confirmationEmails.forEach((email: any) => {
            summary += `• ${email.name} (ID: ${email.id})\n`;
          });
        }

        return summary;
      } else {
        return `I've completed the requested analysis. The tools executed successfully and provided the requested information.`;
      }
    } else {
      return `I processed your request but didn't receive the expected results. Please try again or provide more specific details about what you need.`;
    }
  }

  /**
   * Convert conversation history to OpenAI message format
   */
  private buildOpenAIMessageHistory(
    currentMessage: string,
    history: IConversationMessage[] = this.conversationHistory,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Debug: Log the history being processed
    this.logger.log('Building OpenAI message history:', {
      historyLength: history.length,
      historyRoles: history.map((msg) => ({
        fromRole: msg.fromRole,
        content:
          typeof msg.content === 'string'
            ? msg.content.substring(0, 50) + '...'
            : 'non-string content',
      })),
      currentMessage,
    });

    // Add conversation history
    for (const msg of history) {
      this.logger.log(`Processing message with role: ${msg.fromRole}`);

      if (msg.fromRole === UserRole.CUSTOMER) {
        const content =
          typeof msg.content === 'string' ? msg.content : String(msg.content);
        this.logger.log(
          `Adding customer message: ${content.substring(0, 50)}...`,
        );
        messages.push({
          role: 'user' as const,
          content,
        });
      } else if (msg.fromRole === UserRole.ROBOT) {
        const content =
          typeof msg.content === 'string' ? msg.content : String(msg.content);
        this.logger.log(`Adding robot message: ${content.substring(0, 50)}...`);
        messages.push({
          role: 'assistant' as const,
          content,
        });
      } else {
        this.logger.warn(`Unknown role in message: ${msg.fromRole}, skipping`);
      }
    }

    // Only add current message if it's not already in the history
    const lastHistoryMessage = history[history.length - 1];
    const isCurrentMessageInHistory =
      lastHistoryMessage &&
      lastHistoryMessage.fromRole === UserRole.CUSTOMER &&
      lastHistoryMessage.content === currentMessage;

    if (!isCurrentMessageInHistory) {
      this.logger.log(
        `Adding current message: ${currentMessage.substring(0, 50)}...`,
      );
      messages.push({
        role: 'user' as const,
        content: currentMessage,
      });
    } else {
      this.logger.log('Current message already in history, skipping');
    }

    // Debug log the conversation being sent to the robot
    const conversationForLog = messages.map((msg) => ({
      author: msg.role === 'user' ? 'user' : 'robot',
      content:
        typeof msg.content === 'string'
          ? msg.content.substring(0, 100) + '...'
          : 'non-string content',
    }));

    this.logger.debug('Conversation being sent to robot:', conversationForLog);

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
    getHistory?: () => IConversationMessage[],
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
            // This callback is not directly used in the new acceptMessageStreamResponse
            // but can be used if needed for initial setup.
          },
          onStreamFinished: (content: string, authorRole: string) => {
            // Create a minimal message envelope for the callback
            finalResponse = {
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
          },
          onFullMessageReceived: (content: string, authorRole: string) => {
            // Handle full message if needed
          },
          onError: (error) => {
            // This callback is now directly used in acceptMessageStreamResponse
            // to handle streaming errors.
            finalResponse = {
              messageId: `error-${Date.now()}`,
              requestOrResponse: 'response',
              envelopePayload: {
                messageId: `error-msg-${Date.now()}`,
                author_role: 'assistant',
                content: {
                  type: 'text/plain',
                  payload: `Error in streaming response: ${error.message}`,
                },
                created_at: new Date().toISOString(),
                estimated_token_count: this.estimateTokens(error.message),
              },
            };
          },
        },
        getHistory,
      );

      // Create the final response envelope
      if (finalResponse) {
        return finalResponse;
      } else {
        // Fallback if finalResponse is not set (should not happen with new logic)
        return {
          messageId: `response-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `msg-${Date.now()}`,
            author_role: 'assistant',
            content: {
              type: 'text/plain',
              payload: accumulatedContent,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: this.estimateTokens(accumulatedContent),
          },
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
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
    // Send immediate response first
    const immediateResponse =
      await this.acceptMessageImmediateResponse(messageEnvelope);

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
        onFullMessageReceived: (content: string, authorRole: string) => {
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

  /**
   * Process the request asynchronously (this will trigger tool execution)
   */
  private async processRequestAsync(
    messageEnvelope: TConversationTextMessageEnvelope,
    getHistory?: () => IConversationMessage[],
  ): Promise<void> {
    try {
      // Get conversation history
      const history = getHistory ? getHistory() : this.conversationHistory;

      // Build message history for OpenAI
      const messages = this.buildOpenAIMessageHistory(
        messageEnvelope.envelopePayload.content.payload,
        history,
      );

      // Create the OpenAI request
      const request: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: this.LLModelName,
        max_tokens: 1024,
        messages,
        tools: this.tools,
        stream: false,
      };

      // Make the API call
      const client = this.getClient();
      const response = await client.chat.completions.create(request);

      let responseText = '';
      if ('choices' in response && response.choices[0]?.message) {
        responseText = response.choices[0].message.content || '';
      }

      // Handle tool calls if any
      if (response.choices[0]?.message?.tool_calls) {
        const toolCalls = response.choices[0].message.tool_calls;
        this.logger.log(`Tool calls found: ${toolCalls.length}`);

        // Execute all tool calls
        const toolResults = await this.executeToolAllCalls(toolCalls);

        // Handle tool calls if any
        if (toolResults.length > 0) {
          // Check if any tools failed
          const hasErrors = toolResults.some(
            (result) =>
              result.content &&
              typeof result.content === 'object' &&
              result.content.errorItems &&
              result.content.errorItems.length > 0,
          );

          if (hasErrors) {
            // Only use fallback for actual errors
            responseText = this.createFallbackResponse(toolResults);
          } else {
            // Tools succeeded but AI didn't generate content - create meaningful response from tool data
            const successResult = toolResults[0];
            if (successResult.content && successResult.content.response) {
              const data = successResult.content.response;

              // Create a comprehensive summary of the form data
              let summary = `## Form Overview: ${data.formId}\n\n`;

              if (data.url) {
                summary += `**Form URL:** ${data.url}\n`;
              }
              if (data.submissions !== undefined) {
                summary += `**Total Submissions:** ${data.submissions}\n`;
              }
              if (data.submissionsToday !== undefined) {
                summary += `**Submissions Today:** ${data.submissionsToday}\n`;
              }
              if (data.version) {
                summary += `**Version:** ${data.version}\n`;
              }
              if (data.fieldCount) {
                summary += `**Field Count:** ${data.fieldCount}\n`;
              }
              if (data.isActive !== undefined) {
                summary += `**Status:** ${data.isActive ? 'Active' : 'Inactive'}\n`;
              }

              if (data.submitActions && data.submitActions.length > 0) {
                summary += `\n**Submit Actions (${data.submitActions.length}):**\n`;
                data.submitActions.forEach((action: any) => {
                  summary += `• ${action.name} (ID: ${action.id})\n`;
                });
              }

              if (
                data.notificationEmails &&
                data.notificationEmails.length > 0
              ) {
                summary += `\n**Notification Emails (${data.notificationEmails.length}):**\n`;
                data.notificationEmails.forEach((email: any) => {
                  summary += `• ${email.name} (ID: ${email.id})\n`;
                });
              }

              if (
                data.confirmationEmails &&
                data.confirmationEmails.length > 0
              ) {
                summary += `\n**Confirmation Emails (${data.confirmationEmails.length}):**\n`;
                data.confirmationEmails.forEach((email: any) => {
                  summary += `• ${email.name} (ID: ${email.id})\n`;
                });
              }

              responseText = summary;
            }
          }
        }
      }

      // Create response envelope
      const responseEnvelope: TConversationTextMessageEnvelope = {
        messageId: `response-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `response-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload:
              responseText ||
              'I processed your request but have no response to provide.',
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(responseText),
        },
      };

      // Send the response to Slack if we have a callback
      if (this.currentCallback) {
        this.logger.log(
          `Sending response to Slack: ${responseEnvelope.envelopePayload.content.payload}`,
        );
        this.currentCallback(responseEnvelope);
        // Mark that we've sent a final response to prevent duplicate from monitoring
        this.hasSentFinalResponse = true;
      } else {
        this.logger.warn('No callback available to send response to Slack');
      }
    } catch (error) {
      this.logger.error('Error processing request asynchronously:', error);
      // Update tool status to indicate error
      this.updateToolStatus('request-processing', 'error');
    }
  }

  /**
   * Stop all active monitoring
   */
  public stopMonitoring(): void {
    this.isActivelyListeningForResponse = false;
    this.activeMonitoringIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.activeMonitoringIntervals.clear();
    this.toolStatus = { executing: [], completed: [], errors: [] };
    this.readMessageIds.clear();
    this.lastToolResults = [];
    this.currentCallback = null;
    this.hasSentFinalResponse = false;
    this.logger.log('All monitoring stopped');
  }
}
