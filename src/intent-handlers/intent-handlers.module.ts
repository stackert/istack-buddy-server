import { Module } from '@nestjs/common';
import { SumoReportJobExecutor } from './sumo-report-job-executor.service';
import { IStackInfoModule } from '../istack-buddy-slack-api/istack-info.module';
import { FileManagerModule } from '../file-manager/file-manager.module';
import { RobotModule } from '../robots/robot.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [IStackInfoModule, FileManagerModule, RobotModule, LoggerModule],
  providers: [SumoReportJobExecutor],
  exports: [SumoReportJobExecutor],
})
export class IntentHandlersModule {}
