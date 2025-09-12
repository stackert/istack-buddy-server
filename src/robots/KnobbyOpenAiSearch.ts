import { OpenAI } from 'openai';
import type { TConversationMessageContent } from '../ConversationLists/types';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AbstractRobotChat } from './AbstractRobotChat';
import type {
  IStreamingCallbacks,
  TConversationMessageContentString,
} from './types';
import {
  IntentParsingResult,
  IntentData,
} from '../common/types/intent-parsing.types';

/**
 * Knowledge Search OpenAI Robot implementation
 * Specialized for knowledge base searches across SLACK and CONTEXT-DOCUMENTS
 */
export class KnobbyOpenAiSearch extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService();
  protected conversationHistory: IConversationMessage[] = [];

  constructor() {
    super();
    this.logger.log('KnobbyOpenAiSearch constructor called - class loaded');
  }

  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 128000; // GPT-4 context window
  public readonly LLModelName: string = 'gpt-4o-mini';
  public readonly LLModelVersion: string = 'gpt-4o-mini-2024-07-18';
  public readonly name: string = 'KnobbyOpenAiSearch';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort =
    'Knowledge search specialist using Information Services for SLACK and CONTEXT-DOCUMENTS';
  static descriptionLong = `This robot specializes in knowledge base searches across SLACK conversations and CONTEXT-DOCUMENTS. It uses Information Services API to perform semantic searches, keyword searches, and provides contextual recommendations. Optimized for finding relevant information and providing synthesized responses with proper citations.`;

  // Robot role/system prompt - specialized for knowledge search
  private readonly robotRole = `
You are KnobbyOpenAiSearch, a specialized AI assistant for knowledge base searches within Intellistack Forms Core.

**Your Primary Function:**
- Process structured knowledge base search results
- Synthesize information from multiple sources (SLACK conversations, CONTEXT-DOCUMENTS)
- Provide helpful responses with proper citations
- Focus on accuracy and relevance

**Your Knowledge Sources:**
- SLACK: Historical conversations and troubleshooting discussions
- CONTEXT-DOCUMENTS: Help articles, configuration guides, technical documentation

**Response Guidelines:**
- Synthesize information from provided search results
- Always cite sources when referencing specific information
- If search results are not relevant, acknowledge this clearly
- Provide structured, actionable responses
- End with positive affirmation and feedback request as instructed

**Important:**
- You receive pre-processed search results with confidence scores
- Focus on high-confidence results for accuracy
- Use technical observations when available
- Maintain professional, helpful tone
`;

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

    if (!apiKey || apiKey === '_OPEN_AI_KEY_') {
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
   * Convert our message to OpenAI format
   */
  private createOpenAIMessageRequest(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): OpenAI.Chat.Completions.ChatCompletionCreateParams {
    const userMessage = message.content.payload;

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
      author: msg.role === 'user' ? 'user' : 'system',
      content: msg.content.substring(0, 200) + '...',
    }));

    this.logger.debug(
      'Conversation being sent to KnobbyOpenAiSearch:',
      conversationForLog,
    );

    return {
      model: this.LLModelName,
      max_tokens: 1500,
      messages,
      temperature: 0.7,
    };
  }

  /**
   * Handle streaming response using OpenAI's streaming API
   */
  public async acceptMessageStreamResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage[],
  ): Promise<void> {
    try {
      const client = this.getClient();

      // Use getHistory callback if provided, otherwise fall back to internal conversationHistory
      const history = getHistory ? getHistory() : this.conversationHistory;
      const messages = this.buildOpenAIMessageHistory(
        message.content.payload as string,
        history,
      );

      // Call onStreamStart if provided
      if (callbacks.onStreamStart) {
        callbacks.onStreamStart(message);
      }

      const stream = await client.chat.completions.create({
        model: this.LLModelName,
        max_tokens: 1500,
        messages: [
          {
            role: 'system' as const,
            content: this.robotRole,
          },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
      });

      let accumulatedContent = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          accumulatedContent += delta.content;

          // Call onStreamChunkReceived if provided
          if (callbacks.onStreamChunkReceived) {
            callbacks.onStreamChunkReceived(delta.content);
          }
        }
      }

      // Prepare the final response
      const responseMessage: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      > = {
        content: {
          type: 'text/plain',
          payload: accumulatedContent,
        },
      };

      // Call onFullMessageReceived if provided
      if (callbacks.onFullMessageReceived) {
        callbacks.onFullMessageReceived(responseMessage);
      }

      this.logger.log('KnobbyOpenAiSearch response completed');
    } catch (error) {
      this.logger.error('Error in KnobbyOpenAiSearch streaming:', error);
      if (callbacks.onError) {
        callbacks.onError(error);
      }
    }
  }

  /**
   * Build OpenAI message history from conversation messages
   */
  private buildOpenAIMessageHistory(
    currentMessage: string,
    history: IConversationMessage[],
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add recent history (last 10 messages)
    const recentHistory = history.slice(-10);

    for (const msg of recentHistory) {
      if (msg.content.type === 'text/plain') {
        const role = this.mapUserRoleToOpenAIRole(msg.fromRole);
        messages.push({
          role,
          content: msg.content.payload,
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
   * Map our UserRole to OpenAI role
   */
  private mapUserRoleToOpenAIRole(
    userRole: UserRole,
  ): 'user' | 'assistant' | 'system' {
    switch (userRole) {
      case UserRole.USER: // Covers CUSTOMER, AGENT, SUPERVISOR
        return 'user';
      case UserRole.ROBOT:
        return 'assistant';
      case UserRole.SYSTEM:
        return 'system';
      default:
        return 'user';
    }
  }

  /**
   * Handle immediate response (required by AbstractRobotChat)
   */
  public async acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  > {
    try {
      const client = this.getClient();
      const request = this.createOpenAIMessageRequest(message, getHistory);

      const completion = await client.chat.completions.create({
        ...request,
        stream: false,
      });
      const responseContent =
        (completion as any).choices[0]?.message?.content ||
        'No response generated';

      return {
        content: {
          type: 'text/plain',
          payload: responseContent,
        },
      };
    } catch (error) {
      this.logger.error('Error in immediate response:', error);
      return {
        content: {
          type: 'text/plain',
          payload: `Error generating response: ${error.message}`,
        },
      };
    }
  }

  /**
   * Execute intent (required by AbstractRobotChat)
   */
  public async executeIntent(
    intentData: IntentData,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    this.logger.log('KnobbyOpenAiSearch executing intent:', intentData.intent);

    // Create a message from the intent data
    const message: IConversationMessage<TConversationMessageContentString> = {
      id: `intent-${Date.now()}`,
      conversationId: (callbacks as any).conversationId || 'unknown',
      content: {
        type: 'text/plain',
        payload: intentData.originalUserPrompt,
      },
      authorUserId: null,
      fromRole: UserRole.USER,
      toRole: UserRole.ROBOT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Delegate to the streaming response handler
    await this.acceptMessageStreamResponse(message, callbacks);
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
      const immediateResponse: TConversationMessageContentString = {
        type: 'text/plain',
        payload: 'Processing your knowledge base search...',
      };

      // Get the full response
      const fullResponse = await this.acceptMessageImmediateResponse(
        message,
        getHistory,
      );

      // Call the delayed callback with the full response
      delayedMessageCallback(fullResponse);

      return immediateResponse;
    } catch (error) {
      this.logger.error('Error in multi-part response:', error);
      const errorResponse: TConversationMessageContentString = {
        type: 'text/plain',
        payload: `Error: ${error.message}`,
      };
      delayedMessageCallback({ content: errorResponse });
      return errorResponse;
    }
  }

  /**
   * Handle intent with tools (compatibility method)
   * For KnobbyOpenAiSearch, this delegates to executeIntent
   */
  public async handleIntentWithTools(
    intentData: IntentData,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage[],
  ): Promise<void> {
    await this.executeIntent(intentData, callbacks);
  }
}
