import { Test, TestingModule } from '@nestjs/testing';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  GlobalExceptionFilter,
  ErrorResponse,
} from './global-exception.filter';
import { CustomLoggerService } from '../logger/custom-logger.service';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let loggerService: Partial<CustomLoggerService>;
  let mockRequest: Partial<Request & { correlationId?: string; user?: any }>;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Store original environment
    originalEnv = process.env.NODE_ENV;

    // Create mock logger service
    loggerService = {
      errorWithContext: jest.fn(),
      auditLog: jest.fn(),
      logWithContext: jest.fn(),
      permissionCheck: jest.fn(),
      databaseOperation: jest.fn(),
    };

    // Create mock request
    mockRequest = {
      url: '/api/test',
      method: 'GET',
      body: { test: 'data' },
      query: { param: 'value' },
      params: { id: '123' },
      correlationId: 'test-correlation-id',
      user: {
        id: 'user-123',
        username: 'testuser',
        accountType: 'standard',
      },
    };

    // Create mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Create mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionFilter,
        {
          provide: CustomLoggerService,
          useValue: loggerService,
        },
      ],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(filter).toBeDefined();
    });

    it('should be an instance of GlobalExceptionFilter', () => {
      expect(filter).toBeInstanceOf(GlobalExceptionFilter);
    });

    it('should have catch method', () => {
      expect(typeof filter.catch).toBe('function');
    });
  });

  describe('HttpException Handling', () => {
    it('should handle HttpException with object response', () => {
      const exception = new BadRequestException({
        message: 'Validation failed',
        errors: ['field1 is required'],
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          path: '/api/test',
          method: 'GET',
          message: 'Validation failed',
          correlationId: 'test-correlation-id',
        }),
      );
    });

    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Not found',
        }),
      );
    });

    it('should handle HttpException without message in object response', () => {
      const exception = new HttpException(
        { error: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Http Exception',
        }),
      );
    });

    it('should log HttpException with proper context', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.errorWithContext).toHaveBeenCalledWith(
        'HTTP Exception 400: Test error',
        exception,
        'GlobalExceptionFilter',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          requestPath: '/api/test',
          method: 'GET',
          userId: 'user-123',
          username: 'testuser',
          accountType: 'standard',
        }),
        expect.any(Object),
      );
    });
  });

  describe('Standard Error Handling', () => {
    it('should handle standard Error instances', () => {
      const exception = new Error('Database connection failed');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal server error',
        }),
      );
    });

    it('should log standard Error with proper context', () => {
      const exception = new Error('Test system error');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.errorWithContext).toHaveBeenCalledWith(
        'HTTP Exception 500: Internal server error',
        exception,
        'GlobalExceptionFilter',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          requestPath: '/api/test',
          method: 'GET',
          userId: 'user-123',
          username: 'testuser',
          accountType: 'standard',
        }),
        expect.any(Object),
      );
    });
  });

  describe('Unknown Exception Handling', () => {
    it('should handle unknown exception types', () => {
      const exception = 'string error';

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Unknown server error',
        }),
      );
    });

    it('should handle null exceptions', () => {
      const exception = null;

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Unknown server error',
        }),
      );
    });

    it('should handle undefined exceptions', () => {
      const exception = undefined;

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Unknown server error',
        }),
      );
    });

    it('should log unknown exception with created Error wrapper', () => {
      const exception = { unexpected: 'object' };

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.errorWithContext).toHaveBeenCalledWith(
        'HTTP Exception 500: Unknown server error',
        expect.any(Error),
        'GlobalExceptionFilter',
        expect.any(Object),
        expect.any(Object),
      );

      const errorArg = (loggerService.errorWithContext as jest.Mock).mock
        .calls[0][1];
      expect(errorArg.message).toBe('[object Object]');
    });
  });

  describe('Security Audit Logging', () => {
    it('should create audit log for 401 Unauthorized errors', () => {
      const exception = new HttpException(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.auditLog).toHaveBeenCalledWith(
        'ACCESS_DENIED',
        'failure',
        'GlobalExceptionFilter',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          userId: 'user-123',
        }),
        expect.objectContaining({
          statusCode: 401,
          reason: 'Unauthorized',
          attemptedResource: '/api/test',
        }),
      );
    });

    it('should create audit log for 403 Forbidden errors', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.auditLog).toHaveBeenCalled();
    });

    it('should not create audit log for non-security errors', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.auditLog).not.toHaveBeenCalled();
    });

    it('should not create audit log for 500 errors', () => {
      const exception = new Error('Internal error');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.auditLog).not.toHaveBeenCalled();
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should include error details in development environment', () => {
      process.env.NODE_ENV = 'development';
      const exception = new BadRequestException('Development error');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;

      expect(errorResponse.details).toBeDefined();
    });

    it('should exclude error details in production environment', () => {
      process.env.NODE_ENV = 'production';
      const exception = new BadRequestException('Production error');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;

      expect(errorResponse.details).toBeUndefined();
    });

    it('should exclude error details when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      const exception = new BadRequestException('No env error');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;

      expect(errorResponse.details).toBeUndefined();
    });
  });

  describe('Request Context Handling', () => {
    it('should handle request without correlationId', () => {
      mockRequest.correlationId = undefined;

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;

      expect(errorResponse.correlationId).toBeUndefined();
    });

    it('should handle request without user', () => {
      mockRequest.user = undefined;

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.errorWithContext).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        'GlobalExceptionFilter',
        expect.objectContaining({
          userId: undefined,
          username: undefined,
          accountType: undefined,
        }),
        expect.any(Object),
      );
    });

    it('should handle request with partial user data', () => {
      mockRequest.user = { id: 'user-456' };

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.errorWithContext).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        'GlobalExceptionFilter',
        expect.objectContaining({
          userId: 'user-456',
          username: undefined,
          accountType: undefined,
        }),
        expect.any(Object),
      );
    });

    it('should handle request without body, query, or params', () => {
      mockRequest.body = undefined;
      mockRequest.query = undefined;
      mockRequest.params = undefined;

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.errorWithContext).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        'GlobalExceptionFilter',
        expect.any(Object),
        expect.objectContaining({
          requestBody: undefined,
          requestQuery: undefined,
          requestParams: undefined,
        }),
      );
    });
  });

  describe('Error Response Structure', () => {
    it('should create properly structured error response', () => {
      const exception = new HttpException('Test error', HttpStatus.CONFLICT);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;

      expect(errorResponse).toMatchObject({
        statusCode: 409,
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
        path: '/api/test',
        method: 'GET',
        message: 'Test error',
        correlationId: 'test-correlation-id',
      });
    });

    it('should have consistent timestamp format', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;

      const timestamp = new Date(errorResponse.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('HTTP Status Code Handling', () => {
    const statusTestCases = [
      { status: HttpStatus.BAD_REQUEST, name: 'BAD_REQUEST' },
      { status: HttpStatus.UNAUTHORIZED, name: 'UNAUTHORIZED' },
      { status: HttpStatus.FORBIDDEN, name: 'FORBIDDEN' },
      { status: HttpStatus.NOT_FOUND, name: 'NOT_FOUND' },
      { status: HttpStatus.CONFLICT, name: 'CONFLICT' },
      { status: HttpStatus.UNPROCESSABLE_ENTITY, name: 'UNPROCESSABLE_ENTITY' },
      { status: HttpStatus.TOO_MANY_REQUESTS, name: 'TOO_MANY_REQUESTS' },
    ];

    statusTestCases.forEach(({ status, name }) => {
      it(`should handle ${name} (${status}) status correctly`, () => {
        const exception = new HttpException('Test error', status);

        filter.catch(exception, mockArgumentsHost as ArgumentsHost);

        expect(mockResponse.status).toHaveBeenCalledWith(status);

        const responseCall = mockResponse.json as jest.Mock;
        const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;
        expect(errorResponse.statusCode).toBe(status);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long error messages', () => {
      const longMessage = 'x'.repeat(1000);
      const exception = new HttpException(longMessage, HttpStatus.BAD_REQUEST);

      expect(() => {
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      }).not.toThrow();

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;
      expect(errorResponse.message).toBe(longMessage);
    });

    it('should handle special characters in error messages', () => {
      const specialMessage = 'Error with 特殊文字 and emojis 🚀🔥';
      const exception = new HttpException(
        specialMessage,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock.calls[0][0] as ErrorResponse;
      expect(errorResponse.message).toBe(specialMessage);
    });

    it('should handle errors with circular references in details', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const exception = new HttpException(circularObj, HttpStatus.BAD_REQUEST);

      expect(() => {
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      }).not.toThrow();
    });
  });
});
