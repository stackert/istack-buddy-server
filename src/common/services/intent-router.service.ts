import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../interfaces/intent-handler.interface';
import { IntentParsingResponse } from '../types/intent-parsing.types';
import { IStreamingCallbacks } from '../../robots/types';

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
   */
  async routeIntent(
    intentResult: IntentParsingResponse,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    const { intent, intentData } = intentResult;

    this.logger.log(`=== INTENT ROUTER: Processing intent '${intent}' ===`);
    this.logger.log(
      `Available handlers: [${Array.from(this.intentHandlers.keys()).join(', ')}]`,
    );
    this.logger.log(`Intent data: ${JSON.stringify(intentData, null, 2)}`);

    // Check if we have a specialized intent handler
    const handler = this.intentHandlers.get(intent);

    if (handler) {
      this.logger.log(
        `✅ FOUND INTENT HANDLER: Routing intent '${intent}' to intent handler`,
      );
      await handler.executeIntent(intentData, callbacks);
    } else {
      this.logger.error(
        `❌ NO INTENT HANDLER: No handler registered for intent '${intent}'`,
      );
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
