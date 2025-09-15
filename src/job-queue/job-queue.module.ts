import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JobQueueService } from './job-queue.service';
import { JobQueueController } from './job-queue.controller';
import { BullBoardService } from './bull-board.service';
import { MessageQueueProcessor } from './processors/message-queue.processor';
import { FileProcessingProcessor } from './processors/file-processing.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { FileManagerModule } from '../file-manager/file-manager.module';
import { IStackInfoModule } from '../istack-buddy-slack-api/istack-info.module';

@Module({
  imports: [
    FileManagerModule,
    IStackInfoModule,
    BullModule.forRoot({
      redis: {
        host: process.env.BULLMQ_REDIS_HOST || 'localhost',
        port: parseInt(process.env.BULLMQ_REDIS_PORT || '6379'),
        password: process.env.BULLMQ_REDIS_PASSWORD || undefined,
        db: parseInt(process.env.BULLMQ_REDIS_DB || '1'),
      },
    }),
    BullModule.registerQueue(
      {
        name: 'message-queue',
        defaultJobOptions: {
          removeOnComplete: parseInt(
            process.env.JOB_QUEUE_REMOVE_ON_COMPLETE || '100',
          ),
          removeOnFail: parseInt(process.env.JOB_QUEUE_REMOVE_ON_FAIL || '50'),
          attempts: parseInt(process.env.JOB_QUEUE_ATTEMPTS || '3'),
          backoff: {
            type: process.env.JOB_QUEUE_BACKOFF_TYPE || 'exponential',
            delay: parseInt(process.env.JOB_QUEUE_BACKOFF_DELAY || '2000'),
          },
        },
      },
      {
        name: 'file-processing',
        defaultJobOptions: {
          removeOnComplete: parseInt(
            process.env.JOB_QUEUE_REMOVE_ON_COMPLETE || '100',
          ),
          removeOnFail: parseInt(process.env.JOB_QUEUE_REMOVE_ON_FAIL || '50'),
          attempts: parseInt(process.env.JOB_QUEUE_ATTEMPTS || '3'),
          backoff: {
            type: process.env.JOB_QUEUE_BACKOFF_TYPE || 'exponential',
            delay: parseInt(process.env.JOB_QUEUE_BACKOFF_DELAY || '2000'),
          },
        },
      },
      {
        name: 'notifications',
        defaultJobOptions: {
          removeOnComplete: parseInt(
            process.env.JOB_QUEUE_REMOVE_ON_COMPLETE || '100',
          ),
          removeOnFail: parseInt(process.env.JOB_QUEUE_REMOVE_ON_FAIL || '50'),
          attempts: parseInt(process.env.JOB_QUEUE_ATTEMPTS || '3'),
          backoff: {
            type: process.env.JOB_QUEUE_BACKOFF_TYPE || 'exponential',
            delay: parseInt(process.env.JOB_QUEUE_BACKOFF_DELAY || '2000'),
          },
        },
      },
      {
        name: 'sumo-query',
        defaultJobOptions: {
          removeOnComplete: parseInt(
            process.env.JOB_QUEUE_REMOVE_ON_COMPLETE || '50',
          ),
          removeOnFail: parseInt(process.env.JOB_QUEUE_REMOVE_ON_FAIL || '25'),
          attempts: 1, // Don't retry Sumo jobs automatically
          delay: 0, // Process immediately
        },
      },
    ),
  ],
  providers: [
    JobQueueService,
    BullBoardService,
    MessageQueueProcessor,
    FileProcessingProcessor,
    NotificationProcessor,
  ],
  controllers: [JobQueueController],
  exports: [JobQueueService],
})
export class JobQueueModule {}
