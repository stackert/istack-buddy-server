import { Injectable, Logger } from '@nestjs/common';
import { JobQueueService } from './job-queue.service';

@Injectable()
export class ExampleUsageService {
  private readonly logger = new Logger(ExampleUsageService.name);

  constructor(private readonly jobQueueService: JobQueueService) {}

  /**
   * Example: Queue a message delivery job
   */
  async queueExampleMessageDelivery(userId: string, messageId: string) {
    this.logger.log(
      `Queuing message delivery for user ${userId}, message ${messageId}`,
    );

    const job = await this.jobQueueService.queueMessageDelivery(
      userId,
      messageId,
      {
        delay: 0, // No delay
        priority: 5, // Normal priority
        attempts: 3, // Retry 3 times
      },
    );

    this.logger.log(`Message delivery job queued with ID: ${job.id}`);
    return job;
  }

  /**
   * Example: Queue a file processing job
   */
  async queueExampleFileProcessing(
    fileId: string,
    uploaderId: string,
    roomId: string,
    storageClass: string = 'standard',
  ) {
    this.logger.log(`Queuing file processing for file ${fileId}`);

    const job = await this.jobQueueService.queueFileProcessing(
      fileId,
      uploaderId,
      roomId,
      storageClass,
      {
        requiresVirusScanning: true,
        generateThumbnails: true,
        priority: 'normal',
        delay: 0,
      },
    );

    this.logger.log(`File processing job queued with ID: ${job.id}`);
    return job;
  }

  /**
   * Example: Queue a notification job
   */
  async queueExampleNotification(
    userId: string,
    type: 'message' | 'file_ready' | 'system' | 'error',
    title: string,
    content: string,
  ) {
    this.logger.log(`Queuing ${type} notification for user ${userId}`);

    const job = await this.jobQueueService.queueNotification(
      userId,
      type,
      title,
      content,
      {
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'example-service',
        },
        priority: type === 'error' ? 'high' : 'normal',
        delay: 0,
      },
    );

    this.logger.log(`Notification job queued with ID: ${job.id}`);
    return job;
  }

  /**
   * Example: Get queue statistics
   */
  async getExampleQueueStats() {
    this.logger.log('Getting queue statistics');

    const stats = await this.jobQueueService.getAllQueueStats();

    this.logger.log('Queue statistics:', stats);
    return stats;
  }

  /**
   * Example: Clean up old jobs
   */
  async cleanupExampleJobs() {
    this.logger.log('Cleaning up old jobs');

    // Clean completed jobs older than 1 hour
    await this.jobQueueService.cleanCompletedJobs(60 * 60 * 1000);

    // Clean failed jobs older than 1 day
    await this.jobQueueService.cleanFailedJobs(24 * 60 * 60 * 1000);

    this.logger.log('Job cleanup completed');
  }
}
