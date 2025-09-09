import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { JobQueueController } from './job-queue.controller';
import { JobQueueService } from './job-queue.service';

describe('JobQueueController', () => {
  let controller: JobQueueController;
  let service: JobQueueService;

  beforeEach(async () => {
    const mockJobQueueService = {
      getAllQueueStats: jest.fn(),
      getQueueStats: jest.fn(),
      getJob: jest.fn(),
      retryJob: jest.fn(),
      removeJob: jest.fn(),
      pauseQueue: jest.fn(),
      resumeQueue: jest.fn(),
      isQueuePaused: jest.fn(),
      cleanAllQueues: jest.fn(),
      cleanQueue: jest.fn(),
      healthCheck: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobQueueController],
      providers: [
        {
          provide: JobQueueService,
          useValue: mockJobQueueService,
        },
      ],
    }).compile();

    controller = module.get<JobQueueController>(JobQueueController);
    service = module.get<JobQueueService>(JobQueueService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getQueueStats', () => {
    it('should return all queue statistics', async () => {
      const mockStats = [
        {
          name: 'message-queue',
          waiting: 5,
          active: 2,
          completed: 100,
          failed: 1,
          delayed: 0,
          paused: false,
        },
        {
          name: 'file-processing',
          waiting: 3,
          active: 1,
          completed: 50,
          failed: 0,
          delayed: 0,
          paused: false,
        },
      ];

      jest.spyOn(service, 'getAllQueueStats').mockResolvedValue(mockStats);

      const result = await controller.getQueueStats();

      expect(service.getAllQueueStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting queue statistics', async () => {
      jest
        .spyOn(service, 'getAllQueueStats')
        .mockRejectedValue(new Error('Service error'));

      await expect(controller.getQueueStats()).rejects.toThrow(HttpException);
      await expect(controller.getQueueStats()).rejects.toThrow(
        'Failed to get queue statistics: Service error',
      );
    });
  });

  describe('getQueueStatsByName', () => {
    it('should return statistics for specific queue', async () => {
      const mockStats = {
        name: 'message-queue',
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
        paused: false,
      };

      jest.spyOn(service, 'getQueueStats').mockResolvedValue(mockStats);

      const result = await controller.getQueueStatsByName('message-queue');

      expect(service.getQueueStats).toHaveBeenCalledWith('message-queue');
      expect(result).toEqual(mockStats);
    });

    it('should return 404 for unknown queue', async () => {
      jest
        .spyOn(service, 'getQueueStats')
        .mockRejectedValue(new Error('Unknown queue: unknown-queue'));

      await expect(
        controller.getQueueStatsByName('unknown-queue'),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.getQueueStatsByName('unknown-queue'),
      ).rejects.toThrow("Queue 'unknown-queue' not found");
    });
  });

  describe('getJob', () => {
    it('should return job details', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'process-message',
        data: { messageId: 'msg-123' },
        progress: 50,
        returnvalue: null,
        failedReason: null,
        processedOn: Date.now(),
        finishedOn: null,
        timestamp: Date.now(),
        attemptsMade: 1,
        opts: {},
        getState: jest.fn().mockResolvedValue('active'),
      };

      jest.spyOn(service, 'getJob').mockResolvedValue(mockJob);

      const result = await controller.getJob('message-queue', 'job-123');

      expect(service.getJob).toHaveBeenCalledWith('message-queue', 'job-123');
      expect(result).toEqual({
        id: 'job-123',
        name: 'process-message',
        data: { messageId: 'msg-123' },
        progress: 50,
        returnvalue: null,
        failedReason: null,
        processedOn: expect.any(Number),
        finishedOn: null,
        timestamp: expect.any(Number),
        attemptsMade: 1,
        opts: {},
        state: 'active',
      });
    });

    it('should return 404 for non-existent job', async () => {
      jest.spyOn(service, 'getJob').mockResolvedValue(null);

      await expect(
        controller.getJob('message-queue', 'non-existent'),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.getJob('message-queue', 'non-existent'),
      ).rejects.toThrow(
        "Job 'non-existent' not found in queue 'message-queue'",
      );
    });
  });

  describe('retryJob', () => {
    it('should retry a job successfully', async () => {
      jest.spyOn(service, 'retryJob').mockResolvedValue(undefined);

      const result = await controller.retryJob('message-queue', 'job-123');

      expect(service.retryJob).toHaveBeenCalledWith('message-queue', 'job-123');
      expect(result).toEqual({
        message: 'Job job-123 retried successfully in queue message-queue',
      });
    });

    it('should return 404 for non-existent job', async () => {
      jest
        .spyOn(service, 'retryJob')
        .mockRejectedValue(
          new Error('Job job-123 not found in queue message-queue'),
        );

      await expect(
        controller.retryJob('message-queue', 'job-123'),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.retryJob('message-queue', 'job-123'),
      ).rejects.toThrow("Job 'job-123' not found in queue 'message-queue'");
    });
  });

  describe('removeJob', () => {
    it('should remove a job successfully', async () => {
      jest.spyOn(service, 'removeJob').mockResolvedValue(undefined);

      const result = await controller.removeJob('message-queue', 'job-123');

      expect(service.removeJob).toHaveBeenCalledWith(
        'message-queue',
        'job-123',
      );
      expect(result).toEqual({
        message: 'Job job-123 removed successfully from queue message-queue',
      });
    });
  });

  describe('pauseQueue', () => {
    it('should pause a queue successfully', async () => {
      jest.spyOn(service, 'pauseQueue').mockResolvedValue(undefined);

      const result = await controller.pauseQueue('message-queue');

      expect(service.pauseQueue).toHaveBeenCalledWith('message-queue');
      expect(result).toEqual({
        message: 'Queue message-queue paused successfully',
      });
    });

    it('should return 404 for unknown queue', async () => {
      jest
        .spyOn(service, 'pauseQueue')
        .mockRejectedValue(new Error('Unknown queue: unknown-queue'));

      await expect(controller.pauseQueue('unknown-queue')).rejects.toThrow(
        HttpException,
      );
      await expect(controller.pauseQueue('unknown-queue')).rejects.toThrow(
        "Queue 'unknown-queue' not found",
      );
    });
  });

  describe('resumeQueue', () => {
    it('should resume a queue successfully', async () => {
      jest.spyOn(service, 'resumeQueue').mockResolvedValue(undefined);

      const result = await controller.resumeQueue('message-queue');

      expect(service.resumeQueue).toHaveBeenCalledWith('message-queue');
      expect(result).toEqual({
        message: 'Queue message-queue resumed successfully',
      });
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', async () => {
      jest.spyOn(service, 'isQueuePaused').mockResolvedValue(false);

      const result = await controller.getQueueStatus('message-queue');

      expect(service.isQueuePaused).toHaveBeenCalledWith('message-queue');
      expect(result).toEqual({ paused: false });
    });
  });

  describe('cleanupAllQueues', () => {
    it('should clean all queues successfully', async () => {
      jest.spyOn(service, 'cleanAllQueues').mockResolvedValue(undefined);

      const result = await controller.cleanupAllQueues();

      expect(service.cleanAllQueues).toHaveBeenCalled();
      expect(result).toEqual({ message: 'All queues cleaned successfully' });
    });
  });

  describe('cleanupQueue', () => {
    it('should clean specific queue successfully', async () => {
      jest.spyOn(service, 'cleanQueue').mockResolvedValue(undefined);

      const result = await controller.cleanupQueue('message-queue');

      expect(service.cleanQueue).toHaveBeenCalledWith('message-queue');
      expect(result).toEqual({
        message: 'Queue message-queue cleaned successfully',
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      const mockHealth = {
        status: 'healthy',
        queues: [
          {
            name: 'message-queue',
            waiting: 0,
            active: 0,
            completed: 100,
            failed: 0,
            delayed: 0,
            paused: false,
          },
        ],
      };

      jest.spyOn(service, 'healthCheck').mockResolvedValue(mockHealth);

      const result = await controller.getHealthStatus();

      expect(service.healthCheck).toHaveBeenCalled();
      expect(result).toEqual(mockHealth);
    });

    it('should handle errors when getting health status', async () => {
      jest
        .spyOn(service, 'healthCheck')
        .mockRejectedValue(new Error('Health check failed'));

      await expect(controller.getHealthStatus()).rejects.toThrow(HttpException);
    });
  });

  describe('error handling', () => {
    it('should handle service errors in getQueueStats', async () => {
      jest
        .spyOn(service, 'getAllQueueStats')
        .mockRejectedValue(new Error('Service error'));

      await expect(controller.getQueueStats()).rejects.toThrow(HttpException);
    });

    it('should handle service errors in getQueueStatsByName', async () => {
      jest
        .spyOn(service, 'getQueueStats')
        .mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getQueueStatsByName('message-queue'),
      ).rejects.toThrow(HttpException);
    });

    it('should handle service errors in getJob', async () => {
      jest
        .spyOn(service, 'getJob')
        .mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getJob('message-queue', 'job-123'),
      ).rejects.toThrow(HttpException);
    });

    it('should handle service errors in retryJob', async () => {
      jest
        .spyOn(service, 'retryJob')
        .mockRejectedValue(new Error('Service error'));

      await expect(
        controller.retryJob('message-queue', 'job-123'),
      ).rejects.toThrow(HttpException);
    });

    it('should handle service errors in removeJob', async () => {
      jest
        .spyOn(service, 'removeJob')
        .mockRejectedValue(new Error('Service error'));

      await expect(
        controller.removeJob('message-queue', 'job-123'),
      ).rejects.toThrow(HttpException);
    });

    it('should handle service errors in pauseQueue', async () => {
      jest
        .spyOn(service, 'pauseQueue')
        .mockRejectedValue(new Error('Service error'));

      await expect(controller.pauseQueue('message-queue')).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle service errors in resumeQueue', async () => {
      jest
        .spyOn(service, 'resumeQueue')
        .mockRejectedValue(new Error('Service error'));

      await expect(controller.resumeQueue('message-queue')).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle service errors in getQueueStatus', async () => {
      jest
        .spyOn(service, 'isQueuePaused')
        .mockRejectedValue(new Error('Service error'));

      await expect(controller.getQueueStatus('message-queue')).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle service errors in cleanupAllQueues', async () => {
      jest
        .spyOn(service, 'cleanAllQueues')
        .mockRejectedValue(new Error('Service error'));

      await expect(controller.cleanupAllQueues()).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle service errors in cleanupQueue', async () => {
      jest
        .spyOn(service, 'cleanQueue')
        .mockRejectedValue(new Error('Service error'));

      await expect(controller.cleanupQueue('message-queue')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
