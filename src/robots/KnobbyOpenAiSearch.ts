import { OpenAI } from 'openai';
import type { TConversationMessageContent } from '../ConversationLists/types';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AbstractRobotChat } from './AbstractRobotChat';
import type { IntentData } from '../common/types/intent-parsing.types';
import { knobbySearchToolSet } from './tool-definitions/knobby-search';
import type {
  IStreamingCallbacks,
  TConversationMessageContentString,
} from './types';

// Helper functions
const noOp = (...args: any[]) => {};

/**
 * KnobbyOpenAiSearch - Specialized OpenAI robot for Information Services search
 * Provides intelligent search capabilities across multiple knowledge bases
 */
export class KnobbyOpenAiSearch extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService();

  constructor() {
    super();
    this.logger.log('KnobbyOpenAiSearch constructor called - class loaded');
  }

  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 128000;
  public readonly LLModelName: string = 'gpt-4o';
  public readonly LLModelVersion: string = 'gpt-4o-2024-05-13';
  public readonly name: string = 'KnobbyOpenAiSearch';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort = `
    AI-powered search interface for Information Services knowledge bases.
    Provides intelligent query analysis and formatted search results.
  `;

  static descriptionLong = `
    KnobbyOpenAiSearch is a specialized search robot that interfaces with the 
    Information Services API to provide comprehensive search capabilities across
    multiple knowledge bases (SLACK, CONTEXT-DOCUMENTS, CONTEXT-DYNAMIC).
    
    Features:
    - Intelligent query preprocessing and analysis
    - Multi-strategy search execution (keyword, semantic, domain, etc.)
    - Formatted result presentation with confidence scores
    - Support for filtered searches by channels and domains
  `;

  // Robot role/system prompt
  private readonly robotRole = `
You are KnobbyOpenAiSearch. You search Formstack's knowledge bases using the available search tools.

CRITICAL RULES:
1. You MUST use tools to search. Always use knobby_search_comprehensive for queries.
2. Follow the user's exact instructions. If they ask for document counts, IDs, confidence scores, or specific formats - provide exactly what they request from the tool results.
3. For JSON intent parsing requests: NEVER make assumptions. If a value is unclear or missing, leave it blank or return an error as instructed.

INTENT PARSING MODE:
When the user asks you to parse intent or return JSON:
- Follow their exact parsing instructions
- NEVER make assumptions about unclear values  
- NEVER fill in missing information
- CRITICAL: If dates are ambiguous (missing year like "july 5", unclear timeframe), return error immediately
- CRITICAL: If any required value is unclear, return: {"error": "No intent can be determined", "reason": "explain what was unclear"}  
- CRITICAL: For dates without year like "july 5 until july 10", return error - do not assume year
- CRITICAL: Never use past years (2023, 2024) - if calculating dates, use current year (2025)
- CRITICAL: Follow "MAKE NO ASSUMPTIONS" and "RETURN AN ERROR" instructions literally
- Leave fields blank ("") when values are unknown or ambiguous

Available knowledge bases: SLACK, CONTEXT-DOCUMENTS, CONTEXT-DYNAMIC.

Extract information from tool results using these property names:
- conversation_id (for SLACK results)
- context_document_id (for CONTEXT-DOCUMENTS results)  
- conversationText, contextDocumentText (content)
- confidence (confidence scores)
- channelId (source channel)
- citations.text and citations.link (new citation information)

Do not add your own instructions. Use the user's exact prompt and provide exactly what they ask for.
`;

  // Tool definitions for OpenAI API
  private readonly tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
    knobbySearchToolSet.toolDefinitions;

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
   * Convert our message format to OpenAI format
   */
  private createOpenAIMessageRequest(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): OpenAI.Chat.Completions.ChatCompletionCreateParams {
    // Ensure we have a valid string message
    const userMessage = typeof message.content.payload === 'string' 
      ? message.content.payload 
      : String(message.content.payload || 'Empty message');

    this.logger.debug('Processing user message:', { 
      originalPayload: message.content.payload,
      processedMessage: userMessage 
    });

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
      content: msg.content?.substring(0, 100) + '...' || 'No content',
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
   * Execute tool calls for search operations
   */
  private async executeToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
  ): Promise<string[]> {
    const results: string[] = [];

    for (const toolCall of toolCalls) {
      try {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        this.logger.debug(`Executing tool: ${toolName}`, toolArgs);

        const result = await knobbySearchToolSet.executeToolCall(
          toolName,
          toolArgs,
        );

        results.push(`Tool: ${toolName}\nResult: ${result}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('KnobbyOpenAiSearch', `Tool execution error: ${errorMessage}`);
        results.push(`Tool error: ${errorMessage}`);
      }
    }

    return results;
  }

  /**
   * Handle streaming response with tool calls
   */
  public async acceptMessageStreamResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<void> {
    this.logger.debug('=== KNOBBY SEARCH acceptMessageStreamResponse START ===');

    try {
      const client = this.getClient();
      const requestParams = this.createOpenAIMessageRequest(message, getHistory);

      const stream = await client.chat.completions.create({
        ...requestParams,
        stream: true,
      });

      let accumulatedContent = '';
      const toolCalls: any[] = [];
      let currentToolCall: any = null;

      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices.length > 0) {
          const choice = chunk.choices[0];
          
          if (choice.delta?.content) {
            accumulatedContent += choice.delta.content;
            callbacks.onStreamChunkReceived(choice.delta.content);
          }

          if (choice.delta?.tool_calls) {
            // Handle tool calls in streaming
            for (const toolCallDelta of choice.delta.tool_calls) {
              if (toolCallDelta.index !== undefined) {
                if (!toolCalls[toolCallDelta.index]) {
                  toolCalls[toolCallDelta.index] = {
                    id: toolCallDelta.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' }
                  };
                }
                currentToolCall = toolCalls[toolCallDelta.index];
                
                if (toolCallDelta.function?.name) {
                  currentToolCall.function.name += toolCallDelta.function.name;
                }
                if (toolCallDelta.function?.arguments) {
                  currentToolCall.function.arguments += toolCallDelta.function.arguments;
                }
              }
            }
          }
        }
      }

      // Execute tool calls if any and continue conversation with OpenAI
      if (toolCalls.length > 0) {
        callbacks.onStreamChunkReceived('\n\nExecuting search...\n');
        const toolResults = await this.executeToolCalls(toolCalls);
        
        // Now send the tool results back to OpenAI for processing
        const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: this.robotRole },
          { role: 'user', content: message.content.payload },
          { role: 'assistant', content: accumulatedContent, tool_calls: toolCalls },
          ...toolResults.map((result, index) => ({
            role: 'tool' as const,
            content: result,
            tool_call_id: toolCalls[index]?.id || `call_${index}`
          }))
        ];

        // Get OpenAI's conversational response to the tool results
        const followUpStream = await client.chat.completions.create({
          model: this.LLModelName,
          messages: conversationMessages,
          stream: true,
          temperature: 0.1,
          max_tokens: 4000
        });

        let finalResponse = '';
        for await (const chunk of followUpStream) {
          if (chunk.choices[0]?.delta?.content) {
            const content = chunk.choices[0].delta.content;
            finalResponse += content;
            callbacks.onStreamChunkReceived(content);
          }
        }

        callbacks.onFullMessageReceived({
          content: { payload: finalResponse, type: 'text/plain' }
        });
      } else {
        callbacks.onFullMessageReceived({
          content: { payload: accumulatedContent, type: 'text/plain' }
        });
      }
    } catch (error) {
      this.logger.error('KnobbyOpenAiSearch', `Error in acceptMessageStreamResponse: ${error instanceof Error ? error.message : 'Unknown error'}`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      callbacks.onError?.(new Error(`KnobbyOpenAiSearch error: ${errorMessage}`));
    }

    this.logger.debug('=== KNOBBY SEARCH acceptMessageStreamResponse END ===');
  }

  /**
   * Handle immediate response (non-streaming)
   */
  public async acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<Pick<IConversationMessage<TConversationMessageContentString>, 'content'>> {
    this.logger.debug('=== KNOBBY SEARCH acceptMessageImmediateResponse START ===');

    try {
      const client = this.getClient();
      const requestParams = this.createOpenAIMessageRequest(message, getHistory);

      // Check if this is a JSON intent parsing request
      const isJsonRequest = message.content.payload.toLowerCase().includes('return') && 
                            message.content.payload.toLowerCase().includes('json') &&
                            (message.content.payload.toLowerCase().includes('intent') || 
                             message.content.payload.toLowerCase().includes('object'));

      const completionConfig = { ...requestParams };

      // Force JSON response for intent parsing requests
      if (isJsonRequest) {
        completionConfig.response_format = { type: "json_object" };
        this.logger.debug('Using JSON response format for intent parsing request (immediate)');
      }

      const completion = await client.chat.completions.create(completionConfig);

      let responseContent = '';
      
      // Type guard to ensure we have a ChatCompletion response (not streaming)
      if ('choices' in completion && completion.choices && completion.choices.length > 0) {
        const choice = completion.choices[0];

        if (choice.message.content) {
          responseContent = choice.message.content;
        }

        // Handle tool calls if present
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          this.logger.debug('Executing tool calls for immediate response');
          const toolResults = await this.executeToolCalls(choice.message.tool_calls);
          
          // Send tool results back to OpenAI for processing into conversational response
          const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: this.robotRole },
            { role: 'user', content: message.content.payload },
            { role: 'assistant', content: responseContent, tool_calls: choice.message.tool_calls },
            ...toolResults.map((result, index) => ({
              role: 'tool' as const,
              content: result,
              tool_call_id: choice.message.tool_calls![index]?.id || `call_${index}`
            }))
          ];

          // Get OpenAI's conversational response to the tool results
          const followUpCompletion = await client.chat.completions.create({
            model: this.LLModelName,
            messages: conversationMessages,
            temperature: 0.1,
            max_tokens: 4000
          });

          if ('choices' in followUpCompletion && followUpCompletion.choices[0]?.message?.content) {
            responseContent = followUpCompletion.choices[0].message.content;
          }
        }
      }

      const result = {
        content: {
          type: 'text/plain' as const,
          payload: responseContent || 'No response generated.',
        },
      };

      this.logger.debug('=== KNOBBY SEARCH acceptMessageImmediateResponse END ===');
      return result;
    } catch (error) {
      this.logger.error('KnobbyOpenAiSearch', `Error in acceptMessageImmediateResponse: ${error instanceof Error ? error.message : 'Unknown error'}`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        content: {
          type: 'text/plain' as const,
          payload: `KnobbyOpenAiSearch encountered an error: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Handle multi-part response (required by AbstractRobot)
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
    try {
      // Get the immediate response
      const response = await this.acceptMessageImmediateResponse(message, getHistory);
      
      // Call the delayed callback with the response
      delayedMessageCallback(response);
      
      // Return the content for the return value
      return response.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('KnobbyOpenAiSearch', `Error in acceptMessageMultiPartResponse: ${errorMessage}`);
      
      const errorContent = {
        type: 'text/plain' as const,
        payload: `KnobbyOpenAiSearch encountered an error: ${errorMessage}`,
      };
      
      // Call the delayed callback with error response
      delayedMessageCallback({ content: errorContent });
      
      return errorContent;
    }
  }

  /**
   * Get version for robot service registration
   */
  public getVersion(): string {
    return this.version;
  }

  /**
   * NEW universal method for intent-based processing
   * Phase 1: Just use existing acceptMessageStreamResponse method
   */
  async handleIntentWithTools(
    intentData: IntentData,
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks
  ): Promise<void> {
    // Phase 1: Just use existing method (ignore intent data for now)
    return this.acceptMessageStreamResponse(message, callbacks);
  }
}
