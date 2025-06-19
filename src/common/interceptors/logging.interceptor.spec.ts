import { Test, TestingModule } from '@nestjs/testing';
import { LoggingInterceptor } from './logging.interceptor';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { Request, Response } from 'express';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logger: jest.Mocked<CustomLoggerService>;

  beforeEach(async () => {
    const mockLogger = {
      logWithContext: jest.fn(),
      errorWithContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingInterceptor,
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
    logger = module.get<CustomLoggerService>(
      CustomLoggerService,
    ) as jest.Mocked<CustomLoggerService>;
  });

  const createMockExecutionContext = (
    method: string = 'GET',
    url: string = '/test',
    correlationId?: string,
    user?: any,
  ): ExecutionContext => {
    const mockRequest: any = {
      method,
      url,
      correlationId,
      user,
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      params: {},
      query: {},
    };

    const mockResponse: Partial<Response> = {
      statusCode: 200,
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;
  };

  const createMockCallHandler = (
    result: any,
    shouldThrow: boolean = false,
  ): CallHandler => {
    return {
      handle: jest
        .fn()
        .mockReturnValue(
          shouldThrow ? throwError(() => new Error(result)) : of(result),
        ),
    };
  };

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should log successful HTTP requests', (done) => {
      const context = createMockExecutionContext(
        'GET',
        '/api/users',
        'corr-123',
      );
      const callHandler = createMockCallHandler({ users: ['user1', 'user2'] });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ users: ['user1', 'user2'] });

          // Check incoming request log
          expect(logger.logWithContext).toHaveBeenCalledWith(
            'log',
            'Incoming GET /api/users',
            'HttpRequest',
            expect.objectContaining({
              correlationId: 'corr-123',
              requestPath: '/api/users',
              method: 'GET',
            }),
            expect.objectContaining({
              userAgent: 'test-agent',
              ip: '127.0.0.1',
            }),
          );

          // Check response log
          expect(logger.logWithContext).toHaveBeenCalledWith(
            'log',
            expect.stringMatching(/Response GET \/api\/users 200 - \d+ms/),
            'HttpResponse',
            expect.objectContaining({
              correlationId: 'corr-123',
              requestPath: '/api/users',
              method: 'GET',
            }),
            expect.objectContaining({
              statusCode: 200,
              elapsed: expect.stringMatching(/\d+ms/),
            }),
          );

          done();
        },
        error: done,
      });
    });

    it('should log HTTP request errors', (done) => {
      const context = createMockExecutionContext(
        'POST',
        '/api/users',
        'corr-456',
      );
      const callHandler = createMockCallHandler(
        'Database connection failed',
        true,
      );

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: () => done('Should not succeed'),
        error: (error) => {
          expect(error.message).toBe('Database connection failed');

          // Check that incoming request was logged
          expect(logger.logWithContext).toHaveBeenCalledWith(
            'log',
            'Incoming POST /api/users',
            'HttpRequest',
            expect.objectContaining({
              correlationId: 'corr-456',
              requestPath: '/api/users',
              method: 'POST',
            }),
            expect.any(Object),
          );

          // Check error log
          expect(logger.errorWithContext).toHaveBeenCalledWith(
            expect.stringMatching(/Error POST \/api\/users - \d+ms/),
            error,
            'HttpError',
            expect.objectContaining({
              correlationId: 'corr-456',
              requestPath: '/api/users',
              method: 'POST',
            }),
            expect.objectContaining({
              statusCode: 200,
              elapsed: expect.stringMatching(/\d+ms/),
            }),
          );

          done();
        },
      });
    });

    it('should handle requests without correlation ID', (done) => {
      const context = createMockExecutionContext('DELETE', '/api/users/123');
      const callHandler = createMockCallHandler({ success: true });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ success: true });

          expect(logger.logWithContext).toHaveBeenCalledWith(
            'log',
            'Incoming DELETE /api/users/123',
            'HttpRequest',
            expect.objectContaining({
              correlationId: undefined,
              requestPath: '/api/users/123',
              method: 'DELETE',
            }),
            expect.any(Object),
          );

          done();
        },
        error: done,
      });
    });

    it('should handle requests with user context', (done) => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        accountType: 'STUDENT',
      };
      const context = createMockExecutionContext(
        'GET',
        '/api/profile',
        'corr-789',
        user,
      );
      const callHandler = createMockCallHandler({ profile: 'data' });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: () => {
          expect(logger.logWithContext).toHaveBeenCalledWith(
            'log',
            'Incoming GET /api/profile',
            'HttpRequest',
            expect.objectContaining({
              correlationId: 'corr-789',
              requestPath: '/api/profile',
              method: 'GET',
              userId: 'user-123',
              username: 'testuser',
              accountType: 'STUDENT',
            }),
            expect.any(Object),
          );

          done();
        },
        error: done,
      });
    });

    it('should measure request duration', (done) => {
      const context = createMockExecutionContext('GET', '/api/test');
      const callHandler = createMockCallHandler({ test: 'result' });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: () => {
          // Verify that both logs were called
          expect(logger.logWithContext).toHaveBeenCalledTimes(2);

          // Check that the response log includes timing
          const responseCalls = logger.logWithContext.mock.calls.filter(
            (call) => call[1].includes('Response'),
          );
          expect(responseCalls).toHaveLength(1);
          expect(responseCalls[0][1]).toMatch(
            /Response GET \/api\/test 200 - \d+ms/,
          );

          done();
        },
        error: done,
      });
    });
  });
});
