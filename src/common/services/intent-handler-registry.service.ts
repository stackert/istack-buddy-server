import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { IntentRouterService } from './intent-router.service';
import { SumoReportSingleJobExecutor } from '../../intent-handlers/sumo-report-single-job-executor.service';
import { SumoReportMultiJobExecutor } from '../../intent-handlers/sumo-report-multi-job-executor.service';
import { KnowledgeBaseJobExecutor } from '../../intent-handlers/knowledge-base-job-executor.service';
import { ContextDynamicJobExecutor } from '../../intent-handlers/context-dynamic-job-executor.service';
import { AssistUserJobExecutor } from '../../intent-handlers/assist-user-job-executor.service';
import { IntentHandler } from '../interfaces/intent-handler.interface';

@Injectable()
export class IntentHandlerRegistryService implements OnModuleInit {
  private readonly logger = new Logger(IntentHandlerRegistryService.name);

  constructor(
    private readonly intentRouter: IntentRouterService,
    private readonly sumoReportSingleExecutor: SumoReportSingleJobExecutor,
    private readonly sumoReportMultiExecutor: SumoReportMultiJobExecutor,
    private readonly knowledgeBaseExecutor: KnowledgeBaseJobExecutor,
    private readonly contextDynamicExecutor: ContextDynamicJobExecutor,
    private readonly assistUserExecutor: AssistUserJobExecutor,
  ) {}

  onModuleInit() {
    this.logger.log('Registering intent handlers...');
    this.registerHandler(this.sumoReportSingleExecutor);
    this.registerHandler(this.sumoReportMultiExecutor);
    this.registerHandler(this.knowledgeBaseExecutor);
    this.registerHandler(this.contextDynamicExecutor);
    this.registerHandler(this.assistUserExecutor);
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
