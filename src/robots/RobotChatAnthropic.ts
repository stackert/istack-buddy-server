import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import Anthropic from '@anthropic-ai/sdk';
//import { slackyToolSet } from './tool-definitions/RobotChatAnthropicTools';
import { anthropicToolSet } from './tool-definitions/toolCatalog';
/**
 * Anthropic Claude Chat Robot implementation
 * Connects to Anthropic's API for real chat functionality with tool support
 */
export class RobotChatAnthropic extends AbstractRobotChat {
  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 200000;
  public readonly LLModelName: string = 'claude-3-5-sonnet-20241022';
  public readonly LLModelVersion: string = '20241022';
  public readonly name: string = 'RobotChatAnthropic';
  public readonly version: string = '1.0.0';

  // Store conversation history for context
  private conversationHistory: IConversationMessage[] = [];

  // Static descriptions
  static descriptionShort =
    'Anthropic Claude chat robot for intelligent conversations and troubleshooting with tool support';
  static descriptionLong =
    "This robot provides advanced chat functionality using Anthropic's Claude API. It specializes in Intellistack Forms Core troubleshooting, supports both streaming and immediate responses, and can handle complex technical questions. Includes tools for Sumo Logic queries and SSO auto-fill assistance.";

  // Robot role/system prompt
  private readonly robotRole = `
You are an iStackBuddy robot specializing in Intellistack Forms Core troubleshooting.

"Forms Core" is Intellistack's legacy forms product (formally known as "Formstack").

A non-exhaustive list of things we can help with:
- SSO troubleshooting (for Forms Password Protected / SSO Protected, not account access SSO)
- Form troubleshooting (logic not working as expected, form rendering issues, etc)
  Form configuration issues:
  -- Field/Section configuration
  -- Visibility Logic
  -- Calculation
- Form Integration (submitActions) issues 
- Through our collaborative efforts with other iStackBuddy robots we are able to:
  -- Trace submission from creation to Integration Runs (SubmitAction runs)
  -- Trace email send logs
  -- Submission error logs

You have access to specialized tools:
1. Sumo Logic Queries - for analyzing logs and submission data
2. SSO Auto-fill Assistance - for troubleshooting form SSO auto-fill issues
3. Form and Related Entity Overview - for getting comprehensive information about a form's configuration, statistics, and all related entities (webhooks, notifications, confirmations)

It's expected this list will grow over time.

Please provide helpful, accurate, and detailed responses to user questions. If you're unsure about something, say so rather than guessing. Use the available tools when they would be helpful for the user's question.
`;

  // Tool definitions for Anthropic API
  private readonly tools: Anthropic.Messages.Tool[] =
    anthropicToolSet.toolDefinitions;

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
   * Convert our message envelope to Anthropic format with conversation history
   */
  private createAnthropicMessageRequest(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Anthropic.Messages.MessageCreateParams {
    const userMessage = messageEnvelope.envelopePayload.content.payload;
    const messages = this.buildClaudeMessageHistory(userMessage);

    return {
      model: this.LLModelName,
      max_tokens: 1024,
      system: this.robotRole,
      messages: messages,
      tools: this.tools,
    };
  }

  /**
   * Execute tool calls based on tool name and arguments
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
  ): Promise<string> {
    console.log(`🔧 Executing tool: ${toolName} with args:`, toolArgs);
    try {
      const result = anthropicToolSet.executeToolCall(toolName, toolArgs);
      const finalResult = typeof result === 'string' ? result : await result;
      console.log(
        `Tool ${toolName} executed successfully. Result type:`,
        typeof finalResult,
      );
      const jsonResult = JSON.stringify(finalResult, null, 2);
      console.log(`📄 Complete tool result:`, jsonResult);
      return jsonResult;
    } catch (error) {
      console.error(`❌ Tool ${toolName} execution failed:`, error);
      return `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
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

      console.log(
        `📝 Initial robot response text (${responseText.length} chars):`,
        responseText,
      );
      console.log(`🔧 Found ${toolUses.length} tool calls to execute`);

      // Execute any tool calls
      for (const toolUse of toolUses) {
        console.log(`\n🎯 === TOOL CALL ${toolUse.name} ===`);
        console.log(`📥 Tool input:`, JSON.stringify(toolUse.input, null, 2));

        try {
          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolUse.input,
          );
          console.log(
            `📤 Tool result (${toolResult.length} chars):`,
            toolResult,
          );
          responseText += `\n\n${toolResult}`;
        } catch (error) {
          const errorMsg = `Error executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.log(`❌ Tool execution error:`, errorMsg);
          responseText += `\n\n${errorMsg}`;
        }
        console.log(`🏁 === END TOOL CALL ${toolUse.name} ===\n`);
      }

      console.log(
        `📋 Final robot response (${responseText.length} chars):`,
        responseText.substring(0, 500) +
          (responseText.length > 500 ? '...' : ''),
      );

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
              payload: `Follow up on: "${messageEnvelope.envelopePayload.content.payload}". Is there anything else I can help you with regarding this topic? I have tools available for Sumo Logic queries and SSO auto-fill troubleshooting if needed.`,
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
