import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../interfaces/intent-handler.interface';
import {
  IntentParsingResponse,
  IntentData,
} from '../types/intent-parsing.types';

@Injectable()
export class IntentRouterService {
  private readonly logger = new Logger(IntentRouterService.name);
  private readonly intentHandlers = new Map<string, IntentHandler>();

  constructor() {}

  /**
   * Register an intent handler for specific intents
   */
  registerHandler(intent: string, handler: IntentHandler): void {
    this.intentHandlers.set(intent, handler);
    this.logger.log(`Registered intent handler for: ${intent}`);
  }

  /**
   * Route intent to appropriate intent handler
   * conversationId comes from intentData.conversationId
   */
  async routeIntent(
    intentData: IntentData & { intent: string },
  ): Promise<void> {
    const { intent } = intentData;

    this.logger.log(`=== INTENT ROUTER: Processing intent '${intent}' ===`);
    this.logger.log(
      `Available handlers: [${Array.from(this.intentHandlers.keys()).join(', ')}]`,
    );
    this.logger.log(`Intent data: ${JSON.stringify(intentData, null, 2)}`);
    this.logger.log(`Total registered handlers: ${this.intentHandlers.size}`);

    // Check if we have a specialized intent handler
    const handler = this.intentHandlers.get(intent);

    if (handler) {
      this.logger.log(
        `✅ FOUND INTENT HANDLER: Routing intent '${intent}' to intent handler`,
      );
      // Handler will send its own acknowledgment and messages
      await handler.executeIntent(intentData);
    } else {
      this.logger.error(
        `❌ NO INTENT HANDLER: No handler registered for intent '${intent}'`,
      );
      this.logger.error(
        `Available intents: ${Array.from(this.intentHandlers.keys()).join(', ')}`,
      );
      this.logger.error(`Requested intent: '${intent}'`);
      throw new Error(`No intent handler registered for intent: ${intent}`);
    }
  }

  /**
   * List all registered intent handlers
   */
  getRegisteredIntents(): string[] {
    return Array.from(this.intentHandlers.keys());
  }
}
