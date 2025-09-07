import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { IntentParsingResponse, IntentResult, isIntentParsingError } from '../types/intent-parsing.types';

@Injectable()
export class IntentParsingService {
  private readonly logger = new Logger(IntentParsingService.name);
  private readonly openAIClient: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    this.openAIClient = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Parse user intent and route to appropriate robot
   * @param messageText - The user's message
   * @param conversationContext - Optional context (e.g., last robot used)
   * @returns Promise<IntentParsingResponse> - Intent result or error
   */
  async parseIntent(
    messageText: string, 
    conversationContext?: { currentRobot?: string }
  ): Promise<IntentParsingResponse> {
    
    try {
      this.logger.log('Starting intent parsing...');
      this.logger.log(`Message: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`);
      
      if (conversationContext?.currentRobot) {
        this.logger.log(`Conversation context - current robot: ${conversationContext.currentRobot}`);
      }

      const intentParsingPrompt = this.buildIntentParsingPrompt(messageText, conversationContext);
      
      const response = await this.openAIClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: intentParsingPrompt },
          { role: 'user', content: messageText }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 1000,
      });

      const resultText = response.choices[0]?.message?.content?.trim();
      if (!resultText) {
        throw new Error('Empty response from OpenAI');
      }

      this.logger.log('OpenAI raw response:', resultText);

      const parsedResult = JSON.parse(resultText) as IntentParsingResponse;
      
      // Validate the result
      if (isIntentParsingError(parsedResult)) {
        this.logger.warn('Intent parsing returned error:', parsedResult);
        return parsedResult;
      }

      // Validate required fields for successful parsing
      if (!parsedResult.robotName || !parsedResult.intent || !parsedResult.intentData) {
        throw new Error('Invalid response format - missing required fields');
      }

      this.logger.log('Intent parsing successful:', {
        robotName: parsedResult.robotName,
        intent: parsedResult.intent
      });

      return parsedResult;

    } catch (error) {
      this.logger.error('Error during intent parsing:', error);
      
      // Return structured error response
      return {
        error: 'Intent parsing failed',
        reason: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Build the intent parsing prompt with current robot context
   */
  private buildIntentParsingPrompt(messageText: string, conversationContext?: { currentRobot?: string }): string {
    const contextSection = conversationContext?.currentRobot 
      ? `\nCONVERSATION CONTEXT:\n- Current robot in conversation: ${conversationContext.currentRobot}\n- Consider conversation continuity when parsing intent\n`
      : '';

    return `You are an Intent Parser Robot. Your job is to analyze user requests and determine which specialized robot should handle them.

CRITICAL: You must ALWAYS return this exact JSON format - NEVER return queryName/subject format:

{
  "robotName": "[robot.name property]",
  "intent": "[action category]",  
  "intentData": {
    "originalUserPrompt": "[full user message]",
    "subIntents": ["[specific-actions-for-robot]"],
    "subjects": {
      "formId": ["123", "456"],
      "submissionId": ["567890"],
      "case": ["00821037"],
      "jira": ["FORM-3545"],
      "account": ["123456"],
      "authProvider": ["789012"]
    }
  }
}

AVAILABLE ROBOTS AND THEIR INTENTS:

🔧 **AnthropicMarv** (robotName: "AnthropicMarv")
- Intent: "manageForm"
- Required: formId (always required for Marv tools)
- SubIntents: ["validateLogic", "validateCalculations", "getOverview", "troubleshootWebhooks", "debugSubmissions", "checkIntegrations"]
- Use when: troubleshoot form errors, validate logic, manage fields, debug calculations, webhook issues
- Example subIntent selection: troubleshooting webhooks → "troubleshootWebhooks", form validation → "validateLogic"

🔍 **KnobbyOpenAiSearch** (robotName: "KnobbyOpenAiSearch")
- Intent: "searchKnowledge"
- Required: query text
- SubIntents: ["comprehensive", "semantic", "troubleshootingGuide", "documentation", "bestPractices"]
- Use when: search documentation, find information, get troubleshooting guides, find solutions
- Example subIntent selection: find docs → "documentation", need help → "troubleshootingGuide"

📊 **KnobbyOpenAiSumoReport** (robotName: "KnobbyOpenAiSumoReport")  
- Intent: "generateReport"
- Required: queryName, subject
- SubIntents: ["submitActionReport", "submissionCreatedReport", "authProviderMetrics", "jobManagement"]
- Use when: analyze logs, generate reports, track submit actions, get submission metrics

🤖 **SlackyOpenAiAgent** (robotName: "SlackyOpenAiAgent") - CATCH-ALL ROBOT
- Intent: "assistUser"
- Required: None (handles any request)
- SubIntents: ["handleFollowUp", "clarifyRequest", "generalAssistance", "conversation"]
- Use when: Intent parsing fails, unclear requests, general conversation, follow-up questions

${contextSection}
HARVEST SUBJECTS (Extract entity IDs from user text):
- **formId**: Extract form IDs (numbers like "123", "4567", "form 1234")
- **submissionId**: Extract submission IDs (longer numbers, "submission 567890")  
- **case**: Extract case numbers (format "00821037", "case 12345")
- **jira**: Extract JIRA tickets (format "FORM-3545", "TECH-1234")
- **account**: Extract account IDs (numbers or "account 123456")
- **authProvider**: Extract auth provider IDs (numbers or names)

ROBOT SELECTION LOGIC:
1. **Form troubleshooting + formId present** → AnthropicMarv
   - Choose subIntents based on issue: webhooks → "troubleshootWebhooks", validation → "validateLogic"
2. **Search/documentation requests** → KnobbyOpenAiSearch  
   - Choose subIntents: documentation search → "documentation", troubleshooting help → "troubleshootingGuide"
3. **Report/analytics/logs + specific data needed** → KnobbyOpenAiSumoReport
   - Choose subIntents based on report type: submit actions → "submitActionReport"
4. **Everything else** → SlackyOpenAiAgent (catch-all)
   - Choose subIntents: follow-up → "handleFollowUp", unclear → "clarifyRequest"

SUBINTENT SELECTION RULES:
- ALWAYS include 1-2 relevant subIntents in the intentData
- Choose subIntents that match the user's specific request  
- For troubleshooting webhooks → use "troubleshootWebhooks" 
- For general form issues → use "getOverview" 
- For documentation searches → use "documentation"
- When unclear → use "clarifyRequest" for SlackyOpenAiAgent

INTELLIGENT DATE PARSING:
- Current year: 2025
- "july 5" → "2025-07-05" 
- "from the 5th to 9th" → "2025-[current-month]-05" to "2025-[current-month]-09"
- "since the 9th" → "2025-[current-month]-09" to "2025-[current-month]-[today]"
- "last week" → calculate previous week dates
- "yesterday" → yesterday's date in YYYY-MM-DD format

STRICT PARSING RULES:
- If dates are ambiguous beyond intelligent parsing → return error
- If required parameters missing for selected robot → return error  
- If intent truly unclear → route to SlackyOpenAiAgent
- NEVER make assumptions about missing data
- ALWAYS extract originalUserPrompt exactly as provided
- Subjects array should contain ALL found entities (unreliable by design - used for pattern detection)

ERROR FORMAT (when parsing fails):
{
  "error": "Cannot determine intent",
  "reason": "Specific reason why parsing failed"
}`;
  }
}
