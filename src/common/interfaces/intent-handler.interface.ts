import { IntentData, RobotIntent } from '../types/intent-parsing.types';

/**
 * Interface for intent handlers that can process intents
 * before routing to robots or instead of robots
 */
export interface IntentHandler {
  /**
   * Define which intents this handler supports
   */
  getSupportedIntents(): RobotIntent[];

  /**
   * Execute the intent with provided data
   * conversationId comes from intentData.conversationId
   * No callbacks - all messages go through conversation.addMessage*() methods
   */
  executeIntent(intentData: IntentData): Promise<void>;
}
