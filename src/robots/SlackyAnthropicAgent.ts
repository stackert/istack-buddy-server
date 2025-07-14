import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import Anthropic from '@anthropic-ai/sdk';
import { slackyToolSet } from './tool-definitions/slacky';

/**
 * Slack-specific Anthropic Claude Chat Robot implementation
 * Specialized for Slack integration with comprehensive tool support
 */
export class SlackyAnthropicAgent extends AbstractRobotChat {
  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 200000;
  public readonly LLModelName: string = 'claude-3-5-sonnet-20241022';
  public readonly LLModelVersion: string = '20241022';
  public readonly name: string = 'SlackyAnthropicAgent';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort =
    'Slack-specialized Anthropic Claude agent with Slacky tools for Intellistack Forms Core troubleshooting';
  static descriptionLong = `This robot provides advanced Slack integration with Anthropic's Claude API, specialized for Intellistack Forms Core troubleshooting. It includes Slacky tool support for Sumo Logic queries and SSO auto-fill assistance. Optimized for Slack conversations with immediate responses and focused troubleshooting capabilities.`;

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
 🔍 **Analysis Tools:**
 - Sumo Logic Queries - for analyzing logs and submission data
 
 🔐 **SSO & Security:**
 - SSO Auto-fill Assistance - troubleshooting SSO configuration and auto-fill mapping issues

**Communication Style for Slack:**
- Be helpful and professional yet conversational
- Use bullet points and clear formatting
- Include relevant emojis to enhance readability
- Provide step-by-step guidance when appropriate
- If you're unsure about something, say so rather than guessing

**Tool Usage:**
- Use tools when they would be helpful for the user's question
- Always explain what you're doing with tools
- Provide context for tool results
- Follow up with actionable next steps

Ready to help with your Intellistack Forms Core questions! 🚀


MUST SIGN ALL MESSAGES WITH 'Slacky ~ your iStack Slack Buddy (iStackSlacky)'

`;

  // Tool definitions for Anthropic API - using slacky tool set only
  private readonly tools: Anthropic.Messages.Tool[] =
    slackyToolSet.toolDefinitions;

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
   * Execute a tool call using the slacky tool set
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
  ): Promise<string> {
    try {
      const result = await slackyToolSet.executeToolCall(toolName, toolArgs);

      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error) {
      console.error(`❌ Error executing tool ${toolName}:`, error);
      return `❌ Error executing tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Stream response from Anthropic API
   */
  public async acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    const client = this.getClient();
    const request = this.createAnthropicMessageRequest(messageEnvelope);

    try {
      const stream = await client.messages.create({
        model: request.model,
        max_tokens: request.max_tokens,
        system: request.system,
        messages: request.messages,
        tools: request.tools,
        stream: true,
      });

      let fullResponse = '';
      let toolUse: any = null;

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'tool_use') {
            toolUse = {
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              input: {},
            };
          }
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            const textChunk = chunk.delta.text;
            fullResponse += textChunk;
            chunkCallback(textChunk);
          } else if (chunk.delta.type === 'input_json_delta') {
            if (toolUse && chunk.delta.partial_json) {
              toolUse.input = Object.assign(
                toolUse.input || {},
                chunk.delta.partial_json,
              );
            }
          }
        } else if (chunk.type === 'content_block_stop') {
          if (toolUse) {
            // Execute tool and stream the result
            const toolResult = await this.executeToolCall(
              toolUse.name,
              toolUse.input,
            );

            // Stream the tool result
            const formattedResult = `\n\n**Tool Result (${toolUse.name}):**\n${toolResult}`;
            fullResponse += formattedResult;
            chunkCallback(formattedResult);

            toolUse = null;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in stream response:', error);
      const errorMessage = `❌ Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`;
      chunkCallback(errorMessage);
    }
  }

  /**
   * Get immediate response from Anthropic API
   */
  public async acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    const client = this.getClient();
    const request = this.createAnthropicMessageRequest(messageEnvelope);

    try {
      const response = (await client.messages.create(
        request,
      )) as Anthropic.Messages.Message;

      let responseText = '';
      let toolResults: string[] = [];

      for (const content of response.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          // Execute the tool
          const toolResult = await this.executeToolCall(
            content.name,
            content.input,
          );
          toolResults.push(`\n\n**Tool: ${content.name}**\n${toolResult}`);
        }
      }

      // Combine response text with tool results
      const finalResponse = responseText + toolResults.join('');

      return {
        messageId: `slacky-response-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `slacky-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: finalResponse,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(finalResponse),
        },
      };
    } catch (error) {
      console.error('❌ Error in immediate response:', error);
      const errorMessage = `❌ Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`;

      return {
        messageId: `slacky-error-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `slacky-error-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: errorMessage,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(errorMessage),
        },
      };
    }
  }

  /**
   * Get multi-part response from Anthropic API with delayed callback
   */
  public async acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (
      response: TConversationTextMessageEnvelope,
    ) => void,
  ): Promise<TConversationTextMessageEnvelope> {
    const client = this.getClient();
    const request = this.createAnthropicMessageRequest(messageEnvelope);

    try {
      const response = (await client.messages.create(
        request,
      )) as Anthropic.Messages.Message;

      let responseText = '';
      let toolResults: string[] = [];

      for (const content of response.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          // Execute the tool
          const toolResult = await this.executeToolCall(
            content.name,
            content.input,
          );
          toolResults.push(`\n\n**Tool: ${content.name}**\n${toolResult}`);

          // Send each tool result as a delayed message
          const toolResponse: TConversationTextMessageEnvelope = {
            messageId: `slacky-tool-${Date.now()}-${Math.random()}`,
            requestOrResponse: 'response',
            envelopePayload: {
              messageId: `slacky-tool-msg-${Date.now()}-${Math.random()}`,
              author_role: 'assistant',
              content: {
                type: 'text/plain',
                payload: `**Tool: ${content.name}**\n${toolResult}`,
              },
              created_at: new Date().toISOString(),
              estimated_token_count: this.estimateTokens(toolResult),
            },
          };

          delayedMessageCallback(toolResponse);
        }
      }

      // Return the main response
      const finalResponse = responseText;

      return {
        messageId: `slacky-multipart-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `slacky-multipart-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: finalResponse,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(finalResponse),
        },
      };
    } catch (error) {
      console.error('❌ Error in multi-part response:', error);
      const errorMessage = `❌ Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`;

      return {
        messageId: `slacky-multipart-error-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `slacky-multipart-error-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: errorMessage,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(errorMessage),
        },
      };
    }
  }
}
