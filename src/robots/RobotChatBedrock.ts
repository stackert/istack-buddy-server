import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { anthropicToolSet } from './tool-definitions/toolCatalog';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

/**
 * AWS Bedrock Claude Chat Robot implementation
 * Connects to AWS Bedrock for Claude chat functionality with tool support
 */
export class RobotChatBedrock extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService('RobotChatBedrock');

  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 200000;
  public readonly LLModelName: string =
    'anthropic.claude-3-5-sonnet-20240620-v1:0';
  public readonly LLModelVersion: string = '20240620';
  public readonly name: string = 'RobotChatBedrock';
  public readonly version: string = '1.0.0';

  // Store conversation history for context
  private conversationHistory: IConversationMessage[] = [];

  // Static descriptions
  static descriptionShort =
    'AWS Bedrock Claude chat robot for intelligent conversations and troubleshooting with tool support';
  static descriptionLong =
    "This robot provides advanced chat functionality using AWS Bedrock's Claude API. It specializes in Intellistack Forms Core troubleshooting, supports both streaming and immediate responses, and can handle complex technical questions. Includes tools for Sumo Logic queries and SSO auto-fill assistance.";

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

  // Tool definitions for Bedrock API
  private readonly tools: any[] = anthropicToolSet.toolDefinitions;

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
   * Get Bedrock client with AWS credentials from environment
   */
  private getClient(): BedrockRuntimeClient {
    const region = process.env.AWS_REGION || 'us-east-1';

    return new BedrockRuntimeClient({
      region: region,
    });
  }

  /**
   * Convert our message envelope to Bedrock format with conversation history
   */
  private createBedrockMessageRequest(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): any {
    const userMessage = messageEnvelope.envelopePayload.content.payload;
    const messages = this.buildClaudeMessageHistory(userMessage);

    return {
      modelId: this.LLModelName,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        system: this.robotRole,
        messages: messages,
        tools: this.tools,
      }),
    };
  }

  /**
   * Execute tool calls based on tool name and arguments
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
  ): Promise<string> {
    this.logger.debug(`Executing tool: ${toolName}`, { toolArgs });
    try {
      const result = anthropicToolSet.executeToolCall(toolName, toolArgs);
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

  /**
   * Handle streaming response using Bedrock's streaming API
   */
  public async acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    try {
      const client = this.getClient();
      const request = this.createBedrockMessageRequest(messageEnvelope);

      // Note: Bedrock streaming is more complex and requires different handling
      // For now, we'll use the immediate response and simulate streaming
      const response = await client.send(new InvokeModelCommand(request));
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Extract text content and handle tool use
      let responseText = '';
      const toolUses: any[] = [];

      for (const content of responseBody.content) {
        if (content.type === 'text') {
          responseText += content.text;
          chunkCallback(content.text);
        } else if (content.type === 'tool_use') {
          toolUses.push(content);
        }
      }

      // Process any tool calls that were made
      for (const toolUse of toolUses) {
        try {
          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolUse.input,
          );
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
   * Handle immediate response using Bedrock's invoke API
   */
  public async acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    try {
      const client = this.getClient();
      const request = this.createBedrockMessageRequest(messageEnvelope);

      const response = await client.send(new InvokeModelCommand(request));
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Extract text content and handle tool use
      let responseText = '';
      const toolUses: any[] = [];

      for (const content of responseBody.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          toolUses.push(content);
        }
      }

      this.logger.debug(
        `Initial robot response text (${responseText.length} chars)`,
        {
          responseText:
            responseText.substring(0, 200) +
            (responseText.length > 200 ? '...' : ''),
        },
      );
      this.logger.debug(`Found ${toolUses.length} tool calls to execute`);

      // Execute any tool calls
      for (const toolUse of toolUses) {
        this.logger.debug(`=== TOOL CALL ${toolUse.name} ===`);
        this.logger.debug(`Tool input`, { input: toolUse.input });

        try {
          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolUse.input,
          );
          this.logger.debug(`Tool result (${toolResult.length} chars)`, {
            toolResult:
              toolResult.substring(0, 200) +
              (toolResult.length > 200 ? '...' : ''),
          });
          responseText += `\n\n${toolResult}`;
        } catch (error) {
          const errorMsg = `Error executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.logger.error(`Tool execution error: ${errorMsg}`);
          responseText += `\n\n${errorMsg}`;
        }
        this.logger.debug(`=== END TOOL CALL ${toolUse.name} ===`);
      }

      this.logger.debug(`Final robot response (${responseText.length} chars)`, {
        responseText:
          responseText.substring(0, 200) +
          (responseText.length > 200 ? '...' : ''),
      });

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
        const followUpRequest = this.createBedrockMessageRequest({
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
        const followUpResponse = await client.send(
          new InvokeModelCommand(followUpRequest),
        );
        const followUpBody = JSON.parse(
          new TextDecoder().decode(followUpResponse.body),
        );

        let followUpText = '';
        for (const content of followUpBody.content) {
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
