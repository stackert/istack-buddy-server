import { Test, TestingModule } from '@nestjs/testing';
import { NotificationProcessor } from './notification.processor';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationProcessor],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleNotification', () => {
    it('should process notification intent successfully', async () => {
      const mockJob = {
        data: {
          userId: 'user-456',
          intent: 'user.alert',
          data: { message: 'Test message', priority: 'high' },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleNotification(mockJob as any),
      ).resolves.not.toThrow();
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should process different intent types', async () => {
      const mockJob = {
        data: {
          userId: 'user-789',
          intent: 'system.status',
          data: { status: 'healthy', timestamp: Date.now() },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleNotification(mockJob as any),
      ).resolves.not.toThrow();
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should throw error for invalid userId', async () => {
      const mockJob = {
        data: {
          userId: null,
          intent: 'user.alert',
          data: { message: 'Test message' },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleNotification(mockJob as any),
      ).rejects.toThrow('Invalid userId');
    });

    it('should throw error for invalid intent', async () => {
      const mockJob = {
        data: {
          userId: 'user-456',
          intent: null,
          data: { message: 'Test message' },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleNotification(mockJob as any),
      ).rejects.toThrow('Invalid intent');
    });

    it('should throw error for invalid data', async () => {
      const mockJob = {
        data: {
          userId: 'user-456',
          intent: 'user.alert',
          data: null,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleNotification(mockJob as any),
      ).rejects.toThrow('Invalid data - must be an object');
    });
  });
});
