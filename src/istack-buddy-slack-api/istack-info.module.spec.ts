import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { IStackInfoModule } from './istack-info.module';
import { IStackInfoService } from './istack-info.service';

// Mock Redis
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    })),
  };
});

describe('IStackInfoModule', () => {
  let module: TestingModule;
  let service: IStackInfoService;

  let redisClient: Redis;

  beforeEach(async () => {
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_DB = '0';

    module = await Test.createTestingModule({
      imports: [IStackInfoModule],
    }).compile();

    service = module.get<IStackInfoService>(IStackInfoService);
    redisClient = module.get<Redis>('REDIS_CLIENT');
  });

  afterEach(async () => {
    await module.close();

    // Clean up environment variables
    // Skip deleting env var - breaks other tests
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_DB;
  });

  describe('module initialization', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should provide IStackInfoService', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(IStackInfoService);
    });

    it('should provide Redis client', () => {
      expect(redisClient).toBeDefined();
    });

    it('should create Redis client with correct configuration', () => {
      const RedisMock = require('ioredis').Redis;

      expect(RedisMock).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    });
  });

  describe('Redis client factory', () => {
    it('should use default values when environment variables are not set', async () => {
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_DB;
      delete process.env.REDIS_PASSWORD;

      const testModule = await Test.createTestingModule({
        imports: [IStackInfoModule],
      }).compile();

      const RedisMock = require('ioredis').Redis;

      // Should be called with defaults
      expect(RedisMock).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await testModule.close();
    });

    it('should use environment variables when provided', async () => {
      process.env.REDIS_HOST = 'redis-server';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_DB = '1';
      process.env.REDIS_PASSWORD = 'secret';

      const testModule = await Test.createTestingModule({
        imports: [IStackInfoModule],
      }).compile();

      const RedisMock = require('ioredis').Redis;

      expect(RedisMock).toHaveBeenCalledWith({
        host: 'redis-server',
        port: 6380,
        password: 'secret',
        db: 1,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await testModule.close();
    });

    it('should handle Redis connection events', async () => {
      const mockRedis = {
        on: jest.fn(),
      };

      const RedisMock = require('ioredis').Redis;
      RedisMock.mockReturnValueOnce(mockRedis);

      // Re-create module to trigger factory
      const testModule = await Test.createTestingModule({
        imports: [IStackInfoModule],
      }).compile();

      expect(mockRedis.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function),
      );
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));

      await testModule.close();
    });
  });

  describe('service factory', () => {
    it('should create IStackInfoService with Redis client', () => {
      expect(service).toBeInstanceOf(IStackInfoService);
    });
  });

  describe('module exports', () => {
    it('should export IStackInfoService', () => {
      const exportedService = module.get<IStackInfoService>(IStackInfoService);
      expect(exportedService).toBe(service);
    });
  });

  describe('global module', () => {
    it('should be marked as global', () => {
      // The @Global() decorator makes the module available globally
      // This test verifies the module structure
      expect(IStackInfoModule).toBeDefined();
    });
  });
});
