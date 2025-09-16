import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { IntentData } from '../common/types/intent-parsing.types';

@Injectable()
export class AssistUserJobExecutor implements IntentHandler {
  private readonly logger = new Logger(AssistUserJobExecutor.name);

  getSupportedIntents() {
    return [
      {
        intent: 'assistUser',
        description: 'General user assistance - placeholder handler',
        subIntents: ['generalAssistance'],
      },
    ];
  }

  async executeIntent(intentData: IntentData): Promise<void> {
    this.logger.log(
      `AssistUser intent received: ${JSON.stringify(intentData, null, 2)}`,
    );

    // Empty function for now - just log the intent
    this.logger.log('AssistUser handler executed (no-op)');
  }
}
