import { OpenAI } from 'openai';
import type { TConversationMessageContent } from '../ConversationLists/types';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import {
  IConversationMessage,
  IConversationMessageAnthropic,
} from '../chat-manager/interfaces/message.interface';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AbstractRobotChat } from './AbstractRobotChat';
import type { IntentData } from '../common/types/intent-parsing.types';
import { knobbySumoToolSet } from './tool-definitions/knobby-sumo';
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
export class KnobbyOpenAiSumoReport extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService();

  constructor() {
    super();
    this.logger.log('KnobbyOpenAiSumoReport constructor called - class loaded');
  }

  // Required properties from AbstractRobot
  public readonly contextWindowSizeInTokens: number = 128000;
  public readonly LLModelName: string = 'gpt-4o';
  public readonly LLModelVersion: string = 'gpt-4o-2024-05-13';
  public readonly name: string = 'KnobbyOpenAiSumoReport';
  public readonly version: string = '1.0.0';

  // Static descriptions
  static descriptionShort = `
    Sumo Logic reporting workflows and file management robot.
    Handles async job submission, status polling, and result retrieval.
  `;

  static descriptionLong = `
    KnobbyOpenAiSumoReport manages Sumo Logic reporting workflows through the 
    Information Services API. Provides comprehensive job management across
    12 endpoints for async query execution.
    
    Features:
    - Submit Sumo Logic query jobs (submitActionReport, submissionCreatedForForm, authProviderMetrics)
    - Poll job status and handle completion
    - Retrieve and format results
    - Manage job files and cleanup
  `;

  // Prompt for parsing user requests into Sumo query parameters
  private readonly parseUserRequestPrompt = `
You are KnobbyOpenAiSumoReport, a specialized Sumo Logic reporting robot. Your ONLY job is to parse user requests and return JSON.

CRITICAL: You must return ONLY valid JSON. No explanations, no conversational text, no markdown, no code blocks. Just pure JSON.

SUPPORTED QUERY TYPES:
1. **submissionCreatedForForm** - Track form submission creation events
2. **submitActionReport** - Analyze submit action execution details  
3. **authProviderMetrics** - Monitor authentication provider activity

REQUIRED JSON OUTPUT FORMAT (return this exact structure):
{
  "queryName": "submissionCreatedForForm",
  "subject": {
    "formId": "12345",
    "startDate": "2024-01-01",
    "endDate": "2024-01-07"
  },
  "isValidationOnly": false
}

SUBJECT PARAMETERS (all optional, but at least one required):
- **formId**: Form ID for filtering (string)
- **submissionId**: Submission ID for filtering (string)
- **submitActionId**: Submit action ID for filtering (string)
- **submitActionType**: Type of submit action (webhook, salesforce, stripe, etc.)
- **authProviderId**: Authentication provider ID (string)
- **accountId**: Account ID for filtering (string)
- **message**: Specific Sumo Logic message to filter on (string)
- **startDate**: Start date in YYYY-MM-DD format (Eastern Time)
- **endDate**: End date in YYYY-MM-DD format (Eastern Time)

QUERY TYPE SELECTION:
- "submission created" / "form submissions" → submissionCreatedForForm
- "submit action" / "webhook" / "action report" → submitActionReport  
- "auth provider" / "authentication" / "login metrics" → authProviderMetrics

DATE PARSING RULES:
- "last week" → last 7 days from today
- "past month" → last 30 days from today
- "since January 1st" → from Jan 1 to today
- "from July 5th to 9th" → July 5-9 of current year
- Default: last 24 hours if no date specified
- Maximum range: 7 days
- Format: YYYY-MM-DD

EXAMPLES:
User: "Show me form submissions for form 12345 last week"
Output: {"queryName": "submissionCreatedForForm", "subject": {"formId": "12345", "startDate": "2024-01-08", "endDate": "2024-01-14"}, "isValidationOnly": false}

User: "Auth provider metrics for the past 3 days"
Output: {"queryName": "authProviderMetrics", "subject": {"startDate": "2024-01-12", "endDate": "2024-01-14"}, "isValidationOnly": false}

If you cannot parse the request, return: {"error": true, "reason": "Could not understand the request"}

REMEMBER: Return ONLY JSON. No other text.
`;

  // Main robot role - serves dual purpose
  private readonly robotRole = `
You are KnobbyOpenAiSumoReport, a specialized Sumo Logic reporting robot that serves two main purposes:

1. **PARSE USER REQUESTS**: When given a user request, parse it into Sumo Logic query parameters and return JSON
2. **ANALYZE LOG REPORTS**: When given report data, analyze it and provide insights to the user

You are an expert in:
- Sumo Logic query parameters and report types
- Log analysis and data interpretation  
- Form submission tracking and authentication metrics
- Providing actionable insights from log data

Your capabilities include:
- Parsing natural language requests into structured Sumo queries
- Analyzing log data for patterns, trends, and anomalies
- Providing clear summaries and recommendations
- Handling various report types (submissions, actions, auth metrics)

Always be helpful, accurate, and provide clear, actionable responses.
`;

  // Second prompt for reviewing results
  private readonly resultReviewPrompt = `
You are KnobbyOpenAiSumoReport reviewing Sumo Logic report results. Your job is to analyze the data and provide insights to the user.

TASK: Review the provided Sumo Logic report data and provide a helpful summary with insights.

RESPONSE FORMAT: Provide a conversational response (not JSON) that includes:
1. **Summary**: Brief overview of what the data shows
2. **Key Findings**: Important patterns, trends, or anomalies
3. **Insights**: What this means for the user
4. **Recommendations**: Any suggested actions based on the data

TONE: Professional but conversational, helpful and actionable.

Focus on making the data meaningful and useful for the user.
`;

  // Tool definitions for OpenAI API (Sumo Logic reporting tools)
  private readonly tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
    knobbySumoToolSet.toolDefinitions;

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
    const userMessage =
      typeof message.content.payload === 'string'
        ? message.content.payload
        : String(message.content.payload || 'Empty message');

    this.logger.debug('Processing user message:', {
      originalPayload: message.content.payload,
      processedMessage: userMessage,
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system' as const,
        content: this.robotRole,
      },
    ];

    // Add conversation history if provided
    if (getHistory) {
      const history = getHistory();
      this.logger.debug('Building conversation history', {
        historyLength: history.length,
      });

      for (const msg of history) {
        // Apply the transformer to convert content to text
        const transformedMsg =
          this.getGetFromRobotToConversationTransformer()(msg);
        messages.push({
          role: transformedMsg.role as 'user' | 'assistant',
          content: transformedMsg.content,
        });
      }
    }

    // Add current user message
    messages.push({
      role: 'user' as const,
      content: userMessage,
    });

    // Debug log the conversation being sent to the robot
    const conversationForLog = messages.map((msg) => ({
      author:
        msg.role === 'user'
          ? 'user'
          : msg.role === 'system'
            ? 'system'
            : 'robot',
      content:
        (typeof msg.content === 'string'
          ? msg.content.substring(0, 100)
          : String(msg.content).substring(0, 100)) + '...' || 'No content',
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

        const result = await knobbySumoToolSet.executeToolCall(
          toolName,
          toolArgs,
        );

        results.push(`Tool: ${toolName}\nResult: ${result}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          'KnobbyOpenAiSumoReport',
          `Tool execution error: ${errorMessage}`,
        );
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
    this.logger.debug('=== KNOBBY SUMO acceptMessageStreamResponse START ===');

    try {
      const client = this.getClient();
      const requestParams = this.createOpenAIMessageRequest(
        message,
        getHistory,
      );

      const streamConfig = {
        ...requestParams,
        stream: true,
      };

      const stream = await client.chat.completions.create(streamConfig);

      let accumulatedContent = '';
      const toolCalls: any[] = [];
      let currentToolCall: any = null;

      // Type assertion to handle OpenAI streaming types
      const asyncStream = stream as AsyncIterable<any>;
      for await (const chunk of asyncStream) {
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
                    function: { name: '', arguments: '' },
                  };
                }
                currentToolCall = toolCalls[toolCallDelta.index];

                if (toolCallDelta.function?.name) {
                  currentToolCall.function.name += toolCallDelta.function.name;
                }
                if (toolCallDelta.function?.arguments) {
                  currentToolCall.function.arguments +=
                    toolCallDelta.function.arguments;
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
        const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
          [
            { role: 'system', content: this.robotRole },
            { role: 'user', content: message.content.payload },
            {
              role: 'assistant',
              content: accumulatedContent,
              tool_calls: toolCalls,
            },
            ...toolResults.map((result, index) => ({
              role: 'tool' as const,
              content: result,
              tool_call_id: toolCalls[index]?.id || `call_${index}`,
            })),
          ];

        // Get OpenAI's conversational response to the tool results
        const followUpConfig = {
          model: this.LLModelName,
          messages: conversationMessages,
          stream: true,
          temperature: 0.1,
          max_tokens: 4000,
        };

        // Note: JSON format removed for compatibility

        const followUpStream =
          await client.chat.completions.create(followUpConfig);

        let finalResponse = '';
        const asyncFollowUpStream = followUpStream as AsyncIterable<any>;
        for await (const chunk of asyncFollowUpStream) {
          if (chunk.choices[0]?.delta?.content) {
            const content = chunk.choices[0].delta.content;
            finalResponse += content;
            callbacks.onStreamChunkReceived(content);
          }
        }

        callbacks.onFullMessageReceived({
          content: { payload: finalResponse, type: 'text/plain' },
        });
      } else {
        callbacks.onFullMessageReceived({
          content: { payload: accumulatedContent, type: 'text/plain' },
        });
      }
    } catch (error) {
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Error in acceptMessageStreamResponse: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      callbacks.onError?.(
        new Error(`KnobbyOpenAiSumoReport error: ${errorMessage}`),
      );
    }

    this.logger.debug('=== KNOBBY SUMO acceptMessageStreamResponse END ===');
  }

  /**
   * Handle immediate response (non-streaming)
   */
  public async acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  > {
    this.logger.debug(
      '=== KNOBBY SUMO acceptMessageImmediateResponse START ===',
    );

    try {
      const client = this.getClient();
      const requestParams = this.createOpenAIMessageRequest(
        message,
        getHistory,
      );

      const completionConfig = { ...requestParams };

      const completion = await client.chat.completions.create(completionConfig);

      let responseContent = '';

      // Type guard to ensure we have a ChatCompletion response (not streaming)
      if (
        'choices' in completion &&
        completion.choices &&
        completion.choices.length > 0
      ) {
        const choice = completion.choices[0];

        if (choice.message.content) {
          responseContent = choice.message.content;
        }

        // Handle tool calls if present
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          this.logger.debug('Executing tool calls for immediate response');
          const toolResults = await this.executeToolCalls(
            choice.message.tool_calls,
          );

          // Send tool results back to OpenAI for processing into conversational response
          const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
            [
              { role: 'system', content: this.robotRole },
              { role: 'user', content: message.content.payload },
              {
                role: 'assistant',
                content: responseContent,
                tool_calls: choice.message.tool_calls,
              },
              ...toolResults.map((result, index) => ({
                role: 'tool' as const,
                content: result,
                tool_call_id:
                  choice.message.tool_calls![index]?.id || `call_${index}`,
              })),
            ];

          // Get OpenAI's conversational response to the tool results
          const followUpConfig = {
            model: this.LLModelName,
            messages: conversationMessages,
            temperature: 0.1,
            max_tokens: 4000,
          };

          // Note: JSON format removed for compatibility

          const followUpCompletion =
            await client.chat.completions.create(followUpConfig);

          if (
            'choices' in followUpCompletion &&
            followUpCompletion.choices[0]?.message?.content
          ) {
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

      this.logger.debug(
        '=== KNOBBY SUMO acceptMessageImmediateResponse END ===',
      );
      return result;
    } catch (error) {
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Error in acceptMessageImmediateResponse: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        content: {
          type: 'text/plain' as const,
          payload: `KnobbyOpenAiSumoReport encountered an error: ${errorMessage}`,
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
      const response = await this.acceptMessageImmediateResponse(
        message,
        getHistory,
      );

      // Call the delayed callback with the response
      delayedMessageCallback(response);

      // Return the content for the return value
      return response.content;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Error in acceptMessageMultiPartResponse: ${errorMessage}`,
      );

      const errorContent = {
        type: 'text/plain' as const,
        payload: `KnobbyOpenAiSumoReport encountered an error: ${errorMessage}`,
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
   * Override the transformer to properly convert different content types to text
   */
  public getGetFromRobotToConversationTransformer(): (
    msg: IConversationMessage,
  ) => IConversationMessageAnthropic {
    return (msg) => {
      // Convert different content types to text for the robot
      let contentText = '';

      if (msg.content.type === 'sumo-search/report') {
        // Convert sumo-search/report to readable text
        const reportData = (msg.content as any).payload;
        contentText = `[Sumo Logic Report] Record Count: ${reportData.recordCount}, File Size: ${reportData.fileSize || 'Unknown'}, File: ${reportData.filePath || 'Unknown'}`;
        if (reportData.firstRecord) {
          contentText += `\nFirst Record: ${JSON.stringify(reportData.firstRecord, null, 2)}`;
        }
      } else if (msg.content.type === 'text/plain') {
        contentText = (msg.content as any).payload || String(msg.content);
      } else {
        // For other content types, convert to string
        contentText = JSON.stringify(
          (msg.content as any).payload || msg.content,
        );
      }

      return {
        role:
          msg.fromRole === UserRole.CUSTOMER || msg.fromRole === UserRole.AGENT
            ? 'user'
            : 'assistant',
        content: contentText,
      };
    };
  }

  /**
   * NEW universal method for intent-based processing
   * Handles both initial intent processing and file result processing
   */
  async handleIntentWithTools(
    intentData: IntentData,
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    // Check if this is a file result processing (has fileEstimateTokenCount)
    if (intentData.fileEstimateTokenCount !== undefined) {
      return this.handleFileResult(intentData, message, callbacks);
    }

    // This is initial intent processing - parse and submit job
    return this.processInitialIntent(intentData, message, callbacks);
  }

  /**
   * Process initial intent - parse query and submit job
   */
  private async processInitialIntent(
    intentData: IntentData,
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    try {
      // Parse the intent to extract Sumo query parameters
      this.logger.log(`[KNOBBY-SUMO] : Intent AKA {sumoQuery}`, intentData);
      const sumoQuery = await this.parseIntent(intentData);
      console.log(
        `[KNOBBY-SUMO] : parsedIntent AKA {sumoQuery}: ` +
          JSON.stringify(sumoQuery, null, 2),
        {
          theQuery: sumoQuery,
        },
      );

      // Check if parsing resulted in an error
      if (sumoQuery.error) {
        const errorResponse = `I couldn't understand your request. ${sumoQuery.reason}`;
        await callbacks.onFullMessageReceived({
          content: { type: 'text/plain', payload: errorResponse },
        });
        return;
      }

      // Submit the job using the tool set
      const jobResult = await this.executeSumoJob(sumoQuery);

      // Send initial response to user
      const initialResponse = `I've submitted your report request. Job ID: ${jobResult.jobId}. I'll notify you when the results are ready.`;

      await callbacks.onFullMessageReceived({
        content: { type: 'text/plain', payload: initialResponse },
      });

      // Set up job monitoring to call handleIntentWithTools again when job completes
      this.monitorJobCompletion(
        jobResult.jobId,
        intentData,
        message,
        callbacks,
      );
    } catch (error) {
      this.logger.error(
        `[KNOBBY-SUMO] Error processing initial intent:`,
        error,
      );

      const errorResponse = `Sorry, I encountered an error processing your report request: ${error.message}`;
      await callbacks.onFullMessageReceived({
        content: { type: 'text/plain', payload: errorResponse },
      });
    }
  }

  /**
   * Handle file result processing - either return link or process file content
   */
  private async handleFileResult(
    intentData: IntentData,
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    const maxTokens = Math.floor(this.contextWindowSizeInTokens * 0.3); // 30% of context window
    const fileTokens = intentData.fileEstimateTokenCount || 0;

    if (fileTokens > maxTokens) {
      // File too large - return link
      const fileLink =
        intentData.filePath || 'https://example.com/report-download-link';
      const response = `Your report is ready! The file is quite large (${fileTokens} tokens), so I'm providing a download link instead of processing it directly.\n\nDownload your report: ${fileLink}`;

      await callbacks.onFullMessageReceived({
        content: { type: 'text/plain', payload: response },
      });
    } else {
      // File small enough - process content
      // Read file content and create summary prompt
      const fileContent = await this.readFileContent(
        intentData.filePath,
        intentData.resultsData,
      );

      const summaryPrompt = `End user ran report with the following results:\n\n${fileContent}\n\nPlease review this data and provide a summary and insights for the user.`;

      // Create a new message with the summary prompt
      const summaryMessage: IConversationMessage<TConversationMessageContentString> =
        {
          ...message,
          content: { type: 'text/plain', payload: summaryPrompt },
        };

      // Check file size and handle accordingly
      const fs = require('fs');
      const fileSizeInBytes = fs.existsSync(intentData.filePath)
        ? fs.statSync(intentData.filePath).size
        : 0;
      const fileSizeInKB = fileSizeInBytes / 1024;
      const maxSizeKB = 200;

      if (fileSizeInKB > maxSizeKB) {
        // File too large - add message with link and file size
        const largeFileMessage = `Report file is too large for robot processing (${fileSizeInKB.toFixed(1)} KB > ${maxSizeKB} KB limit). Download link: ${intentData.filePath}`;

        callbacks.onFullMessageReceived({
          content: {
            type: 'text/plain',
            payload: largeFileMessage,
          },
        });
      } else {
        // File small enough - add the structured report data to the conversation
        const reportData = {
          recordCount: intentData.resultsData?.records?.length || 0,
          firstRecord: intentData.resultsData?.records?.[0] || null,
          results: intentData.resultsData || null,
          fileSize: `${fileSizeInKB.toFixed(1)} KB`,
          filePath: intentData.filePath,
        };

        // Add the sumo-search/report message to conversation
        callbacks.onFullMessageReceived({
          content: {
            type: 'sumo-search/report',
            payload: reportData,
          },
        });
      }

      // Then process the result review (analysis)
      return this.processResultReview(summaryMessage, callbacks);
    }
  }

  /**
   * Parse intent data to extract Sumo Logic query parameters
   * This method calls the OpenAI robot to parse the user's intent into Sumo query parameters
   */
  private async parseIntent(intentData: IntentData): Promise<any> {
    // Create a message with the user's original prompt
    const message: IConversationMessage<TConversationMessageContentString> = {
      id: 'temp-parse-message',
      conversationId: 'temp-conversation',
      authorUserId: null,
      fromRole: UserRole.CUSTOMER,
      toRole: UserRole.ROBOT,
      messageType: 'text' as any,
      content: { type: 'text/plain', payload: intentData.originalUserPrompt },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log({ type: 'text/plain', payload: intentData.originalUserPrompt });
    // Use the parseUserRequestPrompt to parse the intent
    const response = await this.parseUserRequest(message);
    const responseText = response.content.payload;
    console.log({ responseText });
    try {
      // Try to parse the JSON response from the robot
      const parsedResponse = JSON.parse(responseText);

      // Validate that we have the required structure
      if (parsedResponse.queryName && parsedResponse.subject) {
        return parsedResponse;
      } else {
        throw new Error('Invalid response structure from robot');
      }
    } catch (parseError) {
      // If JSON parsing fails, return error structure
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Failed to parse robot response as JSON: ${parseError.message}`,
      );
      this.logger.log(`Robot response was: ${responseText}`);

      // Return error structure as the robot would if it can't figure out the query
      return {
        error: true,
        reason: `Failed to parse user request into Sumo query parameters: ${parseError.message}`,
      };
    }
  }

  /**
   * Execute Sumo Logic job by making direct API call
   */
  private async executeSumoJob(sumoQuery: any): Promise<any> {
    try {
      // Use the same configuration as knobbySumoToolSet.ts
      const baseUrl =
        process.env.INFORMATION_SERVICES_URL ||
        'http://192.168.1.3:3505/information-services';
      const token =
        process.env.INFORMATION_SERVICES_TOKEN || 'istack-buddy-dev-token-2024';
      const endpoint = '/context-sumo-report/query/submit';

      console.log({ sumoQuery, baseUrl, endpoint });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sumoQuery),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();
      console.log({ apiResult: result });
      return result;
    } catch (error) {
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Error submitting Sumo job: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Monitor job completion and handle results
   */
  private async monitorJobCompletion(
    jobId: string,
    intentData: IntentData,
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const pollInterval = setInterval(async () => {
      attempts++;

      try {
        // Use the same configuration as knobbySumoToolSet.ts
        const baseUrl =
          process.env.INFORMATION_SERVICES_URL ||
          'http://192.168.1.3:3505/information-services';
        const token =
          process.env.INFORMATION_SERVICES_TOKEN ||
          'istack-buddy-dev-token-2024';
        const endpoint = `/context-sumo-report/query/${jobId}/status`;

        const statusResponse = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!statusResponse.ok) {
          throw new Error(`HTTP error! status: ${statusResponse.status}`);
        }

        const statusData = await statusResponse.json();
        console.log({ jobStatus: statusData });

        if (statusData.status === 'completed') {
          clearInterval(pollInterval);

          // Job completed - fetch results and process
          await this.handleJobCompletion(jobId, intentData, message, callbacks);
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval);

          const errorResponse = `Your report job failed. Error: ${statusData.error || 'Unknown error'}`;
          await callbacks.onFullMessageReceived({
            content: { type: 'text/plain', payload: errorResponse },
          });
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);

          const timeoutResponse = `Your report job is taking longer than expected. You can check the status manually using job ID: ${jobId}`;
          await callbacks.onFullMessageReceived({
            content: { type: 'text/plain', payload: timeoutResponse },
          });
        }
      } catch (error) {
        this.logger.error(
          'KnobbyOpenAiSumoReport',
          `Error polling job status: ${error.message}`,
        );
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
        }
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Handle job completion - fetch results and process
   */
  private async handleJobCompletion(
    jobId: string,
    intentData: IntentData,
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    try {
      // Use the same configuration as knobbySumoToolSet.ts
      const baseUrl =
        process.env.INFORMATION_SERVICES_URL ||
        'http://192.168.1.3:3505/information-services';
      const token =
        process.env.INFORMATION_SERVICES_TOKEN || 'istack-buddy-dev-token-2024';
      const endpoint = `/context-sumo-report/query/${jobId}/results`;

      console.log({ jobCompletion: { jobId, baseUrl, endpoint } });

      const resultsResponse = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resultsResponse.ok) {
        throw new Error(`HTTP error! status: ${resultsResponse.status}`);
      }

      const resultsData = await resultsResponse.json();
      console.log({ jobResults: resultsData });

      // Store the results data to a file
      const fileName = `sumo-results-${jobId}-${Date.now()}.json`;
      const filePath = `./logs/${fileName}`;

      // Ensure logs directory exists
      const fs = require('fs');
      if (!fs.existsSync('./logs')) {
        fs.mkdirSync('./logs', { recursive: true });
      }

      // Save the results to file
      fs.writeFileSync(filePath, JSON.stringify(resultsData, null, 2));
      console.log({
        savedResultsTo: filePath,
        recordCount: resultsData.records?.length || 0,
      });

      // Create new intent data with file information
      const fileIntentData: IntentData = {
        ...intentData,
        fileEstimateTokenCount: resultsData.records?.length * 50 || 1000, // Estimate tokens based on record count
        filePath: filePath,
        resultsData: resultsData, // Store the actual data for processing
      };

      // Call handleIntentWithTools again with file result processing
      await this.handleFileResult(fileIntentData, message, callbacks);
    } catch (error) {
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Error handling job completion: ${error.message}`,
      );

      const errorResponse = `Your report completed but I couldn't process the results. Error: ${error.message}`;
      await callbacks.onFullMessageReceived({
        content: { type: 'text/plain', payload: errorResponse },
      });
    }
  }

  /**
   * Parse user request using the specific parsing prompt
   */
  private async parseUserRequest(
    message: IConversationMessage<TConversationMessageContentString>,
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  > {
    try {
      const client = this.getClient();

      // Create request with parseUserRequestPrompt
      const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams =
        {
          model: this.LLModelName,
          max_tokens: 1000,
          messages: [
            {
              role: 'system',
              content: this.parseUserRequestPrompt,
            },
            {
              role: 'user',
              content: message.content.payload,
            },
          ],
          temperature: 0.1, // Low temperature for consistent JSON output
        };

      const completion = await client.chat.completions.create(requestParams);

      let responseContent = '';

      if (
        'choices' in completion &&
        completion.choices &&
        completion.choices.length > 0
      ) {
        const choice = completion.choices[0];
        if (choice.message.content) {
          responseContent = choice.message.content;
        }
      }

      return {
        content: {
          type: 'text/plain' as const,
          payload: responseContent,
        },
      };
    } catch (error) {
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Error in parseUserRequest: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return {
        content: {
          type: 'text/plain' as const,
          payload: `{"error": true, "reason": "Failed to parse request due to system error"}`,
        },
      };
    }
  }

  /**
   * Process result review with custom prompt
   */
  private async processResultReview(
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    try {
      const client = this.getClient();

      // Create request with result review prompt
      const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams =
        {
          model: this.LLModelName,
          max_tokens: 2000,
          messages: [
            {
              role: 'system',
              content: this.resultReviewPrompt,
            },
            {
              role: 'user',
              content: message.content.payload,
            },
          ],
          stream: true,
          temperature: 0.3,
        };

      const streamConfig = {
        ...requestParams,
      };

      const asyncStream = await client.chat.completions.create(streamConfig);
      let accumulatedContent = '';

      for await (const chunk of asyncStream) {
        if (chunk.choices && chunk.choices.length > 0) {
          const choice = chunk.choices[0];

          if (choice.delta?.content) {
            accumulatedContent += choice.delta.content;
            callbacks.onStreamChunkReceived(choice.delta.content);
          }
        }
      }

      // Add the analysis to the conversation using the proper sumo-search/report content type
      callbacks.onFullMessageReceived({
        content: {
          payload: accumulatedContent,
          type: 'text/plain',
        },
      });
    } catch (error) {
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Error in processResultReview: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      callbacks.onError?.(
        new Error(`KnobbyOpenAiSumoReport error: ${errorMessage}`),
      );
    }
  }

  /**
   * Read file content from file path
   */
  private async readFileContent(
    filePath: string,
    resultsData?: any,
  ): Promise<string> {
    try {
      // If we have the results data directly, use it
      if (resultsData) {
        return JSON.stringify(resultsData, null, 2);
      }

      // If it's a URL, fetch the content
      if (filePath.startsWith('http')) {
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        return await response.text();
      }

      // If it's a local file path, read from filesystem
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }

      return `[File not found: ${filePath}]`;
    } catch (error) {
      this.logger.error(
        'KnobbyOpenAiSumoReport',
        `Error reading file content: ${error.message}`,
      );
      return `[Error reading file: ${error.message}]`;
    }
  }
}
