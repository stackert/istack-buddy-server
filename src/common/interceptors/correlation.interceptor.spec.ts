import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationInterceptor } from './correlation.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { Request, Response } from 'express';

// Mock uuid to have predictable test results
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

describe('CorrelationInterceptor', () => {
  let interceptor: CorrelationInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationInterceptor],
    }).compile();

    interceptor = module.get<CorrelationInterceptor>(CorrelationInterceptor);
  });

  const createMockExecutionContext = (
    headers: Record<string, string> = {},
    method: string = 'GET',
    url: string = '/test',
  ): ExecutionContext => {
    const mockRequest: any = {
      method,
      url,
      headers,
    };

    const mockResponse: Partial<Response> = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;
  };

  const createMockCallHandler = (
    result: any = { success: true },
  ): CallHandler => {
    return {
      handle: jest.fn().mockReturnValue(of(result)),
    };
  };

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should generate new correlation ID when none exists in headers', (done) => {
      const context = createMockExecutionContext({}, 'GET', '/api/users');
      const callHandler = createMockCallHandler({ users: ['user1'] });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ users: ['user1'] });

          // Check that request got correlation ID
          const request = context.switchToHttp().getRequest();
          expect(request.correlationId).toBe('mock-uuid-12345');

          // Check that response header was set
          const response = context.switchToHttp().getResponse();
          expect(response.setHeader).toHaveBeenCalledWith(
            'x-correlation-id',
            'mock-uuid-12345',
          );

          done();
        },
        error: done,
      });
    });

    it('should use existing correlation ID from x-correlation-id header', (done) => {
      const existingCorrelationId = 'existing-correlation-123';
      const context = createMockExecutionContext({
        'x-correlation-id': existingCorrelationId,
        'user-agent': 'test-browser',
      });
      const callHandler = createMockCallHandler({ status: 'ok' });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ status: 'ok' });

          // Check that existing correlation ID was used
          const request = context.switchToHttp().getRequest();
          expect(request.correlationId).toBe(existingCorrelationId);

          // Check that response header was set with existing ID
          const response = context.switchToHttp().getResponse();
          expect(response.setHeader).toHaveBeenCalledWith(
            'x-correlation-id',
            existingCorrelationId,
          );

          done();
        },
        error: done,
      });
    });

    it('should handle POST requests with correlation ID', (done) => {
      const correlationId = 'post-correlation-456';
      const context = createMockExecutionContext(
        {
          'x-correlation-id': correlationId,
          'content-type': 'application/json',
        },
        'POST',
        '/api/users',
      );
      const callHandler = createMockCallHandler({ id: 123, name: 'John' });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ id: 123, name: 'John' });

          const request = context.switchToHttp().getRequest();
          expect(request.correlationId).toBe(correlationId);

          const response = context.switchToHttp().getResponse();
          expect(response.setHeader).toHaveBeenCalledWith(
            'x-correlation-id',
            correlationId,
          );

          done();
        },
        error: done,
      });
    });

    it('should handle case-sensitive header names correctly', (done) => {
      // Test with different case variations
      const context = createMockExecutionContext({
        'X-Correlation-ID': 'case-test-789', // Different case
        'other-header': 'value',
      });
      const callHandler = createMockCallHandler({ test: 'data' });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: () => {
          const request = context.switchToHttp().getRequest();
          // Should generate new ID since exact case 'x-correlation-id' not found
          expect(request.correlationId).toBe('mock-uuid-12345');

          const response = context.switchToHttp().getResponse();
          expect(response.setHeader).toHaveBeenCalledWith(
            'x-correlation-id',
            'mock-uuid-12345',
          );

          done();
        },
        error: done,
      });
    });

    it('should handle empty headers object', (done) => {
      const context = createMockExecutionContext({});
      const callHandler = createMockCallHandler();

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: () => {
          const request = context.switchToHttp().getRequest();
          expect(request.correlationId).toBe('mock-uuid-12345');

          const response = context.switchToHttp().getResponse();
          expect(response.setHeader).toHaveBeenCalledWith(
            'x-correlation-id',
            'mock-uuid-12345',
          );

          done();
        },
        error: done,
      });
    });

    it('should handle requests with multiple headers including correlation ID', (done) => {
      const correlationId = 'multi-header-test-999';
      const context = createMockExecutionContext({
        authorization: 'Bearer token123',
        'x-correlation-id': correlationId,
        'user-agent': 'test-client',
        accept: 'application/json',
      });
      const callHandler = createMockCallHandler({ authenticated: true });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ authenticated: true });

          const request = context.switchToHttp().getRequest();
          expect(request.correlationId).toBe(correlationId);

          const response = context.switchToHttp().getResponse();
          expect(response.setHeader).toHaveBeenCalledWith(
            'x-correlation-id',
            correlationId,
          );

          done();
        },
        error: done,
      });
    });

    it('should work with different HTTP methods', (done) => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      let completedTests = 0;

      methods.forEach((method, index) => {
        const correlationId = `${method.toLowerCase()}-test-${index}`;
        const context = createMockExecutionContext(
          {
            'x-correlation-id': correlationId,
          },
          method,
          `/api/test-${method.toLowerCase()}`,
        );
        const callHandler = createMockCallHandler({ method, success: true });

        const result$ = interceptor.intercept(context, callHandler);

        result$.subscribe({
          next: (data) => {
            expect(data).toEqual({ method, success: true });

            const request = context.switchToHttp().getRequest();
            expect(request.correlationId).toBe(correlationId);

            const response = context.switchToHttp().getResponse();
            expect(response.setHeader).toHaveBeenCalledWith(
              'x-correlation-id',
              correlationId,
            );

            completedTests++;
            if (completedTests === methods.length) {
              done();
            }
          },
          error: done,
        });
      });
    });

    it('should preserve existing request properties while adding correlation ID', (done) => {
      const context = createMockExecutionContext({
        'x-correlation-id': 'preserve-test-555',
      });

      // Add some existing properties to the request
      const request = context.switchToHttp().getRequest();
      request.user = { id: 'user-123', name: 'Test User' };
      request.body = { data: 'test' };

      const callHandler = createMockCallHandler({ processed: true });

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: () => {
          // Check that existing properties are preserved
          expect(request.user).toEqual({ id: 'user-123', name: 'Test User' });
          expect(request.body).toEqual({ data: 'test' });

          // Check that correlation ID was added
          expect(request.correlationId).toBe('preserve-test-555');

          done();
        },
        error: done,
      });
    });
  });
});
