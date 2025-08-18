import { AbstractRobotChat } from './AbstractRobotChat';
import type {
  IStreamingCallbacks,
  TConversationMessageContentString,
} from './types';
import type { TConversationMessageContent } from '../ConversationLists/types';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';
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

import {
  ObservationMakers,
  EObservationSubjectType,
} from 'istack-buddy-utilities';

import type {
  IObservationResult,
  IObservationLogItem,
  IObservationContext,
} from 'istack-buddy-utilities';

/**
 * ObservationMakerViewer - Extends ObservationMaker for display purposes
 * Filters and formats observations for Slack display
 */
class ObservationMakerViewer extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FORM;
  protected observationClass = this.constructor.name;
  protected messagePrimary = 'Observation Viewer';
  private logItems: IObservationLogItem[] = [];

  constructor() {
    super();
  }

  getRequiredResources(): string[] {
    return ['formModel'];
  }

  async makeObservation(
    context: IObservationContext,
  ): Promise<IObservationResult> {
    // This is a viewer class, not a real observation maker
    // It just displays existing observation results
    return { isObservationTrue: true, logItems: this.logItems };
  }

  setLogItems(logItems: IObservationLogItem[]): void {
    this.logItems = logItems;
  }

  /**
   * Create an ObservationMakerViewer from observation results
   */
  static fromObservationResults(
    observationMakerResult: any,
  ): ObservationMakerViewer {
    const viewer = new ObservationMakerViewer();

    console.log('ObservationMakerViewer.fromObservationResults called with:', {
      hasResult: !!observationMakerResult,
      hasResponse: !!(
        observationMakerResult && observationMakerResult.response
      ),
      resultType: typeof observationMakerResult,
      responseType: observationMakerResult?.response
        ? typeof observationMakerResult.response
        : 'undefined',
    });

    // Extract log items from the observation result
    if (observationMakerResult && observationMakerResult.response) {
      const logItems = viewer.extractLogItems(observationMakerResult.response);
      viewer.setLogItems(logItems);

      console.log('Extracted log items:', {
        count: logItems.length,
        logItems: JSON.stringify(logItems.slice(0, 2), null, 2), // Show first 2 for debugging
      });
    } else {
      console.log('No valid observation maker result found');
    }

    return viewer;
  }

  private extractLogItems(response: any): any[] {
    const logItems = [];

    console.log('extractLogItems called with:', {
      responseType: typeof response,
      isArray: Array.isArray(response),
      hasLogItems: !!(response && response.logItems),
      hasObservations: !!(response && response.observations),
      hasData: !!(response && response.data),
      responseKeys:
        response && typeof response === 'object' ? Object.keys(response) : [],
    });

    // Handle different response structures
    if (response && response.logItems && Array.isArray(response.logItems)) {
      console.log(
        'Extracting from response.logItems, length:',
        response.logItems.length,
      );
      logItems.push(...response.logItems);
    } else if (Array.isArray(response)) {
      console.log('Extracting from array response, length:', response.length);
      logItems.push(...response);
    } else if (
      response &&
      response.observations &&
      Array.isArray(response.observations)
    ) {
      console.log(
        'Extracting from response.observations, length:',
        response.observations.length,
      );
      logItems.push(...response.observations);
    } else if (response && response.data && Array.isArray(response.data)) {
      console.log(
        'Extracting from response.data, length:',
        response.data.length,
      );
      logItems.push(...response.data);
    } else if (typeof response === 'object') {
      console.log('Extracting single observation object');
      logItems.push(response);
    } else {
      console.log('No valid observation structure found');
    }

    console.log('Final log items count:', logItems.length);
    return logItems;
  }

  /**
   * Get only warning and error log items
   */
  getWarningsAndErrors(): any[] {
    return this.logItems.filter(
      (item) => item.logLevel === 'warn' || item.logLevel === 'error',
    );
  }

  /**
   * Get log items by level
   */
  getLogItemsByLevel(level: string): any[] {
    return this.logItems.filter((item) => item.logLevel === level);
  }

  /**
   * Get all log items
   */
  getAllLogItems(): any[] {
    return this.logItems;
  }

  /**
   * Get the observation class name
   */
  getObservationClassName(): string {
    return this.observationClass;
  }

  /**
   * Format log items for Slack display
   */
  formatForSlack(): string {
    const warningsAndErrors = this.getWarningsAndErrors();

    if (warningsAndErrors.length === 0) {
      return '✅ *No issues found* - All validations passed successfully!';
    }

    let formatted = `⚠️ *Found ${warningsAndErrors.length} issue(s):*\n\n`;

    warningsAndErrors.forEach((item, index) => {
      const emoji = item.logLevel === 'error' ? '❌' : '⚠️';
      const level = item.logLevel === 'error' ? 'ERROR' : 'WARNING';

      formatted += `${emoji} *${level}* (${index + 1}/${warningsAndErrors.length})\n`;

      // Use messageSecondary as the primary message (capped at 150 characters)
      if (item.messageSecondary) {
        const truncatedMessage = this.truncateMessage(item.messageSecondary);
        formatted += `• *Message:* ${truncatedMessage}\n`;
      }

      if (item.subjectId) {
        formatted += `• *Subject ID:* \`${item.subjectId}\`\n`;
      }

      // Skip additional details as they're not helpful for Slack display
      // if (item.additionalDetails) {
      //   formatted += `• *Additional Details:* ${JSON.stringify(item.additionalDetails)}\n`;
      // }

      formatted += '\n';
    });

    return formatted;
  }

  /**
   * Format all log items for Slack display (including info and debug)
   */
  formatAllForSlack(): string {
    if (this.logItems.length === 0) {
      return '📝 *No log items found*';
    }

    let formatted = `📊 *All Log Items (${this.logItems.length} total):*\n\n`;

    this.logItems.forEach((item, index) => {
      const emoji = this.getEmojiForLevel(item.logLevel);
      const level = item.logLevel.toUpperCase();

      formatted += `${emoji} *${level}* (${index + 1}/${this.logItems.length})\n`;

      // Use messageSecondary as the primary message (capped at 150 characters)
      if (item.messageSecondary) {
        const truncatedMessage = this.truncateMessage(item.messageSecondary);
        formatted += `• *Message:* ${truncatedMessage}\n`;
      }

      if (item.subjectId) {
        formatted += `• *Subject ID:* \`${item.subjectId}\`\n`;
      }

      // Skip additional details as they're not helpful for Slack display
      // if (item.additionalDetails) {
      //   formatted += `• *Additional Details:* ${JSON.stringify(item.additionalDetails)}\n`;
      // }

      formatted += '\n';
    });

    return formatted;
  }

  /**
   * Get emoji for log level
   */
  private getEmojiForLevel(level: string): string {
    switch (level) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'debug':
        return '🔍';
      default:
        return '📝';
    }
  }

  /**
   * Truncate message to specified length with ellipsis
   */
  private truncateMessage(message: string, maxLength: number = 150): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get summary statistics
   */
  getSummary(): string {
    const total = this.logItems.length;
    const errors = this.logItems.filter(
      (item) => item.logLevel === 'error',
    ).length;
    const warnings = this.logItems.filter(
      (item) => item.logLevel === 'warn',
    ).length;
    const info = this.logItems.filter(
      (item) => item.logLevel === 'info',
    ).length;
    const debug = this.logItems.filter(
      (item) => item.logLevel === 'debug',
    ).length;

    return (
      `📊 *Summary:* ${total} total log items\n` +
      `• ❌ ${errors} errors\n` +
      `• ⚠️ ${warnings} warnings\n` +
      `• ℹ️ ${info} info\n` +
      `• 🔍 ${debug} debug`
    );
  }
}

/**
 * Slacky Tool Result Formatter
 * Formats tool results for better Slack display
 */
function slackyToolResultFormatter(functionName: string, result: any): string {
  try {
    // Handle different function types
    switch (functionName) {
      case 'fsRestrictedApiFormCalculationValidation':
      case 'fsRestrictedApiFormLogicValidation':
        return formatValidationResult(functionName, result);

      case 'fsRestrictedApiFormAndRelatedEntityOverview':
        return formatFormOverviewResult(result);

      case 'sumoLogicQuery':
        return formatSumoQueryResult(result);

      case 'ssoAutoFillAssistance':
        return formatSsoResult(result);

      default:
        return formatGenericResult(functionName, result);
    }
  } catch (error) {
    return `❌ *Error formatting result:* ${error instanceof Error ? error.message : 'Unknown error'}\n\n*Raw result:*\n\`\`\`${JSON.stringify(result, null, 2)}\`\`\``;
  }
}

function formatValidationResult(functionName: string, result: any): string {
  const viewer = ObservationMakerViewer.fromObservationResults(result);
  const summary = viewer.getSummary();
  const formatted = viewer.formatForSlack();

  const functionDisplayName =
    functionName === 'fsRestrictedApiFormCalculationValidation'
      ? 'Calculation Validation'
      : 'Logic Validation';

  const observationClass = viewer.getObservationClassName();
  const contextInfo =
    observationClass !== 'ObservationMakerViewer'
      ? `\n*Observation Type:* ${observationClass}`
      : '';

  return `🔍 *${functionDisplayName} Results*${contextInfo}\n\n${summary}\n\n${formatted}`;
}

function formatFormOverviewResult(result: any): string {
  if (!result || !result.response) {
    return `❌ *Form Overview Error:* No data received`;
  }

  const data = result.response;
  let formatted = `📋 *Form Overview*\n\n`;

  // Basic form information
  if (data.formId) {
    formatted += `• *Form ID:* \`${data.formId}\`\n`;
  }
  if (data.url) {
    formatted += `• *URL:* ${data.url}\n`;
  }
  if (data.version) {
    formatted += `• *Version:* ${data.version}\n`;
  }
  if (data.submissions !== undefined) {
    formatted += `• *Total Submissions:* ${data.submissions.toLocaleString()}\n`;
  }
  if (data.submissionsToday !== undefined) {
    formatted += `• *Submissions Today:* ${data.submissionsToday.toLocaleString()}\n`;
  }
  if (data.fieldCount) {
    formatted += `• *Field Count:* ${data.fieldCount}\n`;
  }
  if (data.isActive !== undefined) {
    formatted += `• *Status:* ${data.isActive ? '✅ Active' : '❌ Inactive'}\n`;
  }
  if (data.encrypted !== undefined) {
    formatted += `• *Encrypted:* ${data.encrypted ? 'Yes' : 'No'}\n`;
  }
  if (data.timezone) {
    formatted += `• *Timezone:* ${data.timezone}\n`;
  }
  if (data.isOneQuestionAtATime !== undefined) {
    formatted += `• *One Question at a Time:* ${data.isOneQuestionAtATime ? 'Yes' : 'No'}\n`;
  }
  if (data.hasApprovers !== undefined) {
    formatted += `• *Has Approvers:* ${data.hasApprovers ? 'Yes' : 'No'}\n`;
  }
  if (data.isWorkflowForm !== undefined) {
    formatted += `• *Workflow Form:* ${data.isWorkflowForm ? 'Yes' : 'No'}\n`;
  }

  // Submit Actions
  if (data.submitActions && data.submitActions.length > 0) {
    formatted += `\n*Submit Actions (${data.submitActions.length}):*\n`;
    data.submitActions.forEach((action: any) => {
      formatted += `• ${action.name || 'Unnamed Action'} (ID: \`${action.id}\`)\n`;
    });
  } else {
    formatted += `\n*Submit Actions:* None configured\n`;
  }

  // Notification Emails
  if (data.notificationEmails && data.notificationEmails.length > 0) {
    formatted += `\n*Notification Emails (${data.notificationEmails.length}):*\n`;
    data.notificationEmails.forEach((email: any) => {
      const emailDisplay = email.name
        ? `${email.name} (ID: \`${email.id}\`)`
        : email.id
          ? `ID: \`${email.id}\``
          : email.email
            ? email.email
            : JSON.stringify(email);
      formatted += `• ${emailDisplay}\n`;
    });
  } else {
    formatted += `\n*Notification Emails:* None configured\n`;
  }

  // Confirmation Emails
  if (data.confirmationEmails && data.confirmationEmails.length > 0) {
    formatted += `\n*Confirmation Emails (${data.confirmationEmails.length}):*\n`;
    data.confirmationEmails.forEach((email: any) => {
      const emailDisplay = email.name
        ? `${email.name} (ID: \`${email.id}\`)`
        : email.id
          ? `ID: \`${email.id}\``
          : email.email
            ? email.email
            : JSON.stringify(email);
      formatted += `• ${emailDisplay}\n`;
    });
  } else {
    formatted += `\n*Confirmation Emails:* None configured\n`;
  }

  return formatted;
}

function formatSumoQueryResult(result: any): string {
  if (!result || typeof result !== 'string') {
    return `❌ *Sumo Logic Error:* Invalid result format`;
  }

  return `📊 *Sumo Logic Query Results*\n\n\`\`\`${result}\`\`\``;
}

function formatSsoResult(result: any): string {
  if (!result || typeof result !== 'string') {
    return `❌ *SSO Auto-fill Error:* Invalid result format`;
  }

  return `🔐 *SSO Auto-fill Analysis*\n\n${result}`;
}

function formatGenericResult(functionName: string, result: any): string {
  const resultString =
    typeof result === 'object'
      ? JSON.stringify(result, null, 2)
      : String(result);

  return `🔧 *${functionName} Results*\n\n\`\`\`${resultString}\`\`\``;
}

/**
 * Slack-specific OpenAI Chat Robot implementation
 * Specialized for Slack integration with comprehensive tool support using OpenAI
 */
export class SlackyOpenAiAgent extends AbstractRobotChat {
  private readonly logger = new CustomLoggerService();

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
  private currentCallback:
    | ((
        response: Pick<
          IConversationMessage<TConversationMessageContentString>,
          'content'
        >,
      ) => void)
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
    onFullMessageReceived?: (message: {
      content: { payload: string; type: 'text/plain' };
    }) => void,
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

      // Log the tool execution for debugging
      this.logger.debug('Tool execution completed', {
        toolName,
        resultType: typeof finalResult,
        isMarvTool: [
          FsRestrictedApiRoutesEnum.FormLogicValidation,
          FsRestrictedApiRoutesEnum.FormCalculationValidation,
          FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
        ].includes(toolName as FsRestrictedApiRoutesEnum),
      });

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
    // this.lastToolResults = results;
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
    message: IConversationMessage<TConversationMessageContentString>,
    // message: TConversationMessageContentString,
    //TConversationMessageContentString
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
      let currentFunctionCall: any = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle function calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            // Initialize function call
            if (
              !currentFunctionCall ||
              currentFunctionCall.index !== toolCall.index
            ) {
              currentFunctionCall = {
                index: toolCall.index,
                id: toolCall.id || '',
                type: toolCall.type || 'function',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || '',
                },
              };
            }

            // Accumulate function call data
            if (currentFunctionCall && toolCall.function?.name) {
              currentFunctionCall.function.name = toolCall.function.name;
            }
            if (currentFunctionCall && toolCall.function?.arguments) {
              currentFunctionCall.function.arguments +=
                toolCall.function.arguments;
            }
          }
        }

        // Handle content (text)
        const content = delta?.content;
        if (content) {
          accumulatedContent += content;
          callbacks.onStreamChunkReceived(content);
        }

        // Handle function call completion
        if (
          chunk.choices[0]?.finish_reason === 'tool_calls' &&
          currentFunctionCall
        ) {
          this.logger.debug('Tool call completion detected', {
            functionName: currentFunctionCall.function.name,
            finishReason: chunk.choices[0]?.finish_reason,
            functionArgs: currentFunctionCall.function.arguments,
          });
          try {
            // Execute the function call
            const functionName = currentFunctionCall.function.name;
            const functionArgs = JSON.parse(
              currentFunctionCall.function.arguments,
            );

            this.logger.debug('Executing function call', {
              functionName,
              functionArgs,
            });

            // Call onFullMessageReceived to indicate tool execution is starting
            this.logger.debug('Checking onFullMessageReceived callback', {
              hasCallback: !!callbacks.onFullMessageReceived,
              callbackType: typeof callbacks.onFullMessageReceived,
            });

            if (callbacks.onFullMessageReceived) {
              const startMessage = {
                content: {
                  payload: `Starting execution of ${functionName}...`,
                  type: 'text/plain' as const,
                },
              };
              this.logger.debug(
                'Calling onFullMessageReceived for tool start',
                {
                  functionName,
                  message: startMessage,
                },
              );
              callbacks.onFullMessageReceived(startMessage);
            } else {
              this.logger.debug(
                'onFullMessageReceived callback is not available',
              );
            }

            const toolResult = await this.executeToolCall(
              functionName,
              functionArgs,
              callbacks.onFullMessageReceived,
            );

            // Format the tool result for Slack display
            const formattedResult = slackyToolResultFormatter(
              functionName,
              toolResult,
            );
            const functionResult = `\n${formattedResult}\n`;
            accumulatedContent += functionResult;
            callbacks.onStreamChunkReceived(functionResult);

            // Call onFullMessageReceived again to indicate tool execution is complete
            if (callbacks.onFullMessageReceived) {
              const completeMessage = {
                content: {
                  payload: `Finished running ${functionName}. Analysis complete.`,
                  type: 'text/plain' as const,
                },
              };
              this.logger.debug(
                'Calling onFullMessageReceived for tool completion',
                {
                  functionName,
                  message: completeMessage,
                },
              );
              callbacks.onFullMessageReceived(completeMessage);
            } else {
              this.logger.debug(
                'onFullMessageReceived callback is not available for completion',
              );
            }
          } catch (error) {
            const errorMessage = `Error executing tool call: ${error instanceof Error ? error.message : 'Unknown error'}`;
            accumulatedContent += errorMessage;
            callbacks.onStreamChunkReceived(errorMessage);
          }
          currentFunctionCall = null;
        }

        // Handle stream completion
        if (chunk.choices[0]?.finish_reason === 'stop') {
          this.logger.debug('Stream completed with stop reason', {
            accumulatedContentLength: accumulatedContent.length,
          });
        }
      }

      // Call onStreamFinished with minimal data
      if (typeof callbacks.onStreamFinished === 'function') {
        // @ts-ignore
        callbacks.onStreamFinished({
          content: { payload: accumulatedContent, type: 'text/plain' },
        });
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
  private createToolStatusResponse(status: string): {
    content: { payload: string; type: 'text/plain' };
  } {
    return {
      // author_role: 'assistant',
      content: {
        type: 'text/plain',
        payload: status,
      },
      // created_at: new Date().toISOString(),
      // estimated_token_count: this.estimateTokens(status),
    };
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
    history: IConversationMessage<TConversationMessageContent>[] = this
      .conversationHistory,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Debug: Log the history being processed
    this.logger.log('Building OpenAI message history:', {
      historyLength: history.length,
      historyRoles: history.map((msg) => {
        const content = msg.content.payload;
        const contentStr =
          typeof content === 'string' ? content : String(content);
        return {
          fromRole: msg.fromRole,
          content: contentStr.substring(0, 50) + '...',
        };
      }),
      currentMessage,
    });

    // Add conversation history
    for (const msg of history) {
      // Check if this is already in the new format (has role property)
      if ('role' in msg && typeof msg.role === 'string') {
        // Already in new format
        const content = msg.content.payload;
        const contentStr =
          typeof content === 'string' ? content : String(content);
        this.logger.log(`Adding message with role: ${msg.role}`);
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: contentStr,
        });
      } else {
        // Convert from old format
        this.logger.log(`Processing message with role: ${msg.fromRole}`);

        if (msg.fromRole === UserRole.CUSTOMER) {
          const content = msg.content.payload;
          const contentStr =
            typeof content === 'string' ? content : String(content);
          this.logger.log(
            `Adding customer message: ${contentStr.substring(0, 50)}...`,
          );
          messages.push({
            role: 'user' as const,
            content: contentStr,
          });
        } else if (msg.fromRole === UserRole.ROBOT) {
          const content = msg.content.payload;
          const contentStr =
            typeof content === 'string' ? content : String(content);
          this.logger.log(
            `Adding robot message: ${contentStr.substring(0, 50)}...`,
          );
          messages.push({
            role: 'assistant' as const,
            content: contentStr,
          });
        } else {
          this.logger.warn(
            `Unknown role in message: ${msg.fromRole}, skipping`,
          );
        }
      }
    }

    // Only add current message if it's not already in the history
    const lastHistoryMessage = history[history.length - 1];
    const lastMessageContent = lastHistoryMessage
      ? lastHistoryMessage.content.payload
      : null;
    const isCurrentMessageInHistory =
      lastHistoryMessage &&
      lastHistoryMessage.fromRole === UserRole.CUSTOMER &&
      lastMessageContent === currentMessage;

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
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  > {
    try {
      const userMessage = message.content.payload;

      // Check for direct feedback commands first
      const feedbackResponse = await this.handleDirectFeedbackCommands(
        userMessage as string,
      );
      if (feedbackResponse) {
        return {
          content: {
            type: 'text/plain',
            payload: feedbackResponse,
          },
        };
      }

      // Use the streaming pattern to get the complete response
      let finalResponse: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      > | null = null;
      let accumulatedContent = '';

      await this.acceptMessageStreamResponse(
        message,
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
          onStreamFinished: (
            message: Pick<
              IConversationMessage<TConversationMessageContentString>,
              'content'
            >,
          ) => {
            // Create a minimal message envelope for the callback
            finalResponse = message;
          },
          onFullMessageReceived: ({ content: string }) => {
            // Handle full message if needed
          },
          onError: (error) => {
            // This callback is now directly used in acceptMessageStreamResponse
            // to handle streaming errors.
            finalResponse = {
              content: {
                type: 'text/plain',
                payload: `Error in streaming response: ${error.message}`,
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
          content: {
            type: 'text/plain',
            payload: accumulatedContent || 'No response generated',
          },
          // created_at: new Date().toISOString(),
          // estimated_token_count: this.estimateTokens(accumulatedContent),
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        //author_role: 'assistant',
        content: {
          type: 'text/plain',
          payload: `I apologize, but I encountered an error: ${errorMessage}`,
        },
        // created_at: new Date().toISOString(),
        // estimated_token_count: this.estimateTokens(errorMessage),
      };
    }
  }

  /**
   * @TMC_ New implementation using acceptMessageStreamResponse
   * Calls acceptMessageStreamResponse and sends immediate response, then promises to send second message when streaming completes
   */
  public async acceptMessageMultiPartResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    delayedMessageCallback: (
      response: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      >,
    ) => void,
    getHistory?: () => IConversationMessage<TConversationMessageContentString>[],
  ): Promise<TConversationMessageContentString> {
    // Send immediate response first
    const immediateResponse =
      await this.acceptMessageImmediateResponse(message);

    // Start streaming in background and promise to send delayed message when complete
    this.acceptMessageStreamResponse(
      message,
      {
        onStreamChunkReceived: (chunk: string) => {
          // Handle chunks if needed
        },
        onStreamStart: (message) => {
          // Handle stream start if needed
        },
        onStreamFinished: (
          message: Pick<
            IConversationMessage<TConversationMessageContentString>,
            'content'
          >,
        ) => {
          // Send the complete response as delayed message
          if (
            delayedMessageCallback &&
            typeof delayedMessageCallback === 'function'
          ) {
            this.logger.debug(
              'Calling delayedMessageCallback with finished message',
            );
            delayedMessageCallback(message);
          }
        },
        onFullMessageReceived: (
          message: Pick<
            IConversationMessage<TConversationMessageContentString>,
            'content'
          >,
        ) => {
          // Send the intermediate message through the delayed message callback
          if (
            delayedMessageCallback &&
            typeof delayedMessageCallback === 'function'
          ) {
            this.logger.debug(
              'Sending intermediate message via delayedMessageCallback',
              {
                content: message.content.payload.substring(0, 100) + '...',
              },
            );
            delayedMessageCallback(message);
          }
        },
        onError: (error) => {
          // Handle error in delayed message
          if (
            delayedMessageCallback &&
            typeof delayedMessageCallback === 'function'
          ) {
            delayedMessageCallback({
              content: {
                type: 'text/plain',
                payload: `Error in streaming response: ${error.message}`,
              },
            });
          }
        },
      },
      getHistory,
    ).catch((error) => {
      // Handle any errors in the streaming process
      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        delayedMessageCallback({
          content: {
            type: 'text/plain',
            payload: `Error in streaming response: ${error.message}`,
          },
        });
      }
    });

    return immediateResponse.content;
  }

  /**
   * Stop all active monitoring
   */
  // public stopMonitoring(): void {
  //   this.isActivelyListeningForResponse = false;
  //   this.activeMonitoringIntervals.forEach((interval) => {
  //     clearInterval(interval);
  //   });
  //   this.activeMonitoringIntervals.clear();
  //   this.toolStatus = { executing: [], completed: [], errors: [] };
  //   this.readMessageIds.clear();
  //   this.lastToolResults = [];
  //   this.currentCallback = null;
  //   this.hasSentFinalResponse = false;
  //   this.logger.log('All monitoring stopped');
  // }
}
