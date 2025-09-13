import { Module, forwardRef } from '@nestjs/common';
import { SumoReportSingleJobExecutor } from './sumo-report-single-job-executor.service';
import { SumoReportMultiJobExecutor } from './sumo-report-multi-job-executor.service';
import { KnowledgeBaseJobExecutor } from './knowledge-base-job-executor.service';
import { ContextDynamicJobExecutor } from './context-dynamic-job-executor.service';
import { IStackInfoModule } from '../istack-buddy-slack-api/istack-info.module';
import { FileManagerModule } from '../file-manager/file-manager.module';
import { RobotModule } from '../robots/robot.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';
import { LoggerModule } from '../common/logger/logger.module';
@Module({
  imports: [
    IStackInfoModule,
    FileManagerModule, // Still needed for Sumo executors
    RobotModule,
    forwardRef(() => ChatManagerModule),
    LoggerModule,
  ],
  providers: [
    SumoReportSingleJobExecutor,
    SumoReportMultiJobExecutor,
    KnowledgeBaseJobExecutor,
    ContextDynamicJobExecutor,
  ],
  exports: [
    SumoReportSingleJobExecutor,
    SumoReportMultiJobExecutor,
    KnowledgeBaseJobExecutor,
    ContextDynamicJobExecutor,
  ],
})
export class IntentHandlersModule {}
