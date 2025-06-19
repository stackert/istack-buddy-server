import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  CustomLoggerService,
  LogContext,
  StructuredLogEntry,
} from './custom-logger.service';

describe('CustomLoggerService', () => {
  let service: CustomLoggerService;
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomLoggerService],
    }).compile();

    service = module.get<CustomLoggerService>(CustomLoggerService);

    // Store original environment
    originalEnv = process.env.NODE_ENV;

    // Spy on console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

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

    it('should extend Logger class', () => {
      expect(service).toBeInstanceOf(CustomLoggerService);
      expect(service).toBeInstanceOf(Logger);
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
        process.env.NODE_ENV = 'production';
        const testData = { username: 'testuser', password: 'secret123' };

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          undefined,
          testData,
        );

        const lastCall =
          consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
        const logEntry = JSON.parse(lastCall[0]);
        expect(logEntry.data.password).toBe('[REDACTED]');
        expect(logEntry.data.username).toBe('testuser');
      });

      it('should sanitize all sensitive fields', () => {
        process.env.NODE_ENV = 'production';
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

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          undefined,
          testData,
        );

        const lastCall =
          consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
        const logEntry = JSON.parse(lastCall[0]);

        expect(logEntry.data.password).toBe('[REDACTED]');
        expect(logEntry.data.passwordHash).toBe('[REDACTED]');
        expect(logEntry.data.token).toBe('[REDACTED]');
        expect(logEntry.data.accessToken).toBe('[REDACTED]');
        expect(logEntry.data.refreshToken).toBe('[REDACTED]');
        expect(logEntry.data.secret).toBe('[REDACTED]');
        expect(logEntry.data.key).toBe('[REDACTED]');
        expect(logEntry.data.authorization).toBe('[REDACTED]');
        expect(logEntry.data.normalField).toBe('normal value');
      });

      it('should handle nested object sanitization', () => {
        process.env.NODE_ENV = 'production';
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

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          undefined,
          testData,
        );

        const lastCall =
          consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
        const logEntry = JSON.parse(lastCall[0]);

        expect(logEntry.data.user.password).toBe('[REDACTED]');
        expect(logEntry.data.user.profile.token).toBe('[REDACTED]');
        expect(logEntry.data.config.settings.secret).toBe('[REDACTED]');
        expect(logEntry.data.user.id).toBe('user123');
        expect(logEntry.data.user.profile.name).toBe('John');
        expect(logEntry.data.config.settings.value).toBe('normal');
      });

      it('should handle array sanitization', () => {
        process.env.NODE_ENV = 'production';
        const testData = {
          users: [
            { id: 1, password: 'secret1' },
            { id: 2, token: 'token2' },
          ],
          tokens: ['token1', 'token2'],
        };

        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          undefined,
          testData,
        );

        const lastCall =
          consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
        const logEntry = JSON.parse(lastCall[0]);

        expect(logEntry.data.users[0].password).toBe('[REDACTED]');
        expect(logEntry.data.users[1].token).toBe('[REDACTED]');
        expect(logEntry.data.users[0].id).toBe(1);
        expect(logEntry.data.tokens).toEqual(['token1', 'token2']);
      });

      it('should handle primitive values without modification', () => {
        process.env.NODE_ENV = 'production';
        const primitiveValues = ['string', 123, true];

        primitiveValues.forEach((value) => {
          consoleSpy.mockClear();
          service.logWithContext(
            'log',
            'Test message',
            'TestContext',
            undefined,
            value,
          );

          const lastCall = consoleSpy.mock.calls[0];
          const logEntry = JSON.parse(lastCall[0]);
          expect(logEntry.data).toBe(value);
        });
      });

      it('should handle null and undefined values', () => {
        process.env.NODE_ENV = 'production';

        consoleSpy.mockClear();
        service.logWithContext(
          'log',
          'Null test',
          'TestContext',
          undefined,
          null,
        );
        let logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
        // The service treats null data as undefined in structured logs
        expect(logEntry.data).toBeUndefined();

        consoleSpy.mockClear();
        service.logWithContext(
          'log',
          'Undefined test',
          'TestContext',
          undefined,
          undefined,
        );
        logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(logEntry.data).toBeUndefined();
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

    describe('Production Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should output structured JSON logs in production', () => {
        service.logWithContext(
          'log',
          'Test message',
          'TestContext',
          testContext,
          { value: 'test' },
        );

        expect(consoleSpy).toHaveBeenCalledTimes(1);

        const logOutput = consoleSpy.mock.calls[0][0];
        const logEntry = JSON.parse(logOutput);

        expect(logEntry).toMatchObject({
          level: 'log',
          context: 'TestContext',
          message: 'Test message',
          correlationId: 'req-456',
          userId: 'user-123',
          requestPath: '/api/test',
          data: { value: 'test' },
        });
        expect(logEntry.timestamp).toBeDefined();
      });
    });

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

        expect(consoleSpy).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
          '[req-456] Test message',
          'TestContext',
        );
        expect(logSpy).toHaveBeenCalledWith(
          'Data: {\n  "value": "test"\n}',
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

    describe('Production Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should output structured JSON error logs in production', () => {
        service.errorWithContext(
          'Database connection failed',
          testError,
          'DatabaseService',
          testContext,
          { connectionString: 'postgres://localhost' },
        );

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

        const errorOutput = consoleErrorSpy.mock.calls[0][0];
        const errorEntry = JSON.parse(errorOutput);

        expect(errorEntry).toMatchObject({
          level: 'error',
          context: 'DatabaseService',
          message: 'Database connection failed',
          correlationId: 'req-456',
          userId: 'user-123',
          data: { connectionString: 'postgres://localhost' },
          error: {
            name: 'Error',
            message: 'Test error message',
            stack: testError.stack,
          },
        });
      });
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

        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
          '[req-456] Database connection failed',
          testError.stack,
          'DatabaseService',
        );
        expect(errorSpy).toHaveBeenCalledWith(
          'Data: {\n  "connectionString": "postgres://localhost"\n}',
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
      process.env.NODE_ENV = 'production';
      const sensitiveData = { username: 'user', password: 'secret123' };

      service.errorWithContext(
        'Auth error',
        testError,
        'AuthService',
        testContext,
        sensitiveData,
      );

      const errorOutput = consoleErrorSpy.mock.calls[0][0];
      const errorEntry = JSON.parse(errorOutput);

      expect(errorEntry.data.password).toBe('[REDACTED]');
      expect(errorEntry.data.username).toBe('user');
    });
  });

  describe('auditLog', () => {
    const testContext: LogContext = {
      userId: 'user-123',
      correlationId: 'req-456',
    };

    it('should create audit log with success result in production', () => {
      process.env.NODE_ENV = 'production';
      service.auditLog(
        'USER_LOGIN',
        'success',
        'AuthController.login',
        testContext,
        { loginMethod: 'email' },
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.message).toBe('AUDIT: USER_LOGIN - success');
      expect(logEntry.data).toMatchObject({
        auditEvent: 'USER_LOGIN',
        result: 'success',
        details: { loginMethod: 'email' },
      });
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
      process.env.NODE_ENV = 'production';
      const auditDetails = {
        username: 'user',
        password: 'secret123',
        action: 'login',
      };

      service.auditLog(
        'USER_LOGIN',
        'success',
        'AuthController.login',
        testContext,
        auditDetails,
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.data.details.password).toBe('[REDACTED]');
      expect(logEntry.data.details.username).toBe('user');
      expect(logEntry.data.details.action).toBe('login');
    });

    it('should handle audit log without details', () => {
      process.env.NODE_ENV = 'production';
      service.auditLog(
        'USER_LOGOUT',
        'success',
        'AuthController.logout',
        testContext,
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.message).toBe('AUDIT: USER_LOGOUT - success');
      expect(logEntry.data.details).toBeUndefined();
    });
  });

  describe('permissionCheck', () => {
    const testContext: LogContext = {
      userId: 'user-123',
      correlationId: 'req-456',
    };

    it('should log allowed permission with debug level', () => {
      process.env.NODE_ENV = 'production';
      service.permissionCheck(
        'user:profile:edit',
        true,
        'UserController.updateProfile',
        testContext,
        { sameUser: true },
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.level).toBe('debug');
      expect(logEntry.message).toBe(
        'Permission check: user:profile:edit - ALLOWED',
      );
      expect(logEntry.data).toMatchObject({
        permission: 'user:profile:edit',
        allowed: true,
        conditions: { sameUser: true },
      });
    });

    it('should log denied permission with warn level', () => {
      process.env.NODE_ENV = 'production';
      service.permissionCheck(
        'admin:users:delete',
        false,
        'AdminController.deleteUser',
        testContext,
        { requiredRole: 'admin' },
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.level).toBe('warn');
      expect(logEntry.message).toBe(
        'Permission check: admin:users:delete - DENIED',
      );
      expect(logEntry.data.allowed).toBe(false);
    });

    it('should sanitize sensitive data in permission conditions', () => {
      process.env.NODE_ENV = 'production';
      const conditions = { targetUserId: 'user-456', key: 'secret-key' };

      service.permissionCheck(
        'api:access',
        true,
        'ApiController.access',
        testContext,
        conditions,
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.data.conditions.key).toBe('[REDACTED]');
      expect(logEntry.data.conditions.targetUserId).toBe('user-456');
    });

    it('should handle permission check without conditions', () => {
      process.env.NODE_ENV = 'production';
      service.permissionCheck(
        'user:profile:read',
        true,
        'UserController.getProfile',
        testContext,
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.data.conditions).toBeUndefined();
    });
  });

  describe('databaseOperation', () => {
    const testContext: LogContext = {
      userId: 'user-123',
      correlationId: 'req-456',
    };

    it('should log database SELECT operation', () => {
      process.env.NODE_ENV = 'production';
      service.databaseOperation(
        'SELECT',
        'user_profiles',
        'UserService.findById',
        testContext,
        { userId: 'user-123', fields: ['id', 'name'] },
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.level).toBe('debug');
      expect(logEntry.message).toBe('Database SELECT on user_profiles');
      expect(logEntry.data).toMatchObject({
        operation: 'SELECT',
        table: 'user_profiles',
        details: { userId: 'user-123', fields: ['id', 'name'] },
      });
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
      process.env.NODE_ENV = 'production';
      const details = {
        username: 'user',
        password: 'new-password',
        email: 'user@example.com',
      };

      service.databaseOperation(
        'UPDATE',
        'users',
        'UserService.updatePassword',
        testContext,
        details,
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.data.details.password).toBe('[REDACTED]');
      expect(logEntry.data.details.username).toBe('user');
      expect(logEntry.data.details.email).toBe('user@example.com');
    });

    it('should handle database operation without details', () => {
      process.env.NODE_ENV = 'production';
      service.databaseOperation(
        'DELETE',
        'temp_files',
        'CleanupService.clearTemp',
        testContext,
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.data.details).toBeUndefined();
    });
  });

  describe('Structured Log Creation', () => {
    it('should create complete structured log entry', () => {
      process.env.NODE_ENV = 'production';
      const testContext: LogContext = {
        userId: 'user-123',
        username: 'testuser',
        accountType: 'premium',
        correlationId: 'req-456',
        requestPath: '/api/users/123',
        method: 'POST',
      };

      service.logWithContext(
        'log',
        'User action performed',
        'UserController',
        testContext,
        { action: 'profile_update' },
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(logEntry).toMatchObject({
        level: 'log',
        context: 'UserController',
        message: 'User action performed',
        correlationId: 'req-456',
        userId: 'user-123',
        requestPath: '/api/users/123',
        data: { action: 'profile_update' },
      });
      expect(logEntry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should handle partial log context', () => {
      process.env.NODE_ENV = 'production';
      const partialContext: LogContext = {
        correlationId: 'req-789',
      };

      service.logWithContext(
        'log',
        'Partial context test',
        'TestController',
        partialContext,
      );

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(logEntry.correlationId).toBe('req-789');
      expect(logEntry.userId).toBeUndefined();
      expect(logEntry.requestPath).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large data objects', () => {
      process.env.NODE_ENV = 'production';
      const largeData = {
        largeArray: new Array(100).fill('data'),
        largeString: 'x'.repeat(1000),
        normalField: 'normal',
      };

      expect(() => {
        service.logWithContext(
          'log',
          'Large data test',
          'TestContext',
          undefined,
          largeData,
        );
      }).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      process.env.NODE_ENV = 'production';
      const specialMessage = 'Message with 特殊文字 and emojis 🚀🔥';

      service.logWithContext('log', specialMessage, 'TestContext');

      const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logEntry.message).toBe(specialMessage);
    });

    it('should handle empty objects and arrays', () => {
      process.env.NODE_ENV = 'production';

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

      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });
  });
});
