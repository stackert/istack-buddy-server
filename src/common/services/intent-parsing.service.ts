import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  IntentParsingResult,
  IntentParsingResponse,
  IntentParsingError,
  IntentData,
  RobotIntent,
  RobotIntentRegistry,
} from '../types/intent-parsing.types';

@Injectable()
export class IntentParsingService {
  private readonly logger = new Logger(IntentParsingService.name);
  private readonly openai: OpenAI;
  private robotIntentRegistries: RobotIntentRegistry[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
    });
  }

  /**
   * Register a robot's supported intents
   */
  public registerRobotIntents(registry: RobotIntentRegistry): void {
    const existingIndex = this.robotIntentRegistries.findIndex(
      (r) => r.robotName === registry.robotName,
    );

    if (existingIndex >= 0) {
      this.robotIntentRegistries[existingIndex] = registry;
    } else {
      this.robotIntentRegistries.push(registry);
    }

    this.logger.log(
      `Registered intents for robot ${registry.robotName}: ${registry.supportedIntents.map((i) => i.intent).join(', ')}`,
    );
  }

  /**
   * Parse user prompt to determine intent and extract entities
   */
  public async parsePromptIntent(
    messageText: string,
    conversationContext?: { currentRobot?: string; lastRobotMessage?: string },
  ): Promise<IntentParsingResult> {
    try {
      this.logger.debug(
        `Parsing intent for message: ${messageText.substring(0, 100)}...`,
      );

      // Build dynamic prompt combining base + personality + robot intent segments + subject harvest guidelines
      const systemPrompt = await this.buildSystemPrompt();

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Parse this user message and determine the appropriate robot and intent:

Message: "${messageText}"

${conversationContext?.currentRobot ? `Current conversation robot: ${conversationContext.currentRobot}` : ''}

${
  conversationContext?.lastRobotMessage
    ? `_ROBOT_LAST_RESPONSE_START_
Instructions: If the robot's last response is a continuation question, please route to last robot.
${conversationContext.lastRobotMessage}
_ROBOT_LAST_RESPONSE_END_`
    : ''
}

Respond with ONLY a valid JSON object (no markdown, no explanation) containing:
- intent: string (exact intent name)
- intentData: object with originalUserPrompt, subIntents array, and subjects object (following Subject Harvest guidelines above)
- devDebugRecommendedExecutor: string (suggested executor class name)
- devDebugRecommendedRobot: string (fallback robot name)

Available intents: generateSumoReport, generateSumoAnalysis, searchKnowledgeBase, getContextDynamic, assistUser
Available executors: SumoReportSingleJobExecutor, SumoReportMultiJobExecutor, KnowledgeBaseJobExecutor, ContextDynamicJobExecutor
Available robots: SlackyOpenAiAgent, AnthropicMarv, KnobbyOpenAiSearch

SUMO REPORT SUBINTENTS (for generateSumoReport intent):
- "submitActionReport": For analyzing submit action execution, webhooks, integrations
- "submissionCreatedForForm": For tracking form submissions, submission reports, submission data
- "submitActionsSelectedForExecution": For internal analysis only

SUMO ANALYSIS SUBINTENTS (for generateSumoAnalysis intent):
- "multiReportAnalysis": For comprehensive analysis combining multiple Sumo reports

KNOWLEDGE BASE SUBINTENTS (for searchKnowledgeBase intent):
- "topResults": For searching knowledge base documents and Slack conversations

CONTEXT DYNAMIC SUBINTENTS (for getContextDynamic intent):
- "getFormContext": For retrieving live form configuration and settings

IMPORTANT: Follow the harvest guidelines above for extracting subjects and dates. Only use the specified entity types and patterns from the guidelines.

Example response formats:
General assistance: {"intent":"assistUser","intentData":{"originalUserPrompt":"hello","subIntents":["generalAssistance"],"subjects":null},"devDebugRecommendedExecutor":"N/A","devDebugRecommendedRobot":"SlackyOpenAiAgent"}
Submission report with dates: {"intent":"generateSumoReport","intentData":{"originalUserPrompt":"submission report for form 12345","subIntents":["submissionCreatedForForm"],"subjects":{"formId":["12345"],"startDate":["TODAY_START_ISO8601"],"endDate":["TODAY_END_ISO8601"]}},"devDebugRecommendedExecutor":"SumoReportSingleJobExecutor","devDebugRecommendedRobot":"SlackyOpenAiAgent"}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        return this.createError(
          'No response from OpenAI',
          'Empty response received',
        );
      }

      // Parse the JSON response (handle markdown-wrapped JSON)
      let parsedResponse: any;
      try {
        // First try direct JSON parsing
        parsedResponse = JSON.parse(responseContent);
      } catch (parseError) {
        // If direct parsing fails, try to extract JSON from markdown blocks
        try {
          const jsonMatch = responseContent.match(
            /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
          );
          if (jsonMatch && jsonMatch[1]) {
            parsedResponse = JSON.parse(jsonMatch[1]);
            this.logger.debug(
              'Successfully extracted JSON from markdown block',
            );
          } else {
            throw new Error('No JSON block found in response');
          }
        } catch (secondParseError) {
          this.logger.error(
            `Failed to parse OpenAI response: ${responseContent}`,
          );
          this.logger.error('Original parse error:', parseError.message);
          this.logger.error(
            'Markdown extraction error:',
            secondParseError.message,
          );
          return this.createError(
            'Invalid JSON response',
            'Could not parse OpenAI response as JSON',
          );
        }
      }

      // Validate the response structure
      if (!parsedResponse.intent || !parsedResponse.intentData) {
        return this.createError(
          'Invalid response structure',
          'Missing required fields in response',
        );
      }

      // Ensure intentData has required fields
      const intentData: IntentData = {
        originalUserPrompt: messageText,
        subIntents: parsedResponse.intentData.subIntents || [],
        subjects: parsedResponse.intentData.subjects || {},
        ...parsedResponse.intentData,
      };

      const result: IntentParsingResponse = {
        intent: parsedResponse.intent,
        intentData,
        devDebugRecommendedExecutor: parsedResponse.devDebugRecommendedExecutor,
        devDebugRecommendedRobot: parsedResponse.devDebugRecommendedRobot,
      };

      this.logger.log(
        `Parsed intent: ${result.intent} (debug recommends executor: ${result.devDebugRecommendedExecutor})`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Intent parsing failed: ${error.message}`);
      return this.createError('Intent parsing failed', error.message);
    }
  }

  /**
   * Load harvest guidelines from files
   */
  private async loadHarvestGuidelines(): Promise<string> {
    try {
      const subjectHarvestPath = join(
        process.cwd(),
        'CONTEXT-DOCUMENTS',
        'HARVEST_SUBJECTS.md',
      );
      const dateHarvestPath = join(
        process.cwd(),
        'CONTEXT-DOCUMENTS',
        'HARVEST_DATES_SUMO.md',
      );

      const [subjectContent, dateContent] = await Promise.all([
        fs.readFile(subjectHarvestPath, 'utf8'),
        fs.readFile(dateHarvestPath, 'utf8'),
      ]);

      return `${subjectContent}\n\n${dateContent}`;
    } catch (error) {
      this.logger.error(`Failed to load harvest guidelines: ${error.message}`);
      // Fallback to basic guidelines
      return `# Subject Harvest
HARVEST SUBJECT IDS:
Extract any entity IDs mentioned in the query:
- Supported entities: account:accountId, authProvider:authProviderId, form:formId, submission:submissionId, submitAction:submitActionId, case:caseId, jira:jiraTicketId
- Return as object: {"formId": ["1234"], "submissionId": ["12304"]}
- If no subjects found, return null 'subjects: null'

# Date Harvest
HARVEST DATES (for Sumo queries):
- "past week" → startDate: 7 days ago, endDate: today
- Return as: {"startDate": ["2025-09-01"], "endDate": ["2025-09-05"]}`;
    }
  }

  /**
   * Build the system prompt by combining base + personality + robot intent segments
   */
  private async buildSystemPrompt(): Promise<string> {
    const harvestGuidelines = await this.loadHarvestGuidelines();

    const basePrompt = `You are an intelligent intent parsing system for iStackBuddy, a specialized AI assistant for Intellistack Forms Core troubleshooting.

Your task is to analyze user messages and determine:
1. What specific intent the user has
2. Extract standardized subjects and dates following the guidelines below

${harvestGuidelines}

Available robots and their intents:`;

    const personalityPrompt = `
Be precise and analytical in your intent classification. Focus on:
- Technical accuracy in robot selection
- Comprehensive entity extraction
- Clear intent categorization

When uncertain, prefer more specific robots over general ones.`;

    // Build robot intent segments
    const robotIntentSegments = this.robotIntentRegistries
      .map((registry) => {
        const intentsDescription = registry.supportedIntents
          .map(
            (intent) =>
              `  - ${intent.intent}: ${intent.description || 'No description'} (subIntents: ${intent.subIntents.join(', ')})`,
          )
          .join('\n');

        return `\n**${registry.robotName}**:\n${intentsDescription}`;
      })
      .join('\n');

    return `${basePrompt}${robotIntentSegments}\n${personalityPrompt}`;
  }

  /**
   * Create a standardized error response
   */
  private createError(error: string, reason: string): IntentParsingError {
    return { error, reason };
  }

  /**
   * Get all registered robot intents (for debugging/monitoring)
   */
  public getRegisteredIntents(): RobotIntentRegistry[] {
    return [...this.robotIntentRegistries];
  }

  /**
   * Get the system prompt for debugging (without making OpenAI call)
   */
  public async getSystemPromptForDebugging(): Promise<string> {
    return await this.buildSystemPrompt();
  }
}
