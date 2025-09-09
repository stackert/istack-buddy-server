import { IntentData, RobotIntent } from '../types/intent-parsing.types';
import { IStreamingCallbacks } from '../../robots/types';

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
   * Execute the intent with provided data and callbacks
   */
  executeIntent(
    intentData: IntentData,
    callbacks: IStreamingCallbacks,
  ): Promise<void>;
}
