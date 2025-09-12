import { Module, forwardRef } from '@nestjs/common';
import { SumoReportJobExecutor } from './sumo-report-job-executor.service';
import { IStackInfoModule } from '../istack-buddy-slack-api/istack-info.module';
import { FileManagerModule } from '../file-manager/file-manager.module';
import { RobotModule } from '../robots/robot.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';
import { LoggerModule } from '../common/logger/logger.module';
@Module({
  imports: [
    IStackInfoModule,
    FileManagerModule,
    RobotModule,
    forwardRef(() => ChatManagerModule),
    LoggerModule,
  ],
  providers: [SumoReportJobExecutor],
  exports: [SumoReportJobExecutor],
})
export class IntentHandlersModule {}
