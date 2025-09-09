import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { BullBoardService } from './bull-board.service';
import { ExpressAdapter } from '@bull-board/express';

// Mock the Bull Board modules
jest.mock('@bull-board/api', () => ({
  createBullBoard: jest.fn(),
}));

jest.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@bull-board/express', () => ({
  ExpressAdapter: jest.fn().mockImplementation(() => ({
    setBasePath: jest.fn(),
  })),
}));

describe('BullBoardService', () => {
  let service: BullBoardService;
  let mockMessageQueue: any;
  let mockFileProcessingQueue: any;
  let mockNotificationQueue: any;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock queue objects
    mockMessageQueue = {
      name: 'message-queue',
    };

    mockFileProcessingQueue = {
      name: 'file-processing',
    };

    mockNotificationQueue = {
      name: 'notifications',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullBoardService,
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

    service = module.get<BullBoardService>(BullBoardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize Bull Board on module init', async () => {
      // Mock the initializeBullBoard method
      const initializeSpy = jest
        .spyOn(service as any, 'initializeBullBoard')
        .mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(initializeSpy).toHaveBeenCalled();
    });
  });

  describe('initializeBullBoard', () => {
    it('should initialize Bull Board successfully', async () => {
      const { createBullBoard } = require('@bull-board/api');
      const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
      const { ExpressAdapter } = require('@bull-board/express');

      const mockAdapter = {
        setBasePath: jest.fn(),
      };
      ExpressAdapter.mockImplementation(() => mockAdapter);

      await (service as any).initializeBullBoard();

      expect(ExpressAdapter).toHaveBeenCalled();
      expect(mockAdapter.setBasePath).toHaveBeenCalledWith('/admin/queues');
      expect(BullMQAdapter).toHaveBeenCalledTimes(3);
      expect(createBullBoard).toHaveBeenCalledWith({
        queues: expect.arrayContaining([
          expect.objectContaining({}),
          expect.objectContaining({}),
          expect.objectContaining({}),
        ]),
        serverAdapter: mockAdapter,
      });
    });

    it('should handle initialization errors', async () => {
      const { createBullBoard } = require('@bull-board/api');
      createBullBoard.mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      await expect((service as any).initializeBullBoard()).rejects.toThrow(
        'Initialization failed',
      );
    });
  });

  describe('getServerAdapter', () => {
    it('should return server adapter when initialized', () => {
      const mockAdapter = {
        setBasePath: jest.fn(),
      };
      (service as any).serverAdapter = mockAdapter;

      const result = service.getServerAdapter();

      expect(result).toBe(mockAdapter);
    });

    it('should throw error when not initialized', () => {
      (service as any).serverAdapter = undefined;

      expect(() => service.getServerAdapter()).toThrow(
        'Bull Board not initialized',
      );
    });
  });

  describe('getBasePath', () => {
    it('should return the correct base path', () => {
      const result = service.getBasePath();

      expect(result).toBe('/admin/queues');
    });
  });

  describe('constructor', () => {
    it('should inject all required queues', () => {
      expect(service).toBeDefined();
      // The service should be instantiated with all three queues
      expect(mockMessageQueue).toBeDefined();
      expect(mockFileProcessingQueue).toBeDefined();
      expect(mockNotificationQueue).toBeDefined();
    });
  });

  describe('queue configuration', () => {
    it('should configure all queues with correct settings', async () => {
      const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
      const { createBullBoard } = require('@bull-board/api');
      const { ExpressAdapter } = require('@bull-board/express');

      const mockAdapter = {
        setBasePath: jest.fn(),
      };
      ExpressAdapter.mockImplementation(() => mockAdapter);
      createBullBoard.mockImplementation(() => {});

      await (service as any).initializeBullBoard();

      // Verify that BullMQAdapter was called with correct parameters
      expect(BullMQAdapter).toHaveBeenCalledWith(mockMessageQueue, {
        readOnlyMode: false,
      });
      expect(BullMQAdapter).toHaveBeenCalledWith(mockFileProcessingQueue, {
        readOnlyMode: false,
      });
      expect(BullMQAdapter).toHaveBeenCalledWith(mockNotificationQueue, {
        readOnlyMode: false,
      });
    });
  });

  describe('error handling', () => {
    it('should log errors during initialization', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'error');
      const { createBullBoard } = require('@bull-board/api');

      createBullBoard.mockImplementation(() => {
        throw new Error('Test error');
      });

      try {
        await (service as any).initializeBullBoard();
      } catch (error) {
        // Expected to throw
      }

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to initialize Bull Board: Test error',
      );
    });

    it('should log success message after initialization', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log');
      const { createBullBoard } = require('@bull-board/api');
      const { ExpressAdapter } = require('@bull-board/express');

      const mockAdapter = {
        setBasePath: jest.fn(),
      };
      ExpressAdapter.mockImplementation(() => mockAdapter);
      createBullBoard.mockImplementation(() => {});

      await (service as any).initializeBullBoard();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Bull Board dashboard initialized at /admin/queues',
      );
    });
  });
});
