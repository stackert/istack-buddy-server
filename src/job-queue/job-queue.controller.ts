import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JobQueueService } from './job-queue.service';
import { QueueStats } from './types';

@ApiTags('Job Queue Management')
@Controller('admin/bullmq/job-queue')
export class JobQueueController {
  constructor(private readonly jobQueueService: JobQueueService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get statistics for all queues' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStats(): Promise<QueueStats[]> {
    try {
      return await this.jobQueueService.getAllQueueStats();
    } catch (error) {
      throw new HttpException(
        `Failed to get queue statistics: ${error.message}`,
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
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueueStatsByName(
    @Param('queueName') queueName: string,
  ): Promise<QueueStats> {
    try {
      return await this.jobQueueService.getQueueStats(queueName);
    } catch (error) {
      if (error.message.includes('Unknown queue')) {
        throw new HttpException(
          `Queue '${queueName}' not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to get queue statistics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('job/:queueName/:jobId')
  @ApiOperation({ summary: 'Get details for a specific job' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiParam({ name: 'jobId', description: 'ID of the job' })
  @ApiResponse({
    status: 200,
    description: 'Job details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ): Promise<any> {
    try {
      const job = await this.jobQueueService.getJob(queueName, jobId);

      if (!job) {
        throw new HttpException(
          `Job '${jobId}' not found in queue '${queueName}'`,
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        opts: job.opts,
        state: await job.getState(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get job details: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('job/:queueName/:jobId/retry')
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiParam({ name: 'jobId', description: 'ID of the job to retry' })
  @ApiResponse({ status: 200, description: 'Job retried successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ): Promise<{ message: string }> {
    try {
      await this.jobQueueService.retryJob(queueName, jobId);
      return {
        message: `Job ${jobId} retried successfully in queue ${queueName}`,
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException(
          `Job '${jobId}' not found in queue '${queueName}'`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to retry job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('job/:queueName/:jobId/remove')
  @ApiOperation({ summary: 'Remove a job from the queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiParam({ name: 'jobId', description: 'ID of the job to remove' })
  @ApiResponse({ status: 200, description: 'Job removed successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async removeJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ): Promise<{ message: string }> {
    try {
      await this.jobQueueService.removeJob(queueName, jobId);
      return {
        message: `Job ${jobId} removed successfully from queue ${queueName}`,
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException(
          `Job '${jobId}' not found in queue '${queueName}'`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to remove job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('queue/:queueName/pause')
  @ApiOperation({ summary: 'Pause a queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to pause' })
  @ApiResponse({ status: 200, description: 'Queue paused successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async pauseQueue(
    @Param('queueName') queueName: string,
  ): Promise<{ message: string }> {
    try {
      await this.jobQueueService.pauseQueue(queueName);
      return { message: `Queue ${queueName} paused successfully` };
    } catch (error) {
      if (error.message.includes('Unknown queue')) {
        throw new HttpException(
          `Queue '${queueName}' not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to pause queue: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('queue/:queueName/resume')
  @ApiOperation({ summary: 'Resume a paused queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to resume' })
  @ApiResponse({ status: 200, description: 'Queue resumed successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async resumeQueue(
    @Param('queueName') queueName: string,
  ): Promise<{ message: string }> {
    try {
      await this.jobQueueService.resumeQueue(queueName);
      return { message: `Queue ${queueName} resumed successfully` };
    } catch (error) {
      if (error.message.includes('Unknown queue')) {
        throw new HttpException(
          `Queue '${queueName}' not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to resume queue: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('queue/:queueName/status')
  @ApiOperation({ summary: 'Get queue status (paused/resumed)' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiResponse({
    status: 200,
    description: 'Queue status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueueStatus(
    @Param('queueName') queueName: string,
  ): Promise<{ paused: boolean }> {
    try {
      const paused = await this.jobQueueService.isQueuePaused(queueName);
      return { paused };
    } catch (error) {
      if (error.message.includes('Unknown queue')) {
        throw new HttpException(
          `Queue '${queueName}' not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to get queue status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup')
  @ApiOperation({
    summary: 'Clean up completed and failed jobs from all queues',
  })
  @ApiResponse({ status: 200, description: 'All queues cleaned successfully' })
  async cleanupAllQueues(): Promise<{ message: string }> {
    try {
      await this.jobQueueService.cleanAllQueues();
      return { message: 'All queues cleaned successfully' };
    } catch (error) {
      throw new HttpException(
        `Failed to clean queues: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup/:queueName')
  @ApiOperation({
    summary: 'Clean up completed and failed jobs from a specific queue',
  })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to clean' })
  @ApiResponse({ status: 200, description: 'Queue cleaned successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async cleanupQueue(
    @Param('queueName') queueName: string,
  ): Promise<{ message: string }> {
    try {
      await this.jobQueueService.cleanQueue(queueName);
      return { message: `Queue ${queueName} cleaned successfully` };
    } catch (error) {
      if (error.message.includes('Unknown queue')) {
        throw new HttpException(
          `Queue '${queueName}' not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to clean queue: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Get job queue system health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
  })
  async getHealthStatus(): Promise<{ status: string; queues: QueueStats[] }> {
    try {
      return await this.jobQueueService.healthCheck();
    } catch (error) {
      throw new HttpException(
        `Health check failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
