import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
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
    conversationContext?: { currentRobot?: string },
  ): Promise<IntentParsingResult> {
    try {
      this.logger.debug(
        `Parsing intent for message: ${messageText.substring(0, 100)}...`,
      );

      // Build dynamic prompt combining base + personality + robot intent segments
      const systemPrompt = this.buildSystemPrompt();

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

Respond with a JSON object containing:
- robotName: string (exact robot name)
- intent: string (exact intent name)
- intentData: object with originalUserPrompt, subIntents array, and subjects object`,
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

      // Parse the JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (parseError) {
        this.logger.error(
          `Failed to parse OpenAI response: ${responseContent}`,
        );
        return this.createError(
          'Invalid JSON response',
          'Could not parse OpenAI response as JSON',
        );
      }

      // Validate the response structure
      if (
        !parsedResponse.robotName ||
        !parsedResponse.intent ||
        !parsedResponse.intentData
      ) {
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
        robotName: parsedResponse.robotName,
        intent: parsedResponse.intent,
        intentData,
      };

      this.logger.log(
        `Parsed intent: ${result.intent} for robot: ${result.robotName}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Intent parsing failed: ${error.message}`);
      return this.createError('Intent parsing failed', error.message);
    }
  }

  /**
   * Build the system prompt by combining base + personality + robot intent segments
   */
  private buildSystemPrompt(): string {
    const basePrompt = `You are an intelligent intent parsing system for iStackBuddy, a specialized AI assistant for Intellistack Forms Core troubleshooting.

Your task is to analyze user messages and determine:
1. Which robot should handle the request
2. What specific intent the user has
3. Extract relevant entities and subjects from the message

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
}
