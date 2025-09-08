import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Delete,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JobQueueService } from './job-queue.service';
import { BullBoardService } from './bull-board.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';

@ApiTags('Job Queue')
@Controller('job-queue')
export class JobQueueController {
  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly bullBoardService: BullBoardService,
    @InjectQueue('message-queue') private readonly messageQueue: Queue,
    @InjectQueue('file-processing') private readonly fileProcessingQueue: Queue,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStats() {
    try {
      const stats = await this.jobQueueService.getAllQueueStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve queue statistics',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats/:queueName')
  @ApiOperation({ summary: 'Get statistics for a specific queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStatsByName(@Param('queueName') queueName: string) {
    try {
      const stats = await this.jobQueueService.getQueueStats(queueName);
      return {
        success: true,
        data: {
          queueName,
          ...stats,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to retrieve statistics for queue: ${queueName}`,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('job/:queueName/:jobId')
  @ApiOperation({ summary: 'Get job details' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiParam({ name: 'jobId', description: 'ID of the job' })
  @ApiResponse({
    status: 200,
    description: 'Job details retrieved successfully',
  })
  async getJobDetails(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    try {
      const queue = this.getQueueByName(queueName);
      const jobDetails = await this.bullBoardService.getJobDetails(
        queue,
        jobId,
      );

      if (!jobDetails) {
        throw new HttpException(
          {
            success: false,
            message: `Job ${jobId} not found in queue ${queueName}`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: jobDetails,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: `Failed to retrieve job details`,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('job/:queueName/:jobId/retry')
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiParam({ name: 'jobId', description: 'ID of the job to retry' })
  @ApiResponse({ status: 200, description: 'Job retried successfully' })
  async retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    try {
      const queue = this.getQueueByName(queueName);
      await this.bullBoardService.retryJob(queue, jobId);

      return {
        success: true,
        message: `Job ${jobId} retried successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to retry job ${jobId}`,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('job/:queueName/:jobId')
  @ApiOperation({ summary: 'Remove a job from the queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiParam({ name: 'jobId', description: 'ID of the job to remove' })
  @ApiResponse({ status: 200, description: 'Job removed successfully' })
  async removeJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    try {
      const queue = this.getQueueByName(queueName);
      await this.bullBoardService.removeJob(queue, jobId);

      return {
        success: true,
        message: `Job ${jobId} removed successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to remove job ${jobId}`,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('queue/:queueName/pause')
  @ApiOperation({ summary: 'Pause a queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to pause' })
  @ApiResponse({ status: 200, description: 'Queue paused successfully' })
  async pauseQueue(@Param('queueName') queueName: string) {
    try {
      const queue = this.getQueueByName(queueName);
      await this.bullBoardService.pauseQueue(queue);

      return {
        success: true,
        message: `Queue ${queueName} paused successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to pause queue ${queueName}`,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('queue/:queueName/resume')
  @ApiOperation({ summary: 'Resume a queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to resume' })
  @ApiResponse({ status: 200, description: 'Queue resumed successfully' })
  async resumeQueue(@Param('queueName') queueName: string) {
    try {
      const queue = this.getQueueByName(queueName);
      await this.bullBoardService.resumeQueue(queue);

      return {
        success: true,
        message: `Queue ${queueName} resumed successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to resume queue ${queueName}`,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('cleanup/completed')
  @ApiOperation({ summary: 'Clean completed jobs from all queues' })
  @ApiResponse({
    status: 200,
    description: 'Completed jobs cleaned successfully',
  })
  async cleanCompletedJobs(@Body() body: { grace?: number }) {
    try {
      const grace = body.grace || 24 * 60 * 60 * 1000; // 24 hours default
      await this.jobQueueService.cleanCompletedJobs(grace);

      return {
        success: true,
        message: `Completed jobs older than ${grace}ms cleaned successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to clean completed jobs',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup/failed')
  @ApiOperation({ summary: 'Clean failed jobs from all queues' })
  @ApiResponse({ status: 200, description: 'Failed jobs cleaned successfully' })
  async cleanFailedJobs(@Body() body: { grace?: number }) {
    try {
      const grace = body.grace || 7 * 24 * 60 * 60 * 1000; // 7 days default
      await this.jobQueueService.cleanFailedJobs(grace);

      return {
        success: true,
        message: `Failed jobs older than ${grace}ms cleaned successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to clean failed jobs',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get queue instance by name
   */
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
