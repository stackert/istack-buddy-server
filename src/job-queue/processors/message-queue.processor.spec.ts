import { Test, TestingModule } from '@nestjs/testing';
import { MessageQueueProcessor } from './message-queue.processor';

describe('MessageQueueProcessor', () => {
  let processor: MessageQueueProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessageQueueProcessor],
    }).compile();

    processor = module.get<MessageQueueProcessor>(MessageQueueProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleMessageProcessing', () => {
    it('should process message successfully', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'text/plain',
            payload: 'Hello, World!',
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).resolves.not.toThrow();
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should handle JSON content', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'application/json',
            payload: { test: 'data' },
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).resolves.not.toThrow();
    });

    it('should handle Information Services content', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'context/dynamic-form',
            payload: {
              formRecord: { id: 'form-123' },
              submitActionIds: ['action-1', 'action-2'],
            },
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).resolves.not.toThrow();
    });

    it('should handle Sumo search report content', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'sumo-search/report',
            payload: {
              recordCount: 10,
              firstRecord: { id: 'record-1' },
              originalQuery: 'test query',
            },
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).resolves.not.toThrow();
    });

    it('should throw error for invalid content', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: null,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).rejects.toThrow();
    });

    it('should throw error for empty text content', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'text/plain',
            payload: '',
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).rejects.toThrow();
    });

    it('should throw error for invalid JSON content', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'application/json',
            payload: 'invalid json',
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).rejects.toThrow();
    });

    it('should throw error for missing formRecord', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'context/dynamic-form',
            payload: {},
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).rejects.toThrow();
    });

    it('should throw error for missing accountRecord', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'context/dynamic-account',
            payload: {},
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).rejects.toThrow();
    });

    it('should throw error for invalid Sumo report', async () => {
      const mockJob = {
        data: {
          messageId: 'msg-123',
          userId: 'user-456',
          content: {
            type: 'sumo-search/report',
            payload: {
              recordCount: 'invalid',
            },
          },
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        processor.handleMessageProcessing(mockJob as any),
      ).rejects.toThrow('Invalid recordCount in Sumo search report');
    });
  });
});
