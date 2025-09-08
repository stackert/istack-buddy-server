import { Injectable, Logger } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

@Injectable()
export class BullBoardService {
  private readonly logger = new Logger(BullBoardService.name);
  private serverAdapter: ExpressAdapter;
  private bullBoard: any;

  constructor() {
    this.initializeBullBoard();
  }

  private initializeBullBoard() {
    // Create Express adapter for Bull Board
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    // Initialize Bull Board
    this.bullBoard = createBullBoard({
      queues: [], // Will be populated when queues are registered
      serverAdapter: this.serverAdapter,
    });

    this.logger.log('Bull Board initialized');
  }

  /**
   * Register queues with Bull Board for monitoring
   */
  registerQueues(queues: Queue[]) {
    const adapters = queues.map((queue) => new BullMQAdapter(queue));

    // Update Bull Board with new queue adapters
    this.bullBoard = createBullBoard({
      queues: adapters,
      serverAdapter: this.serverAdapter,
    });

    this.logger.log(`Registered ${queues.length} queues with Bull Board`, {
      queueNames: queues.map((q) => q.name),
    });
  }

  /**
   * Get the Express adapter for mounting in the main app
   */
  getServerAdapter(): ExpressAdapter {
    return this.serverAdapter;
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStatistics(queues: Queue[]) {
    const stats = await Promise.all(
      queues.map(async (queue) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all(
          [
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed(),
          ],
        );

        return {
          name: queue.name,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          total:
            waiting.length +
            active.length +
            completed.length +
            failed.length +
            delayed.length,
        };
      }),
    );

    return stats;
  }

  /**
   * Get detailed job information
   */
  async getJobDetails(queue: Queue, jobId: string) {
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
      attemptsLimit: job.opts.attempts,
      delay: job.opts.delay,
      priority: job.opts.priority,
      state: await job.getState(),
    };
  }

  /**
   * Retry a failed job
   */
  async retryJob(queue: Queue, jobId: string) {
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    this.logger.log(`Retried job ${jobId} in queue ${queue.name}`);
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(queue: Queue, jobId: string) {
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    this.logger.log(`Removed job ${jobId} from queue ${queue.name}`);
  }

  /**
   * Clean completed jobs from a queue
   */
  async cleanCompletedJobs(queue: Queue, grace: number = 24 * 60 * 60 * 1000) {
    const cleaned = await queue.clean(grace, 100, 'completed');
    this.logger.log(
      `Cleaned ${cleaned.length} completed jobs from queue ${queue.name}`,
    );
    return cleaned.length;
  }

  /**
   * Clean failed jobs from a queue
   */
  async cleanFailedJobs(queue: Queue, grace: number = 7 * 24 * 60 * 60 * 1000) {
    const cleaned = await queue.clean(grace, 50, 'failed');
    this.logger.log(
      `Cleaned ${cleaned.length} failed jobs from queue ${queue.name}`,
    );
    return cleaned.length;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queue: Queue) {
    await queue.pause();
    this.logger.log(`Paused queue ${queue.name}`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queue: Queue) {
    await queue.resume();
    this.logger.log(`Resumed queue ${queue.name}`);
  }
}
