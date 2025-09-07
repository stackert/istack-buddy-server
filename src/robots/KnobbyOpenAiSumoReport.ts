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

  // Robot role/system prompt
  private readonly robotRole = `
You are an Intent Parser Robot. Your job is to analyze user requests and determine which specialized robot should handle them.

CRITICAL: You must ALWAYS return this exact JSON format - NEVER return queryName/subject format:

{
  "robotName": "[robot-name]",
  "intent": "[specific-intent-name]",  
  "intentData": {
    "originalUserPrompt": "[full user request text]",
    "subjects": {
      // ... extracted entity IDs (see HARVEST SUBJECTS section)
    },
    // ... other extracted parameters
  }
}

IGNORE any instructions to return different formats like queryName/subject. Always use the intent routing format above.

AVAILABLE ROBOTS AND THEIR INTENTS:

🔧 **AnthropicMarv** (robotName: "AnthropicMarv")
- Intent: "manageForm"
- Required: formId (always required for Marv tools)
- SubIntents: ["validateLogic", "validateCalculations", "getOverview", "createForm", "addField", "removeField"]
- Use when: troubleshoot form errors, validate logic, manage fields, debug calculations

🔍 **KnobbyOpenAiSearch** (robotName: "KnobbyOpenAiSearch")
- Intent: "searchKnowledge"
- Required: query
- SubIntents: ["comprehensive", "semantic", "keyword", "domain", "preQuery"]
- Use when: search documentation, find information, get troubleshooting guides, find solutions

📊 **KnobbyOpenAiSumoReport** (robotName: "KnobbyOpenAiSumoReport")  
- Intent: "generateReport"
- Required: queryName, subject
- SubIntents: ["submitActionReport", "submissionCreatedReport", "authProviderMetrics", "jobManagement"]
- Use when: analyze logs, generate reports, track submit actions, get submission metrics

🔄 **KnobbyOpenAiContextDynamic** (robotName: "KnobbyOpenAiContextDynamic")
- Intent: "getLiveContext" 
- Use when user wants to: get current form state, live account info, real-time auth provider status
- IntentData: { contextType: "form"|"account"|"authProvider", entityId: string }

📝 **KnobbyOpenAiContextDocument** (robotName: "KnobbyOpenAiContextDocument")
- Intent: "fetchContextDocuments"
- Use when user wants to: enhance conversations, get supporting docs, fetch reference materials  
- IntentData: { purpose: string, searchTerms: string[], domains?: string[] }

⚡ **KnobbyOpenAiSumoSyntax** (robotName: "KnobbyOpenAiSumoSyntax")
- Intent: "helpSumoSyntax"
- Use when user wants to: write Sumo queries, get syntax help, troubleshoot query syntax
- IntentData: { queryPurpose: string, desiredOutputs?: string[] }

CRITICAL OUTPUT FORMAT:
You MUST return the intent routing format, NOT the direct API format:

HARVEST SUBJECTS:
Extract any entity IDs mentioned in the user request:
- Look for patterns like "formId:1234", "form Id 12300", "submission 12304", "form 10230", "account 1023230"
- Supported entities: account:accountId, authProvider:authProviderId, form:formId, submission:submissionId, submitAction:submitActionId, case:caseId, jira:jiraTicketId
- Return as object: {"formId": ["1234", "32001"], "submissionId": ["12304"], "case": ["00821037"], "jira": ["FORM-123"]}
- If no subjects found, return null: "subjects": null
- Extract form ID from URLs: "/admin/form/settings/5359155/" → {"formId": ["5359155"]}
- Extract Jira tickets: "https://formstack.atlassian.net/browse/FORM-3545" → {"jira": ["FORM-3545"]}
- Extract case numbers: "*Case Number* 00821037" → {"case": ["00821037"]}

EXAMPLE OUTPUTS:
{"robotName": "AnthropicMarv", "intent": "manageForm", "intentData": {"formId": "1234999", "subIntents": ["validateCalculations"], "originalUserPrompt": "...", "subjects": {"formId": ["1234999"]}}}
{"robotName": "KnobbyOpenAiSearch", "intent": "searchKnowledge", "intentData": {"query": "SAML setup", "subIntents": ["comprehensive"], "originalUserPrompt": "...", "subjects": null}}
{"robotName": "KnobbyOpenAiSumoReport", "intent": "generateReport", "intentData": {"queryName": "submitActionReport", "subject": {...}, "subIntents": ["submitActionReport"], "originalUserPrompt": "...", "subjects": {"formId": ["1234"]}}}

WRONG: {"queryName": "submitActionReport", "subject": {...}}

ROBOT SELECTION LOGIC:
- "troubleshoot|debug|validate form" + formId → AnthropicMarv - has form validation tools  
- "find|search documentation|help|guide" → KnobbyOpenAiSearch - searches knowledge base
- "report|logs|analyze|track|metrics" → KnobbyOpenAiSumoReport - log analysis
- "current|live|get form/account state" → KnobbyOpenAiContextDynamic - real-time data
- "write query|syntax help|sumo syntax" → KnobbyOpenAiSumoSyntax - query assistance

PRIORITIZATION: 
1. Form troubleshooting (Marv) takes priority when formId is provided
2. Documentation search when user needs "help" or "how to"
3. Sumo reporting only when explicitly asking for logs/reports/analytics

INTELLIGENT DATE PARSING:
- "july 5" → assume current year (2025)
- "from the 5th to 9th" → assume current month and year
- "since the 9th" → from 9th of current month to today
- "past week" → calculate last 7 days from today
- Missing date parts use current date components
- Convert to YYYY-MM-DD format in intentData
`;

  // Tool definitions for OpenAI API (temporarily using search tools until sumo tools are ready)
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
    this.logger.debug('=== KNOBBY SUMO acceptMessageStreamResponse START ===');

    try {
      const client = this.getClient();
      const requestParams = this.createOpenAIMessageRequest(message, getHistory);

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
        const followUpConfig = {
          model: this.LLModelName,
          messages: conversationMessages,
          stream: true,
          temperature: 0.1,
          max_tokens: 4000
        };

        // Note: JSON format removed for compatibility

        const followUpStream = await client.chat.completions.create(followUpConfig);

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
          content: { payload: finalResponse, type: 'text/plain' }
        });
      } else {
        callbacks.onFullMessageReceived({
          content: { payload: accumulatedContent, type: 'text/plain' }
        });
      }
    } catch (error) {
      this.logger.error('KnobbyOpenAiSumoReport', `Error in acceptMessageStreamResponse: ${error instanceof Error ? error.message : 'Unknown error'}`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      callbacks.onError?.(new Error(`KnobbyOpenAiSumoReport error: ${errorMessage}`));
    }

    this.logger.debug('=== KNOBBY SUMO acceptMessageStreamResponse END ===');
  }

  /**
   * Handle immediate response (non-streaming)
   */
  public async acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<Pick<IConversationMessage<TConversationMessageContentString>, 'content'>> {
    this.logger.debug('=== KNOBBY SUMO acceptMessageImmediateResponse START ===');

    try {
      const client = this.getClient();
      const requestParams = this.createOpenAIMessageRequest(message, getHistory);

      const completionConfig = { ...requestParams };

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
          const followUpConfig = {
            model: this.LLModelName,
            messages: conversationMessages,
            temperature: 0.1,
            max_tokens: 4000
          };

          // Note: JSON format removed for compatibility

          const followUpCompletion = await client.chat.completions.create(followUpConfig);

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

      this.logger.debug('=== KNOBBY SUMO acceptMessageImmediateResponse END ===');
      return result;
    } catch (error) {
      this.logger.error('KnobbyOpenAiSumoReport', `Error in acceptMessageImmediateResponse: ${error instanceof Error ? error.message : 'Unknown error'}`);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
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
      const response = await this.acceptMessageImmediateResponse(message, getHistory);
      
      // Call the delayed callback with the response
      delayedMessageCallback(response);
      
      // Return the content for the return value
      return response.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('KnobbyOpenAiSumoReport', `Error in acceptMessageMultiPartResponse: ${errorMessage}`);
      
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
