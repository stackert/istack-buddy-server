import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JobQueueService } from './job-queue.service';
import { JobQueueController } from './job-queue.controller';
import { BullBoardService } from './bull-board.service';
import { MessageQueueProcessor } from './processors/message-queue.processor';
import { FileProcessingProcessor } from './processors/file-processing.processor';
import { NotificationProcessor } from './processors/notification.processor';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.BULLMQ_REDIS_HOST || 'localhost',
        port: parseInt(process.env.BULLMQ_REDIS_PORT || '6379'),
        password: process.env.BULLMQ_REDIS_PASSWORD || undefined,
        db: parseInt(process.env.BULLMQ_REDIS_DB || '1'),
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: parseInt(process.env.JOB_QUEUE_ATTEMPTS || '3'),
        backoff: {
          type: (process.env.JOB_QUEUE_BACKOFF_TYPE as any) || 'exponential',
          delay: parseInt(process.env.JOB_QUEUE_BACKOFF_DELAY || '2000'),
        },
      },
    }),
    BullModule.registerQueue(
      { name: 'message-queue' },
      { name: 'file-processing' },
      { name: 'notifications' },
    ),
  ],
  controllers: [JobQueueController],
  providers: [
    JobQueueService,
    JobQueueController,
    BullBoardService,
    MessageQueueProcessor,
    FileProcessingProcessor,
    NotificationProcessor,
  ],
  exports: [JobQueueService, BullBoardService, BullModule],
})
export class JobQueueModule {}
