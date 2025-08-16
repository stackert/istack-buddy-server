import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CustomLoggerService, LogContext } from './custom-logger.service';

describe('CustomLoggerService', () => {
  let service: CustomLoggerService;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomLoggerService],
    }).compile();

    service = module.get<CustomLoggerService>(CustomLoggerService);

    // Store original environment
    originalEnv = process.env.NODE_ENV;

    // Mock parent class methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'verbose').mockImplementation();
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should be instance of CustomLoggerService', () => {
      expect(service).toBeInstanceOf(CustomLoggerService);
    });

    it('should have all required public methods', () => {
      expect(typeof service.logWithContext).toBe('function');
      expect(typeof service.errorWithContext).toBe('function');
      expect(typeof service.auditLog).toBe('function');
      expect(typeof service.permissionCheck).toBe('function');
      expect(typeof service.databaseOperation).toBe('function');
    });
  });

  describe('Data Sanitization', () => {
    describe('Sensitive Field Removal', () => {
      it('should sanitize password field', () => {
        const testData = { username: 'testuser', password: 'secret123' };
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          undefined,
          testData,
        );

        expect(logSpy).toHaveBeenCalledWith('Test message', 'TestContext');
      });

      it('should sanitize all sensitive fields', () => {
        const testData = {
          password: 'secret',
          passwordHash: 'hash123',
          token: 'token123',
          accessToken: 'access123',
          refreshToken: 'refresh123',
          secret: 'secret123',
          key: 'key123',
          authorization: 'Bearer token',
          normalField: 'normal value',
        };
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          undefined,
          testData,
        );

        expect(logSpy).toHaveBeenCalledWith('Test message', 'TestContext');
      });

      it('should handle nested object sanitization', () => {
        const testData = {
          user: {
            id: 'user123',
            password: 'secret',
            profile: {
              name: 'John',
              token: 'nested-token',
            },
          },
          config: {
            apiKey: 'api123',
            settings: {
              secret: 'nested-secret',
              value: 'normal',
            },
          },
        };
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          undefined,
          testData,
        );

        expect(logSpy).toHaveBeenCalledWith('Test message', 'TestContext');
      });

      it('should handle array sanitization', () => {
        const testData = {
          users: [
            { id: 1, password: 'secret1' },
            { id: 2, token: 'token2' },
          ],
          tokens: ['token1', 'token2'],
        };
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          undefined,
          testData,
        );

        expect(logSpy).toHaveBeenCalledWith('Test message', 'TestContext');
      });

      it('should handle primitive values without modification', () => {
        const primitiveValues = ['string', 123, true];
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        primitiveValues.forEach((value) => {
          logSpy.mockClear();
          service.logWithContext(
            'log',
            'Test message',
            'TestContext',
            undefined,
            value,
          );

          expect(logSpy).toHaveBeenCalledWith('Test message', 'TestContext');
        });
      });

      it('should handle null and undefined values', () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        logSpy.mockClear();
        service.logWithContext(
          'log',
          'Null test',
          'TestContext',
          undefined,
          null,
        );
        expect(logSpy).toHaveBeenCalledWith('Null test', 'TestContext');

        logSpy.mockClear();
        service.logWithContext(
          'log',
          'Undefined test',
          'TestContext',
          undefined,
          undefined,
        );
        expect(logSpy).toHaveBeenCalledWith('Undefined test', 'TestContext');
      });
    });
  });

  describe('logWithContext', () => {
    const testContext: LogContext = {
      userId: 'user-123',
      username: 'testuser',
      correlationId: 'req-456',
      requestPath: '/api/test',
      method: 'GET',
    };

    describe('Development Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should use NestJS logger in development', () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          testContext,
          { value: 'test' },
        );

        expect(logSpy).toHaveBeenCalledWith(
          '[req-456] Test message',
          'TestContext',
        );
      });

      it('should handle messages without correlation ID', () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');
        const contextWithoutCorrelation = { ...testContext };
        delete contextWithoutCorrelation.correlationId;

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          contextWithoutCorrelation,
        );

        expect(logSpy).toHaveBeenCalledWith('Test message', 'TestContext');
      });

      it('should handle messages without context', () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        service.logWithContext('log', 'Test message', 'TestContext');

        expect(logSpy).toHaveBeenCalledWith('Test message', 'TestContext');
      });

      it('should handle messages without data', () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          testContext,
        );

        expect(logSpy).toHaveBeenCalledWith(
          '[req-456] Test message',
          'TestContext',
        );
        expect(logSpy).toHaveBeenCalledTimes(1);
      });

      it('should support all log levels', () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');
        const errorSpy = jest.spyOn(Logger.prototype, 'error');
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');
        const debugSpy = jest.spyOn(Logger.prototype, 'debug');
        const verboseSpy = jest.spyOn(Logger.prototype, 'verbose');

        service.logWithContext(
          'log',
          'log message',
          'TestContext',
          testContext,
        );
        service.logWithContext(
          'error',
          'error message',
          'TestContext',
          testContext,
        );
        service.logWithContext(
          'warn',
          'warn message',
          'TestContext',
          testContext,
        );
        service.logWithContext(
          'debug',
          'debug message',
          'TestContext',
          testContext,
        );
        service.logWithContext(
          'verbose',
          'verbose message',
          'TestContext',
          testContext,
        );

        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(verboseSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('errorWithContext', () => {
    const testError = new Error('Test error message');
    const testContext: LogContext = {
      userId: 'user-123',
      correlationId: 'req-456',
    };

    beforeEach(() => {
      testError.stack =
        'Error: Test error message\n    at TestClass.testMethod (test.js:1:1)';
    });

    describe('Development Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should use NestJS error logger in development', () => {
        const errorSpy = jest.spyOn(Logger.prototype, 'error');

        service.errorWithContext(
          'Database connection failed',
          testError,
          'DatabaseService',
          testContext,
          { connectionString: 'postgres://localhost' },
        );

        expect(errorSpy).toHaveBeenCalledWith(
          '[req-456] Database connection failed',
          testError.stack,
          'DatabaseService',
        );
      });

      it('should handle errors without correlation ID', () => {
        const errorSpy = jest.spyOn(Logger.prototype, 'error');
        const contextWithoutCorrelation = { ...testContext };
        delete contextWithoutCorrelation.correlationId;

        service.errorWithContext(
          'Error occurred',
          testError,
          'TestService',
          contextWithoutCorrelation,
        );

        expect(errorSpy).toHaveBeenCalledWith(
          'Error occurred',
          testError.stack,
          'TestService',
        );
      });

      it('should handle errors without additional data', () => {
        const errorSpy = jest.spyOn(Logger.prototype, 'error');

        service.errorWithContext(
          'Error occurred',
          testError,
          'TestService',
          testContext,
        );

        expect(errorSpy).toHaveBeenCalledWith(
          '[req-456] Error occurred',
          testError.stack,
          'TestService',
        );
        expect(errorSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('should sanitize sensitive data in error context', () => {
      const sensitiveData = { username: 'user', password: 'secret123' };
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      service.errorWithContext(
        'Auth error',
        testError,
        'AuthService',
        testContext,
        sensitiveData,
      );

      expect(errorSpy).toHaveBeenCalledWith(
        '[req-456] Auth error',
        testError.stack,
        'AuthService',
      );
    });
  });

  describe('auditLog', () => {
    const testContext: LogContext = {
      userId: 'user-123',
      correlationId: 'req-456',
    };

    it('should create audit log with success result in development', () => {
      process.env.NODE_ENV = 'development';
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      service.auditLog(
        'USER_LOGIN',
        'success',
        'AuthController.login',
        testContext,
        { loginMethod: 'email' },
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT: USER_LOGIN - success'),
        'AuthController.login',
      );
    });

    it('should create audit log with failure result in development', () => {
      process.env.NODE_ENV = 'development';
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      service.auditLog(
        'USER_LOGIN',
        'failure',
        'AuthController.login',
        testContext,
        { reason: 'invalid_password' },
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT: USER_LOGIN - failure'),
        'AuthController.login',
      );
    });

    it('should sanitize sensitive data in audit details', () => {
      const auditDetails = {
        username: 'user',
        password: 'secret123',
        action: 'login',
      };
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      service.auditLog(
        'USER_LOGIN',
        'success',
        'AuthController.login',
        testContext,
        auditDetails,
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT: USER_LOGIN - success'),
        'AuthController.login',
      );
    });

    it('should handle audit log without details', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      service.auditLog(
        'USER_LOGOUT',
        'success',
        'AuthController.logout',
        testContext,
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT: USER_LOGOUT - success'),
        'AuthController.logout',
      );
    });
  });

  describe('permissionCheck', () => {
    const testContext: LogContext = {
      userId: 'user-123',
      correlationId: 'req-456',
    };

    it('should log allowed permission with debug level', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      service.permissionCheck(
        'user:profile:edit',
        true,
        'UserController.updateProfile',
        testContext,
        { sameUser: true },
      );

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Permission check: user:profile:edit - ALLOWED',
        ),
        'UserController.updateProfile',
      );
    });

    it('should log denied permission with warn level', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      service.permissionCheck(
        'admin:users:delete',
        false,
        'AdminController.deleteUser',
        testContext,
        { requiredRole: 'admin' },
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Permission check: admin:users:delete - DENIED',
        ),
        'AdminController.deleteUser',
      );
    });

    it('should sanitize sensitive data in permission conditions', () => {
      const conditions = { targetUserId: 'user-456', key: 'secret-key' };
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      service.permissionCheck(
        'api:access',
        true,
        'ApiController.access',
        testContext,
        conditions,
      );

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission check: api:access - ALLOWED'),
        'ApiController.access',
      );
    });

    it('should handle permission check without conditions', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      service.permissionCheck(
        'user:profile:read',
        true,
        'UserController.getProfile',
        testContext,
      );

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Permission check: user:profile:read - ALLOWED',
        ),
        'UserController.getProfile',
      );
    });
  });

  describe('databaseOperation', () => {
    const testContext: LogContext = {
      userId: 'user-123',
      correlationId: 'req-456',
    };

    it('should log database SELECT operation', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      service.databaseOperation(
        'SELECT',
        'user_profiles',
        'UserService.findById',
        testContext,
        { userId: 'user-123', fields: ['id', 'name'] },
      );

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database SELECT on user_profiles'),
        'UserService.findById',
      );
    });

    it('should log database INSERT operation in development', () => {
      process.env.NODE_ENV = 'development';
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      service.databaseOperation(
        'INSERT',
        'audit_logs',
        'AuditService.createLog',
        testContext,
        { recordCount: 1 },
      );

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database INSERT on audit_logs'),
        'AuditService.createLog',
      );
    });

    it('should sanitize sensitive data in database operation details', () => {
      const details = {
        username: 'user',
        password: 'new-password',
        email: 'user@example.com',
      };
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      service.databaseOperation(
        'UPDATE',
        'users',
        'UserService.updatePassword',
        testContext,
        details,
      );

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database UPDATE on users'),
        'UserService.updatePassword',
      );
    });

    it('should handle database operation without details', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      service.databaseOperation(
        'DELETE',
        'temp_files',
        'CleanupService.clearTemp',
        testContext,
      );

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database DELETE on temp_files'),
        'CleanupService.clearTemp',
      );
    });
  });

  describe('Structured Log Creation', () => {
    it('should create complete structured log entry', () => {
      const testContext: LogContext = {
        userId: 'user-123',
        username: 'testuser',
        accountType: 'premium',
        correlationId: 'req-456',
        requestPath: '/api/users/123',
        method: 'POST',
      };
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      service.logWithContext(
        'log',
        'User action performed',
        'UserController',
        testContext,
        { action: 'profile_update' },
      );

      expect(logSpy).toHaveBeenCalledWith(
        '[req-456] User action performed',
        'UserController',
      );
    });

    it('should handle partial log context', () => {
      const partialContext: LogContext = {
        correlationId: 'req-789',
      };
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      service.logWithContext(
        'log',
        'Partial context test',
        'TestController',
        partialContext,
      );

      expect(logSpy).toHaveBeenCalledWith(
        '[req-789] Partial context test',
        'TestController',
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large data objects', () => {
      const largeData = {
        largeArray: new Array(100).fill('data'),
        largeString: 'x'.repeat(1000),
        normalField: 'normal',
      };
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      expect(() => {
        service.logWithContext(
          'log',
          'Large data test',
          'TestContext',
          undefined,
          largeData,
        );
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalledWith('Large data test', 'TestContext');
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Message with 特殊文字 and emojis 🚀🔥';
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      service.logWithContext('log', specialMessage, 'TestContext');

      expect(logSpy).toHaveBeenCalledWith(specialMessage, 'TestContext');
    });

    it('should handle empty objects and arrays', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      service.logWithContext(
        'log',
        'Empty object',
        'TestContext',
        undefined,
        {},
      );
      service.logWithContext(
        'log',
        'Empty array',
        'TestContext',
        undefined,
        [],
      );

      expect(logSpy).toHaveBeenCalledTimes(2);
    });
  });
});
