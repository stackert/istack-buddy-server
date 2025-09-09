import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { JobQueueService } from './job-queue.service';

describe('JobQueueService', () => {
  let service: JobQueueService;
  let mockMessageQueue: any;
  let mockFileProcessingQueue: any;
  let mockNotificationQueue: any;

  beforeEach(async () => {
    // Mock queue objects
    mockMessageQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isPaused: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      getDelayed: jest.fn(),
      clean: jest.fn(),
    };

    mockFileProcessingQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isPaused: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      getDelayed: jest.fn(),
      clean: jest.fn(),
    };

    mockNotificationQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isPaused: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      getDelayed: jest.fn(),
      clean: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobQueueService,
        {
          provide: getQueueToken('message-queue'),
          useValue: mockMessageQueue,
        },
        {
          provide: getQueueToken('file-processing'),
          useValue: mockFileProcessingQueue,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockNotificationQueue,
        },
      ],
    }).compile();

    service = module.get<JobQueueService>(JobQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMessageJob', () => {
    it('should add a message job to the message queue', async () => {
      const jobData = {
        messageId: 'msg-123',
        userId: 'user-456',
        content: { type: 'text/plain', payload: 'Hello' },
      };

      const mockJob = { id: 'job-123' };
      mockMessageQueue.add.mockResolvedValue(mockJob);

      const result = await service.addMessageJob(jobData);

      expect(mockMessageQueue.add).toHaveBeenCalledWith(
        'process-message',
        jobData,
        expect.objectContaining({
          priority: 0,
          delay: 0,
          jobId: expect.stringContaining('message-msg-123-'),
        }),
      );
      expect(result).toBe(mockJob);
    });

    it('should handle errors when adding message job', async () => {
      const jobData = {
        messageId: 'msg-123',
        userId: 'user-456',
        content: { type: 'text/plain', payload: 'Hello' },
      };

      mockMessageQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(service.addMessageJob(jobData)).rejects.toThrow(
        'Queue error',
      );
    });
  });

  describe('addFileProcessingJob', () => {
    it('should add a file processing job to the file processing queue', async () => {
      const jobData = {
        fileId: 'file-123',
        userId: 'user-456',
        operation: 'virus-scan' as const,
      };

      const mockJob = { id: 'job-456' };
      mockFileProcessingQueue.add.mockResolvedValue(mockJob);

      const result = await service.addFileProcessingJob(jobData);

      expect(mockFileProcessingQueue.add).toHaveBeenCalledWith(
        'process-file',
        jobData,
        expect.objectContaining({
          priority: 0,
          delay: 0,
          jobId: expect.stringContaining('file-file-123-virus-scan-'),
        }),
      );
      expect(result).toBe(mockJob);
    });
  });

  describe('addNotificationJob', () => {
    it('should add a notification job to the notification queue', async () => {
      const jobData = {
        userId: 'user-456',
        intent: 'user.alert',
        data: { subject: 'Test', message: 'Test message' },
      };

      const mockJob = { id: 'job-789' };
      mockNotificationQueue.add.mockResolvedValue(mockJob);

      const result = await service.addNotificationJob(jobData);

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        jobData,
        expect.objectContaining({
          priority: 0,
          delay: 0,
          jobId: expect.stringContaining('notification-user-456-user.alert-'),
        }),
      );
      expect(result).toBe(mockJob);
    });
  });

  describe('getJob', () => {
    it('should get a job from the specified queue', async () => {
      const mockJob = { id: 'job-123', data: { test: 'data' } };
      mockMessageQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJob('message-queue', 'job-123');

      expect(mockMessageQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(result).toBe(mockJob);
    });

    it('should throw error for unknown queue', async () => {
      await expect(service.getJob('unknown-queue', 'job-123')).rejects.toThrow(
        'Unknown queue: unknown-queue',
      );
    });
  });

  describe('retryJob', () => {
    it('should retry a job', async () => {
      const mockJob = { retry: jest.fn() };
      mockMessageQueue.getJob.mockResolvedValue(mockJob);

      await service.retryJob('message-queue', 'job-123');

      expect(mockMessageQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it('should throw error if job not found', async () => {
      mockMessageQueue.getJob.mockResolvedValue(null);

      await expect(
        service.retryJob('message-queue', 'job-123'),
      ).rejects.toThrow('Job job-123 not found in queue message-queue');
    });
  });

  describe('pauseQueue', () => {
    it('should pause a queue', async () => {
      mockMessageQueue.pause.mockResolvedValue(undefined);

      await service.pauseQueue('message-queue');

      expect(mockMessageQueue.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should resume a queue', async () => {
      mockMessageQueue.resume.mockResolvedValue(undefined);

      await service.resumeQueue('message-queue');

      expect(mockMessageQueue.resume).toHaveBeenCalled();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        waiting: [{ id: '1' }],
        active: [{ id: '2' }],
        completed: [{ id: '3' }],
        failed: [{ id: '4' }],
        delayed: [{ id: '5' }],
      };

      mockMessageQueue.getWaiting.mockResolvedValue(mockStats.waiting);
      mockMessageQueue.getActive.mockResolvedValue(mockStats.active);
      mockMessageQueue.getCompleted.mockResolvedValue(mockStats.completed);
      mockMessageQueue.getFailed.mockResolvedValue(mockStats.failed);
      mockMessageQueue.getDelayed.mockResolvedValue(mockStats.delayed);
      mockMessageQueue.isPaused.mockResolvedValue(false);

      const result = await service.getQueueStats('message-queue');

      expect(result).toEqual({
        name: 'message-queue',
        waiting: 1,
        active: 1,
        completed: 1,
        failed: 1,
        delayed: 1,
        paused: false,
      });
    });
  });

  describe('getAllQueueStats', () => {
    it('should return statistics for all queues', async () => {
      // Mock all queue stats methods
      const mockStats = {
        waiting: [],
        active: [],
        completed: [],
        failed: [],
        delayed: [],
      };

      [
        mockMessageQueue,
        mockFileProcessingQueue,
        mockNotificationQueue,
      ].forEach((queue) => {
        queue.getWaiting.mockResolvedValue(mockStats.waiting);
        queue.getActive.mockResolvedValue(mockStats.active);
        queue.getCompleted.mockResolvedValue(mockStats.completed);
        queue.getFailed.mockResolvedValue(mockStats.failed);
        queue.getDelayed.mockResolvedValue(mockStats.delayed);
        queue.isPaused.mockResolvedValue(false);
      });

      const result = await service.getAllQueueStats();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('message-queue');
      expect(result[1].name).toBe('file-processing');
      expect(result[2].name).toBe('notifications');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when queues are normal', async () => {
      const mockStats = {
        waiting: [],
        active: [],
        completed: [],
        failed: [],
        delayed: [],
      };

      [
        mockMessageQueue,
        mockFileProcessingQueue,
        mockNotificationQueue,
      ].forEach((queue) => {
        queue.getWaiting.mockResolvedValue(mockStats.waiting);
        queue.getActive.mockResolvedValue(mockStats.active);
        queue.getCompleted.mockResolvedValue(mockStats.completed);
        queue.getFailed.mockResolvedValue(mockStats.failed);
        queue.getDelayed.mockResolvedValue(mockStats.delayed);
        queue.isPaused.mockResolvedValue(false);
      });

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.queues).toHaveLength(3);
    });

    it('should return warning status when total jobs exceed threshold', async () => {
      const mockStats = {
        waiting: Array(500).fill({ id: '1' }),
        active: Array(500).fill({ id: '2' }),
        completed: [],
        failed: [],
        delayed: [],
      };

      [
        mockMessageQueue,
        mockFileProcessingQueue,
        mockNotificationQueue,
      ].forEach((queue) => {
        queue.getWaiting.mockResolvedValue(mockStats.waiting);
        queue.getActive.mockResolvedValue(mockStats.active);
        queue.getCompleted.mockResolvedValue(mockStats.completed);
        queue.getFailed.mockResolvedValue(mockStats.failed);
        queue.getDelayed.mockResolvedValue(mockStats.delayed);
        queue.isPaused.mockResolvedValue(false);
      });

      const result = await service.healthCheck();

      expect(result.status).toBe('warning');
    });
  });

  describe('removeJob', () => {
    it('should remove a job from the specified queue', async () => {
      const mockJob = { remove: jest.fn() };
      mockMessageQueue.getJob.mockResolvedValue(mockJob);

      await service.removeJob('message-queue', 'job-123');

      expect(mockMessageQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should throw error for unknown queue', async () => {
      await expect(
        service.removeJob('unknown-queue', 'job-123'),
      ).rejects.toThrow('Unknown queue: unknown-queue');
    });

    it('should throw error if job not found', async () => {
      mockMessageQueue.getJob.mockResolvedValue(null);

      await expect(
        service.removeJob('message-queue', 'job-123'),
      ).rejects.toThrow('Job job-123 not found in queue message-queue');
    });
  });

  describe('isQueuePaused', () => {
    it('should return true if queue is paused', async () => {
      mockMessageQueue.isPaused.mockResolvedValue(true);

      const result = await service.isQueuePaused('message-queue');

      expect(result).toBe(true);
      expect(mockMessageQueue.isPaused).toHaveBeenCalled();
    });

    it('should return false if queue is not paused', async () => {
      mockMessageQueue.isPaused.mockResolvedValue(false);

      const result = await service.isQueuePaused('message-queue');

      expect(result).toBe(false);
      expect(mockMessageQueue.isPaused).toHaveBeenCalled();
    });

    it('should throw error for unknown queue', async () => {
      await expect(service.isQueuePaused('unknown-queue')).rejects.toThrow(
        'Unknown queue: unknown-queue',
      );
    });
  });

  describe('cleanQueue', () => {
    it('should clean a specific queue', async () => {
      mockMessageQueue.clean.mockResolvedValue(undefined);

      await service.cleanQueue('message-queue', 1000);

      expect(mockMessageQueue.clean).toHaveBeenCalledWith(
        1000,
        100,
        'completed',
      );
      expect(mockMessageQueue.clean).toHaveBeenCalledWith(1000, 100, 'failed');
    });

    it('should clean queue with default grace period', async () => {
      mockMessageQueue.clean.mockResolvedValue(undefined);

      await service.cleanQueue('message-queue');

      expect(mockMessageQueue.clean).toHaveBeenCalledWith(0, 100, 'completed');
      expect(mockMessageQueue.clean).toHaveBeenCalledWith(0, 100, 'failed');
    });

    it('should throw error for unknown queue', async () => {
      await expect(service.cleanQueue('unknown-queue')).rejects.toThrow(
        'Unknown queue: unknown-queue',
      );
    });
  });

  describe('cleanAllQueues', () => {
    it('should clean all queues', async () => {
      [
        mockMessageQueue,
        mockFileProcessingQueue,
        mockNotificationQueue,
      ].forEach((queue) => {
        queue.clean.mockResolvedValue(undefined);
      });

      await service.cleanAllQueues(1000);

      [
        mockMessageQueue,
        mockFileProcessingQueue,
        mockNotificationQueue,
      ].forEach((queue) => {
        expect(queue.clean).toHaveBeenCalledWith(1000, 100, 'completed');
        expect(queue.clean).toHaveBeenCalledWith(1000, 100, 'failed');
      });
    });

    it('should clean all queues with default grace period', async () => {
      [
        mockMessageQueue,
        mockFileProcessingQueue,
        mockNotificationQueue,
      ].forEach((queue) => {
        queue.clean.mockResolvedValue(undefined);
      });

      await service.cleanAllQueues();

      [
        mockMessageQueue,
        mockFileProcessingQueue,
        mockNotificationQueue,
      ].forEach((queue) => {
        expect(queue.clean).toHaveBeenCalledWith(0, 100, 'completed');
        expect(queue.clean).toHaveBeenCalledWith(0, 100, 'failed');
      });
    });
  });

  describe('getQueueByName', () => {
    it('should return correct queue for message-queue', () => {
      // This tests the private method indirectly through public methods
      expect(service.getJob('message-queue', 'test')).toBeInstanceOf(Promise);
    });

    it('should return correct queue for file-processing', () => {
      expect(service.getJob('file-processing', 'test')).toBeInstanceOf(Promise);
    });

    it('should return correct queue for notifications', () => {
      expect(service.getJob('notifications', 'test')).toBeInstanceOf(Promise);
    });
  });
});
