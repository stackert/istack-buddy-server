import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../interfaces/intent-handler.interface';
import { IntentParsingResponse } from '../types/intent-parsing.types';
import { IStreamingCallbacks } from '../../robots/types';
import { RobotService } from '../../robots/robot.service';

@Injectable()
export class IntentRouterService {
  private readonly logger = new Logger(IntentRouterService.name);
  private readonly intentHandlers = new Map<string, IntentHandler>();

  constructor(private readonly robotService: RobotService) {}

  /**
   * Register an intent handler for specific intents
   */
  registerHandler(intent: string, handler: IntentHandler): void {
    this.intentHandlers.set(intent, handler);
    this.logger.log(`Registered intent handler for: ${intent}`);
  }

  /**
   * Route intent to appropriate handler or robot
   */
  async routeIntent(
    intentResult: IntentParsingResponse,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    const { intent, intentData, robotName } = intentResult;

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
      this.logger.log(
        `❌ NO INTENT HANDLER: Routing intent '${intent}' to robot: ${robotName}`,
      );
      // Fallback to robot (existing behavior)
      const robot = this.robotService.getRobotByName(robotName);
      if (!robot) {
        throw new Error(`Robot ${robotName} not found`);
      }

      if (
        'executeIntent' in robot &&
        typeof robot.executeIntent === 'function'
      ) {
        await robot.executeIntent(intentData, callbacks);
      } else {
        // Fallback to existing acceptMessageStreamResponse
        const message = {
          id: 'intent-execution-' + Date.now(),
          content: {
            type: 'text/plain',
            payload: intentData.originalUserPrompt,
          },
          conversationId: 'intent-conversation',
          authorUserId: null,
          fromRole: 'customer' as any,
          toRole: 'robot' as any,
          messageType: 'text' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await (robot as any).acceptMessageStreamResponse(message, callbacks);
      }
    }
  }

  /**
   * List all registered intent handlers
   */
  getRegisteredIntents(): string[] {
    return Array.from(this.intentHandlers.keys());
  }
}
