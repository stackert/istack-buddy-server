import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bullmq';

export interface MessageQueueJobData {
  userId: string;
  messageId: string;
  timestamp: Date;
  retryCount?: number;
}

export interface FileProcessingJobData {
  fileId: string;
  uploaderId: string;
  roomId: string;
  storageClass: string;
  requiresVirusScanning: boolean;
  generateThumbnails: boolean;
  priority: 'high' | 'normal' | 'low';
}

export interface NotificationJobData {
  userId: string;
  type: 'message' | 'file_ready' | 'system' | 'error';
  title: string;
  content: string;
  metadata?: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
}

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @InjectQueue('message-queue')
    private readonly messageQueue: Queue<MessageQueueJobData>,
    @InjectQueue('file-processing')
    private readonly fileProcessingQueue: Queue<FileProcessingJobData>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue<NotificationJobData>,
  ) {}

  /**
   * Add a message delivery job to the queue
   */
  async queueMessageDelivery(
    userId: string,
    messageId: string,
    options?: {
      delay?: number;
      priority?: number;
      attempts?: number;
    },
  ): Promise<Job<MessageQueueJobData>> {
    const jobData: MessageQueueJobData = {
      userId,
      messageId,
      timestamp: new Date(),
    };

    const job = await this.messageQueue.add(
      'deliver-offline-message',
      jobData,
      {
        delay: options?.delay || 0,
        priority: options?.priority || 0,
        attempts: options?.attempts || 3,
        jobId: `message-${messageId}-${userId}`,
      },
    );

    this.logger.log(`Queued message delivery job: ${job.id}`, {
      userId,
      messageId,
      jobId: job.id,
    });

    return job;
  }

  /**
   * Add a file processing job to the queue
   */
  async queueFileProcessing(
    fileId: string,
    uploaderId: string,
    roomId: string,
    storageClass: string,
    options?: {
      requiresVirusScanning?: boolean;
      generateThumbnails?: boolean;
      priority?: 'high' | 'normal' | 'low';
      delay?: number;
    },
  ): Promise<Job<FileProcessingJobData>> {
    const jobData: FileProcessingJobData = {
      fileId,
      uploaderId,
      roomId,
      storageClass,
      requiresVirusScanning: options?.requiresVirusScanning || false,
      generateThumbnails: options?.generateThumbnails || false,
      priority: options?.priority || 'normal',
    };

    const priorityMap = { high: 10, normal: 5, low: 1 };
    const jobPriority = priorityMap[jobData.priority];

    const job = await this.fileProcessingQueue.add('process-upload', jobData, {
      delay: options?.delay || 0,
      priority: jobPriority,
      jobId: `file-${fileId}`,
    });

    this.logger.log(`Queued file processing job: ${job.id}`, {
      fileId,
      uploaderId,
      roomId,
      jobId: job.id,
    });

    return job;
  }

  /**
   * Add a notification job to the queue
   */
  async queueNotification(
    userId: string,
    type: 'message' | 'file_ready' | 'system' | 'error',
    title: string,
    content: string,
    options?: {
      metadata?: Record<string, any>;
      priority?: 'high' | 'normal' | 'low';
      delay?: number;
    },
  ): Promise<Job<NotificationJobData>> {
    const jobData: NotificationJobData = {
      userId,
      type,
      title,
      content,
      metadata: options?.metadata || {},
      priority: options?.priority || 'normal',
    };

    const priorityMap = { high: 10, normal: 5, low: 1 };
    const jobPriority = priorityMap[jobData.priority];

    const job = await this.notificationQueue.add('send-notification', jobData, {
      delay: options?.delay || 0,
      priority: jobPriority,
      jobId: `notification-${userId}-${Date.now()}`,
    });

    this.logger.log(`Queued notification job: ${job.id}`, {
      userId,
      type,
      jobId: job.id,
    });

    return job;
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(queueName: string, jobId: string): Promise<Job | null> {
    let queue: Queue;
    switch (queueName) {
      case 'message-queue':
        queue = this.messageQueue;
        break;
      case 'file-processing':
        queue = this.fileProcessingQueue;
        break;
      case 'notifications':
        queue = this.notificationQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    return job || null;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string) {
    let queue: Queue;
    switch (queueName) {
      case 'message-queue':
        queue = this.messageQueue;
        break;
      case 'file-processing':
        queue = this.fileProcessingQueue;
        break;
      case 'notifications':
        queue = this.notificationQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats() {
    const [messageStats, fileStats, notificationStats] = await Promise.all([
      this.getQueueStats('message-queue'),
      this.getQueueStats('file-processing'),
      this.getQueueStats('notifications'),
    ]);

    return {
      'message-queue': messageStats,
      'file-processing': fileStats,
      notifications: notificationStats,
    };
  }

  /**
   * Clean completed jobs from all queues
   */
  async cleanCompletedJobs(grace: number = 24 * 60 * 60 * 1000) {
    await Promise.all([
      this.messageQueue.clean(grace, 100, 'completed'),
      this.fileProcessingQueue.clean(grace, 100, 'completed'),
      this.notificationQueue.clean(grace, 100, 'completed'),
    ]);

    this.logger.log(`Cleaned completed jobs older than ${grace}ms`);
  }

  /**
   * Clean failed jobs from all queues
   */
  async cleanFailedJobs(grace: number = 7 * 24 * 60 * 60 * 1000) {
    await Promise.all([
      this.messageQueue.clean(grace, 50, 'failed'),
      this.fileProcessingQueue.clean(grace, 50, 'failed'),
      this.notificationQueue.clean(grace, 50, 'failed'),
    ]);

    this.logger.log(`Cleaned failed jobs older than ${grace}ms`);
  }
}
