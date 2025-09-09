import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bull';

@Injectable()
export class BullBoardService implements OnModuleInit {
  private readonly logger = new Logger(BullBoardService.name);
  private serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue('message-queue') private readonly messageQueue: Queue,
    @InjectQueue('file-processing') private readonly fileProcessingQueue: Queue,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.initializeBullBoard();
  }

  private async initializeBullBoard(): Promise<void> {
    try {
      // Create Express adapter for Bull Board
      this.serverAdapter = new ExpressAdapter();
      this.serverAdapter.setBasePath('/admin/queues');

      // Create Bull Board with all queues
      createBullBoard({
        queues: [
          new BullAdapter(this.messageQueue, { readOnlyMode: false }),
          new BullAdapter(this.fileProcessingQueue, { readOnlyMode: false }),
          new BullAdapter(this.notificationQueue, { readOnlyMode: false }),
        ],
        serverAdapter: this.serverAdapter,
      });

      this.logger.log('Bull Board dashboard initialized at /admin/queues');
    } catch (error) {
      this.logger.error(`Failed to initialize Bull Board: ${error.message}`);
      throw error;
    }
  }

  getServerAdapter(): ExpressAdapter {
    if (!this.serverAdapter) {
      throw new Error('Bull Board not initialized');
    }
    return this.serverAdapter;
  }

  getBasePath(): string {
    return '/admin/queues';
  }
}
