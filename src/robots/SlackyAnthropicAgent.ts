import { AbstractRobotChat } from './AbstractRobotChat';
import type { TConversationTextMessageEnvelope } from './types';
import Anthropic from '@anthropic-ai/sdk';
import { slackyToolSet } from './tool-definitions/slacky';
import {
  marvToolDefinitions,
  performMarvToolCall,
  FsRestrictedApiRoutesEnum,
} from './tool-definitions/marv';

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
 🔍 **Analysis Tools:**
 - Sumo Logic Queries - for analyzing logs and submission data
 
 🔐 **SSO & Security:**
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
`;

  // Selected Marv tools (just the 3 we want)
  private readonly selectedMarvTools: Anthropic.Messages.Tool[] =
    marvToolDefinitions.filter(
      (tool) =>
        tool.name === FsRestrictedApiRoutesEnum.FormLogicValidation ||
        tool.name === FsRestrictedApiRoutesEnum.FormCalculationValidation ||
        tool.name === FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
    );

  // Composite tool definitions - slacky tools + selected marv tools
  private readonly tools: Anthropic.Messages.Tool[] = [
    ...slackyToolSet.toolDefinitions,
    ...this.selectedMarvTools,
  ];

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
   * Execute a tool call using both slacky and marv tool executors
   */
  private async executeToolCall(
    toolName: string,
    toolArgs: any,
  ): Promise<string> {
    try {
      // Try slacky tools first
      const slackyResult = slackyToolSet.executeToolCall(toolName, toolArgs);
      if (slackyResult !== undefined) {
        const result = await slackyResult;
        return typeof result === 'string' ? result : JSON.stringify(result);
      }

      // If slacky doesn't handle it, try marv tools (for our 3 selected tools)
      if (
        toolName === FsRestrictedApiRoutesEnum.FormLogicValidation ||
        toolName === FsRestrictedApiRoutesEnum.FormCalculationValidation ||
        toolName === FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview
      ) {
        const marvResult = await performMarvToolCall(toolName, toolArgs);
        return typeof marvResult === 'string'
          ? marvResult
          : JSON.stringify(marvResult);
      }

      // No executor handled this tool
      throw new Error(`Unknown tool: ${toolName}`);
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Stream response from Anthropic API with proper tool result handling
   */
  public async acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    const client = this.getClient();
    const userMessage = messageEnvelope.envelopePayload.content.payload;

    try {
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

      for (const content of initialResponse.content) {
        if (content.type === 'text') {
          responseText += content.text;
        } else if (content.type === 'tool_use') {
          toolUses.push(content);
        }
      }

      // If no tools were used, stream the response directly
      if (toolUses.length === 0) {
        chunkCallback(responseText);
        return;
      }

      // Stream initial response if any
      if (responseText) {
        chunkCallback(responseText);
      }

      // Execute tools and collect results
      const toolResultMessages: any[] = [];

      for (const toolUse of toolUses) {
        try {
          chunkCallback(`\n\n🔧 Executing ${toolUse.name}...`);
          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolUse.input,
          );

          // Stream raw tool result for user visibility
          chunkCallback(`\n\n**Tool: ${toolUse.name}**\n${toolResult}`);

          // Collect for Claude processing
          toolResultMessages.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: toolResult,
          });
        } catch (error) {
          const errorMsg = `Error executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;

          // Stream raw error for user visibility
          chunkCallback(`\n\n**Tool Error: ${toolUse.name}**\n${errorMsg}`);

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
      chunkCallback('\n\n---\n\n**Analysis:**\n');

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
          {
            role: 'user',
            content: toolResultMessages,
          },
        ],
        stream: true,
      });

      // Stream the final response
      for await (const chunk of finalStream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          chunkCallback(chunk.delta.text);
        }
      }
    } catch (error) {
      const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
      chunkCallback(errorMessage);
      throw error;
    }
  }

  /**
   * Get immediate response from Anthropic API with proper tool result handling
   */
  public async acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    const client = this.getClient();
    const userMessage = messageEnvelope.envelopePayload.content.payload;

    try {
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
          messageId: `slacky-response-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `slacky-msg-${Date.now()}`,
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

      // Execute tools and collect results
      const toolResultMessages: any[] = [];
      let rawToolResults = '';

      for (const toolUse of toolUses) {
        try {
          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolUse.input,
          );

          // Collect raw results for user visibility
          rawToolResults += `\n\n**Tool: ${toolUse.name}**\n${toolResult}`;

          // Collect for Claude processing
          toolResultMessages.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: toolResult,
          });
        } catch (error) {
          const errorMsg = `Error executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;

          // Collect raw error for user visibility
          rawToolResults += `\n\n**Tool Error: ${toolUse.name}**\n${errorMsg}`;

          // Collect for Claude processing
          toolResultMessages.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: errorMsg,
            is_error: true,
          });
        }
      }

      // Send follow-up request to Claude with tool results for final processing
      const finalResponse = (await client.messages.create({
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
          {
            role: 'user',
            content: toolResultMessages,
          },
        ],
      })) as Anthropic.Messages.Message;

      // Extract final response text from Claude
      let claudeInterpretation = '';
      for (const content of finalResponse.content) {
        if (content.type === 'text') {
          claudeInterpretation += content.text;
        }
      }

      // Combine: initial response + raw tool results + Claude's interpretation
      const combinedResponse =
        responseText +
        rawToolResults +
        (claudeInterpretation
          ? `\n\n---\n\n**Analysis:**\n${claudeInterpretation}`
          : '');

      return {
        messageId: `slacky-response-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `slacky-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: combinedResponse,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(combinedResponse),
        },
      };
    } catch (error) {
      console.error('Error in immediate response:', error);
      const errorMessage = `Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`;

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
   * Multi-part response with proper tool result handling
   */
  public async acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (
      response: TConversationTextMessageEnvelope,
    ) => void,
  ): Promise<TConversationTextMessageEnvelope> {
    const client = this.getClient();
    const userMessage = messageEnvelope.envelopePayload.content.payload;

    try {
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
          messageId: `slacky-multipart-${Date.now()}`,
          requestOrResponse: 'response',
          envelopePayload: {
            messageId: `slacky-multipart-msg-${Date.now()}`,
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

      // Execute tools and collect results, sending progress updates
      const toolResultMessages: any[] = [];

      for (const toolUse of toolUses) {
        try {
          // Send tool execution notification
          const toolStartResponse: TConversationTextMessageEnvelope = {
            messageId: `slacky-tool-start-${Date.now()}-${Math.random()}`,
            requestOrResponse: 'response',
            envelopePayload: {
              messageId: `slacky-tool-start-msg-${Date.now()}-${Math.random()}`,
              author_role: 'assistant',
              content: {
                type: 'text/plain',
                payload: `🔧 Executing ${toolUse.name}...`,
              },
              created_at: new Date().toISOString(),
              estimated_token_count: this.estimateTokens(
                `Executing ${toolUse.name}...`,
              ),
            },
          };
          delayedMessageCallback(toolStartResponse);

          const toolResult = await this.executeToolCall(
            toolUse.name,
            toolUse.input,
          );

          // Send tool result as delayed message
          const toolResponse: TConversationTextMessageEnvelope = {
            messageId: `slacky-tool-${Date.now()}-${Math.random()}`,
            requestOrResponse: 'response',
            envelopePayload: {
              messageId: `slacky-tool-msg-${Date.now()}-${Math.random()}`,
              author_role: 'assistant',
              content: {
                type: 'text/plain',
                payload: `**Tool Result (${toolUse.name}):**\n${toolResult}`,
              },
              created_at: new Date().toISOString(),
              estimated_token_count: this.estimateTokens(toolResult),
            },
          };
          delayedMessageCallback(toolResponse);

          // Collect for final Claude processing
          toolResultMessages.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: toolResult,
          });
        } catch (error) {
          const errorMsg = `Error executing tool ${toolUse.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;

          // Send error as delayed message
          const errorResponse: TConversationTextMessageEnvelope = {
            messageId: `slacky-tool-error-${Date.now()}-${Math.random()}`,
            requestOrResponse: 'response',
            envelopePayload: {
              messageId: `slacky-tool-error-msg-${Date.now()}-${Math.random()}`,
              author_role: 'assistant',
              content: {
                type: 'text/plain',
                payload: `❌ Tool Error (${toolUse.name}): ${errorMsg}`,
              },
              created_at: new Date().toISOString(),
              estimated_token_count: this.estimateTokens(errorMsg),
            },
          };
          delayedMessageCallback(errorResponse);

          // Collect for final Claude processing
          toolResultMessages.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: errorMsg,
            is_error: true,
          });
        }
      }

      // Send follow-up request to Claude with tool results for final processing
      const finalResponse = (await client.messages.create({
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
          {
            role: 'user',
            content: toolResultMessages,
          },
        ],
      })) as Anthropic.Messages.Message;

      // Extract final response text from Claude
      let finalResponseText = '';
      for (const content of finalResponse.content) {
        if (content.type === 'text') {
          finalResponseText += content.text;
        }
      }

      // Return Claude's final analysis/summary
      return {
        messageId: `slacky-multipart-${Date.now()}`,
        requestOrResponse: 'response',
        envelopePayload: {
          messageId: `slacky-multipart-msg-${Date.now()}`,
          author_role: 'assistant',
          content: {
            type: 'text/plain',
            payload: finalResponseText,
          },
          created_at: new Date().toISOString(),
          estimated_token_count: this.estimateTokens(finalResponseText),
        },
      };
    } catch (error) {
      console.error('Error in multi-part response:', error);
      const errorMessage = `Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`;

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
