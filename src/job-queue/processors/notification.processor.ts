import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationJobData } from '../types';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  @Process('send-notification')
  async handleNotification(job: Job<NotificationJobData>): Promise<void> {
    const { userId, intent, data } = job.data;

    this.logger.log(
      `Processing notification intent '${intent}' for user ${userId}`,
    );

    try {
      // Update job progress
      await job.updateProgress(10);

      // Validate notification data
      this.validateNotificationData(job.data);

      await job.updateProgress(20);

      // Process the intent
      await this.processIntent(userId, intent, data, job);

      await job.updateProgress(100);
      this.logger.log(
        `Notification intent '${intent}' processed successfully for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process notification intent '${intent}' for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  private validateNotificationData(data: NotificationJobData): void {
    if (!data.userId || typeof data.userId !== 'string') {
      throw new Error('Invalid userId');
    }

    if (!data.intent || typeof data.intent !== 'string') {
      throw new Error('Invalid intent');
    }

    if (!data.data || typeof data.data !== 'object') {
      throw new Error('Invalid data - must be an object');
    }
  }

  private async processIntent(
    userId: string,
    intent: string,
    data: Record<string, any>,
    job: Job,
  ): Promise<void> {
    this.logger.debug(`Processing intent '${intent}' for user ${userId}`);

    // Update progress
    await job.updateProgress(30);

    // Log the intent for now - this will be wired up to Slacky later
    const intentLog = {
      userId,
      intent,
      data,
      timestamp: new Date().toISOString(),
      status: 'logged',
      // Future: this will be sent to Slacky for processing
    };

    await job.updateProgress(60);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    await job.updateProgress(90);

    this.logger.log(`Intent logged: ${JSON.stringify(intentLog, null, 2)}`);

    // TODO: In the future, this will:
    // 1. Send the intent to Slacky for processing
    // 2. Handle Slacky's response
    // 3. Log the result
    // 4. Potentially trigger follow-up actions
  }
}
