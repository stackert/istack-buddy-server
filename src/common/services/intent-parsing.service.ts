import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  IntentData,
  IntentParsingError,
  IntentParsingResponse,
  IntentParsingResult,
  PreviousConversationContext,
  RobotIntentRegistry,
} from '../types/intent-parsing.types';

// Load intent parsing prompt and harvest guidelines at module level (build time)
let INTENT_PARSE_PROMPT: string;
let HARVEST_DATES_CONTENT: string;
let HARVEST_SUBJECTS_CONTENT: string;

try {
  INTENT_PARSE_PROMPT = readFileSync(
    join(process.cwd(), 'CONTEXT-DOCUMENTS', 'INTENT_PARSE.md'),
    'utf-8',
  );
} catch (error) {
  throw new Error(`Failed to load INTENT_PARSE.md: ${error.message}`);
}

try {
  HARVEST_DATES_CONTENT = readFileSync(
    join(process.cwd(), 'CONTEXT-DOCUMENTS', 'HARVEST_DATES_SUMO.md'),
    'utf-8',
  );
} catch (error) {
  throw new Error(`Failed to load HARVEST_DATES_SUMO.md: ${error.message}`);
}

try {
  HARVEST_SUBJECTS_CONTENT = readFileSync(
    join(process.cwd(), 'CONTEXT-DOCUMENTS', 'HARVEST_SUBJECTS.md'),
    'utf-8',
  );
} catch (error) {
  throw new Error(`Failed to load HARVEST_SUBJECTS.md: ${error.message}`);
}

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
    previousConversationContext?: PreviousConversationContext,
  ): Promise<IntentParsingResult> {
    const promptText = this.buildPrompt(
      messageText,
      previousConversationContext,
    );
    const result = await this.executePrompt(promptText);

    // Merge subjects for conversation continuations
    if (
      'intentData' in result &&
      result.intentData.isConversationContinuation &&
      previousConversationContext?.lastIntent?.intentData?.subjects
    ) {
      // Check if subjects is null, empty object, or has empty arrays
      const hasEmptySubjects =
        result.intentData.subjects === null ||
        (result.intentData.subjects &&
          Object.keys(result.intentData.subjects).length === 0) ||
        (result.intentData.subjects &&
          Object.values(result.intentData.subjects).every(
            (arr) => !arr || arr.length === 0,
          ));

      if (hasEmptySubjects) {
        result.intentData.subjects =
          previousConversationContext.lastIntent.intentData.subjects;
      }
    }

    return result;
  }

  /**
   * Build intent parsing prompt with conversation context
   * Maybe not necessary to be public
   */
  public buildPrompt(
    messageText: string,
    previousConversationContext?: PreviousConversationContext,
  ): string {
    const contextParts = [];

    // Add previous interaction context section
    contextParts.push(
      this.parseContextPreviousConversation(previousConversationContext),
    );

    // Add current date
    contextParts.push(this.parseContextTodaysDate());

    // Add all prompt sections to the array
    contextParts.push(INTENT_PARSE_PROMPT);
    contextParts.push(this.parseContextHarvestSubjects());
    contextParts.push(this.parseContextHarvestDates());
    contextParts.push(this.parseContextUserRequest(messageText));

    // Join all parts
    return contextParts.join('\n\n');
  }

  /**
   * Parse previous conversation context into formatted string
   */
  private parseContextPreviousConversation(
    previousConversationContext?: PreviousConversationContext,
  ): string {
    // Quick return for no context
    if (!previousConversationContext) {
      return `_PREVIOUS_INTERACTION_START_
No Previous Conversation Context - Likely new conversation
_PREVIOUS_INTERACTION_END_`;
    }

    // Handle populated context
    const lastRobotResponse = previousConversationContext.lastRobotMessageText;
    const lastIntent = JSON.stringify(
      previousConversationContext.lastIntent,
      null,
      2,
    );
    const lastRobotName =
      previousConversationContext.lastIntent?.devDebugRecommendedRobot;

    return `_PREVIOUS_INTERACTION_START_
Previous robot name: ${lastRobotName}
Previous robot response: ${lastRobotResponse}
Previous intent: ${lastIntent}
_PREVIOUS_INTERACTION_END_`;
  }

  /**
   * Parse today's date into formatted string
   */
  private parseContextTodaysDate(): string {
    const currentDate = new Date().toISOString();
    return `_TODAYS_DATE_START_
${currentDate}
_TODAYS_DATE_END_`;
  }

  /**
   * Parse harvest subjects context into formatted string
   */
  private parseContextHarvestSubjects(): string {
    return `_HARVEST_SUBJECTS_START_
${HARVEST_SUBJECTS_CONTENT}
_HARVEST_SUBJECTS_END_`;
  }

  /**
   * Parse harvest dates context into formatted string
   */
  private parseContextHarvestDates(): string {
    return `_HARVEST_DATES_START_
${HARVEST_DATES_CONTENT}
_HARVEST_DATES_END_`;
  }

  /**
   * Parse user request context into formatted string
   */
  private parseContextUserRequest(messageText: string): string {
    return `_USER_REQUEST_START_
${messageText}
_USER_REQUEST_END_`;
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
   * Execute prompt with AI API
   */
  public async executePrompt(promptText: string): Promise<IntentParsingResult> {
    try {
      this.logger.debug(`Executing prompt with AI API...`);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        return this.createError(
          'No response from AI',
          'Empty response from OpenAI',
        );
      }

      // Parse the JSON response
      const parsedResponse = JSON.parse(responseText);

      // Build the response object
      const intentResponse: IntentParsingResponse = {
        intent: parsedResponse.intent,
        intentData: parsedResponse.intentData,
        devDebugRecommendedExecutor: parsedResponse.devDebugRecommendedExecutor,
        devDebugRecommendedRobot: parsedResponse.devDebugRecommendedRobot,
      };

      this.logger.log(
        `Parsed intent: ${intentResponse.intent} (debug recommends executor: ${intentResponse.devDebugRecommendedExecutor})`,
      );

      return intentResponse;
    } catch (error) {
      this.logger.error(`AI execution failed: ${error.message}`);
      return this.createError('AI execution failed', error.message);
    }
  }
}
