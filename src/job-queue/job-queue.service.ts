import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bullmq';
import {
  MessageQueueJobData,
  FileProcessingJobData,
  NotificationJobData,
  QueueStats,
} from './types';

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @InjectQueue('message-queue') private messageQueue: Queue,
    @InjectQueue('file-processing') private fileProcessingQueue: Queue,
    @InjectQueue('notifications') private notificationQueue: Queue,
  ) {}

  // Message Queue Methods
  async addMessageJob(data: MessageQueueJobData): Promise<Job> {
    try {
      const job = await this.messageQueue.add('process-message', data, {
        priority: data.priority || 0,
        delay: data.delay || 0,
        jobId: `message-${data.messageId}-${Date.now()}`,
      });

      this.logger.debug(`Message job added: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add message job: ${error.message}`);
      throw error;
    }
  }

  // File Processing Methods
  async addFileProcessingJob(data: FileProcessingJobData): Promise<Job> {
    try {
      const job = await this.fileProcessingQueue.add('process-file', data, {
        priority: data.priority || 0,
        delay: data.delay || 0,
        jobId: `file-${data.fileId}-${data.operation}-${Date.now()}`,
      });

      this.logger.debug(`File processing job added: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add file processing job: ${error.message}`);
      throw error;
    }
  }

  // Notification Methods
  async addNotificationJob(data: NotificationJobData): Promise<Job> {
    try {
      const job = await this.notificationQueue.add('send-notification', data, {
        priority: data.priority || 0,
        delay: data.delay || 0,
        jobId: `notification-${data.userId}-${data.intent}-${Date.now()}`,
      });

      this.logger.debug(`Notification job added: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add notification job: ${error.message}`);
      throw error;
    }
  }

  // Job Management Methods
  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    try {
      const queue = this.getQueueByName(queueName);
      const job = await queue.getJob(jobId);
      return job || null;
    } catch (error) {
      this.logger.error(
        `Failed to get job ${jobId} from ${queueName}: ${error.message}`,
      );
      throw error;
    }
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        throw new Error(`Job ${jobId} not found in queue ${queueName}`);
      }

      await job.retry();
      this.logger.log(`Job ${jobId} retried in queue ${queueName}`);
    } catch (error) {
      this.logger.error(
        `Failed to retry job ${jobId} in ${queueName}: ${error.message}`,
      );
      throw error;
    }
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        throw new Error(`Job ${jobId} not found in queue ${queueName}`);
      }

      await job.remove();
      this.logger.log(`Job ${jobId} removed from queue ${queueName}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove job ${jobId} from ${queueName}: ${error.message}`,
      );
      throw error;
    }
  }

  // Queue Management Methods
  async pauseQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      await queue.pause();
      this.logger.log(`Queue ${queueName} paused`);
    } catch (error) {
      this.logger.error(`Failed to pause queue ${queueName}: ${error.message}`);
      throw error;
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      await queue.resume();
      this.logger.log(`Queue ${queueName} resumed`);
    } catch (error) {
      this.logger.error(
        `Failed to resume queue ${queueName}: ${error.message}`,
      );
      throw error;
    }
  }

  async isQueuePaused(queueName: string): Promise<boolean> {
    try {
      const queue = this.getQueueByName(queueName);
      return await queue.isPaused();
    } catch (error) {
      this.logger.error(
        `Failed to check if queue ${queueName} is paused: ${error.message}`,
      );
      throw error;
    }
  }

  // Statistics Methods
  async getQueueStats(queueName: string): Promise<QueueStats> {
    try {
      const queue = this.getQueueByName(queueName);
      const [waiting, active, completed, failed, delayed, paused] =
        await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed(),
          queue.isPaused(),
        ]);

      return {
        name: queueName,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get stats for queue ${queueName}: ${error.message}`,
      );
      throw error;
    }
  }

  async getAllQueueStats(): Promise<QueueStats[]> {
    try {
      const queueNames = ['message-queue', 'file-processing', 'notifications'];
      const stats = await Promise.all(
        queueNames.map((queueName) => this.getQueueStats(queueName)),
      );

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get all queue stats: ${error.message}`);
      throw error;
    }
  }

  // Cleanup Methods
  async cleanQueue(queueName: string, grace: number = 0): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      await queue.clean(grace, 100, 'completed');
      await queue.clean(grace, 100, 'failed');
      this.logger.log(`Queue ${queueName} cleaned`);
    } catch (error) {
      this.logger.error(`Failed to clean queue ${queueName}: ${error.message}`);
      throw error;
    }
  }

  async cleanAllQueues(grace: number = 0): Promise<void> {
    try {
      const queueNames = ['message-queue', 'file-processing', 'notifications'];
      await Promise.all(
        queueNames.map((queueName) => this.cleanQueue(queueName, grace)),
      );
      this.logger.log('All queues cleaned');
    } catch (error) {
      this.logger.error(`Failed to clean all queues: ${error.message}`);
      throw error;
    }
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; queues: QueueStats[] }> {
    try {
      const queues = await this.getAllQueueStats();
      const totalJobs = queues.reduce(
        (sum, queue) => sum + queue.waiting + queue.active + queue.failed,
        0,
      );

      const status = totalJobs > 1000 ? 'warning' : 'healthy';

      return { status, queues };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return { status: 'error', queues: [] };
    }
  }

  private getQueueByName(queueName: string): Queue {
    switch (queueName) {
      case 'message-queue':
        return this.messageQueue;
      case 'file-processing':
        return this.fileProcessingQueue;
      case 'notifications':
        return this.notificationQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }
}
