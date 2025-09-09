import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { IntentRouterService } from './intent-router.service';
import { SumoReportJobExecutor } from '../../intent-handlers/sumo-report-job-executor.service';
import { IntentHandler } from '../interfaces/intent-handler.interface';

@Injectable()
export class IntentHandlerRegistryService implements OnModuleInit {
  private readonly logger = new Logger(IntentHandlerRegistryService.name);

  constructor(
    private readonly intentRouter: IntentRouterService,
    private readonly sumoReportExecutor: SumoReportJobExecutor,
  ) {}

  onModuleInit() {
    this.logger.log('Registering intent handlers...');
    this.registerHandler(this.sumoReportExecutor);
    this.logger.log('Intent handler registration completed');
  }

  private registerHandler(handler: IntentHandler) {
    const supportedIntents = handler.getSupportedIntents();
    supportedIntents.forEach((intentConfig) => {
      this.intentRouter.registerHandler(intentConfig.intent, handler);
      this.logger.debug(
        `Registered handler for intent: ${intentConfig.intent}`,
      );
    });
  }
}
