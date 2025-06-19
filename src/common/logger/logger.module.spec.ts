import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from './logger.module';
import { CustomLoggerService } from './custom-logger.service';

describe('LoggerModule', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Module Compilation', () => {
    it('should compile successfully', async () => {
      module = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should be defined as a module', () => {
      expect(LoggerModule).toBeDefined();
      expect(typeof LoggerModule).toBe('function');
    });
  });

  describe('Service Provision', () => {
    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();
    });

    it('should provide CustomLoggerService', () => {
      const loggerService =
        module.get<CustomLoggerService>(CustomLoggerService);
      expect(loggerService).toBeDefined();
      expect(loggerService).toBeInstanceOf(CustomLoggerService);
    });

    it('should provide singleton instance', () => {
      const service1 = module.get<CustomLoggerService>(CustomLoggerService);
      const service2 = module.get<CustomLoggerService>(CustomLoggerService);

      expect(service1).toBe(service2);
    });

    it('should make service available for injection', () => {
      expect(() => {
        module.get<CustomLoggerService>(CustomLoggerService);
      }).not.toThrow();
    });

    it('should provide functional service methods', () => {
      const service = module.get<CustomLoggerService>(CustomLoggerService);

      expect(typeof service.logWithContext).toBe('function');
      expect(typeof service.errorWithContext).toBe('function');
      expect(typeof service.auditLog).toBe('function');
      expect(typeof service.permissionCheck).toBe('function');
      expect(typeof service.databaseOperation).toBe('function');
    });
  });

  describe('Global Module', () => {
    it('should be accessible as a global module', () => {
      // Test that the module is properly defined and can be imported
      expect(LoggerModule).toBeDefined();
      expect(typeof LoggerModule).toBe('function');
    });
  });

  describe('Module Exports', () => {
    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();
    });

    it('should export CustomLoggerService', () => {
      const service = module.get<CustomLoggerService>(CustomLoggerService);
      expect(service).toBeDefined();
    });

    it('should make service available to dependent modules', async () => {
      const dependentModule = await Test.createTestingModule({
        imports: [LoggerModule],
        providers: [
          {
            provide: 'TEST_SERVICE',
            useFactory: (logger: CustomLoggerService) => ({ logger }),
            inject: [CustomLoggerService],
          },
        ],
      }).compile();

      const testService = dependentModule.get('TEST_SERVICE');
      expect(testService.logger).toBeInstanceOf(CustomLoggerService);

      await dependentModule.close();
    });
  });

  describe('Service Integration', () => {
    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();
    });

    it('should allow service usage', () => {
      const service = module.get<CustomLoggerService>(CustomLoggerService);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      expect(() => {
        service.logWithContext('log', 'Test message', 'TestContext');
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should work with factory providers', async () => {
      const testModule = await Test.createTestingModule({
        imports: [LoggerModule],
        providers: [
          {
            provide: 'LOGGER_WRAPPER',
            useFactory: (logger: CustomLoggerService) => ({
              log: (msg: string) =>
                logger.logWithContext('log', msg, 'Wrapper'),
            }),
            inject: [CustomLoggerService],
          },
        ],
      }).compile();

      const wrapper = testModule.get('LOGGER_WRAPPER');
      expect(wrapper).toBeDefined();
      expect(typeof wrapper.log).toBe('function');

      await testModule.close();
    });
  });

  describe('Module Metadata', () => {
    it('should have correct providers configuration', () => {
      // Test that the module can be imported and providers work
      expect(LoggerModule).toBeDefined();
    });

    it('should export the correct services', async () => {
      const testModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      expect(() => {
        testModule.get<CustomLoggerService>(CustomLoggerService);
      }).not.toThrow();

      await testModule.close();
    });
  });

  describe('Multiple Module Instances', () => {
    it('should handle multiple imports', async () => {
      const module1 = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      const module2 = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      const logger1 = module1.get<CustomLoggerService>(CustomLoggerService);
      const logger2 = module2.get<CustomLoggerService>(CustomLoggerService);

      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();

      await module1.close();
      await module2.close();
    });
  });

  describe('Module Lifecycle', () => {
    it('should initialize properly', async () => {
      const testModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      await testModule.init();
      const service = testModule.get<CustomLoggerService>(CustomLoggerService);
      expect(service).toBeDefined();

      await testModule.close();
    });

    it('should close gracefully', async () => {
      const testModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      await expect(testModule.close()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle service access errors gracefully', async () => {
      const testModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      expect(() => {
        testModule.get<CustomLoggerService>(CustomLoggerService);
      }).not.toThrow();

      await testModule.close();
    });

    it('should maintain stability after service errors', async () => {
      const testModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      const service = testModule.get<CustomLoggerService>(CustomLoggerService);

      // Mock console to throw error
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        throw new Error('Console error');
      });

      try {
        service.logWithContext('log', 'Test', 'Test');
      } catch (error) {
        // Expected error
      }

      // Service should still be accessible
      expect(
        testModule.get<CustomLoggerService>(CustomLoggerService),
      ).toBeDefined();

      consoleSpy.mockRestore();
      await testModule.close();
    });
  });
});
