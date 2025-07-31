import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ValidationExceptionFilter,
  ValidationErrorResponse,
} from './validation-exception.filter';
import { CustomLoggerService } from '../logger/custom-logger.service';

describe('ValidationExceptionFilter', () => {
  let filter: ValidationExceptionFilter;
  let loggerService: Partial<CustomLoggerService>;
  let mockRequest: Partial<Request & { correlationId?: string; user?: any }>;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(async () => {
    loggerService = {
      logWithContext: jest.fn(),
      errorWithContext: jest.fn(),
      auditLog: jest.fn(),
      permissionCheck: jest.fn(),
      databaseOperation: jest.fn(),
    };

    mockRequest = {
      url: '/api/auth/login',
      method: 'POST',
      body: { email: 'invalid-email', password: 'short' },
      query: { test: 'query' },
      params: { id: '123' },
      correlationId: 'validation-correlation-id',
      user: {
        id: 'user-456',
        username: 'validationuser',
        accountType: 'premium',
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationExceptionFilter,
        {
          provide: CustomLoggerService,
          useValue: loggerService,
        },
      ],
    }).compile();

    filter = module.get<ValidationExceptionFilter>(ValidationExceptionFilter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(filter).toBeDefined();
    });

    it('should be an instance of ValidationExceptionFilter', () => {
      expect(filter).toBeInstanceOf(ValidationExceptionFilter);
    });

    it('should have catch method', () => {
      expect(typeof filter.catch).toBe('function');
    });
  });

  describe('Class-Validator Error Handling', () => {
    it('should handle class-validator validation errors', () => {
      const validationErrors = [
        {
          property: 'email',
          value: 'invalid-email',
          constraints: {
            isEmail: 'email must be a valid email address',
            isNotEmpty: 'email should not be empty',
          },
        },
        {
          property: 'password',
          value: 'short',
          constraints: {
            minLength: 'password must be longer than or equal to 8 characters',
          },
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        timestamp: expect.any(String),
        path: '/api/auth/login',
        method: 'POST',
        message: 'Validation failed',
        correlationId: 'validation-correlation-id',
        errors: [
          {
            field: 'email',
            value: 'invalid-email',
            constraints: {
              isEmail: 'email must be a valid email address',
              isNotEmpty: 'email should not be empty',
            },
          },
          {
            field: 'password',
            value: 'short',
            constraints: {
              minLength:
                'password must be longer than or equal to 8 characters',
            },
          },
        ],
      });
    });

    it('should handle validation errors without property field', () => {
      const validationErrors = [
        {
          value: 'invalid-value',
          constraints: {
            custom: 'custom validation failed',
          },
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors).toHaveLength(1);
      expect(errorResponse.errors[0]).toEqual({
        field: 'unknown',
        value: 'invalid-value',
        constraints: {
          custom: 'custom validation failed',
        },
      });
    });

    it('should handle validation errors without constraints', () => {
      const validationErrors = [
        {
          property: 'name',
          value: '',
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors[0]).toEqual({
        field: 'name',
        value: '',
        constraints: {},
      });
    });

    it('should log validation errors with proper context', () => {
      const validationErrors = [
        {
          property: 'email',
          value: 'bad-email',
          constraints: {
            isEmail: 'email must be a valid email address',
          },
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.logWithContext).toHaveBeenCalledWith(
        'warn',
        'Validation Error: 1 validation(s) failed',
        'ValidationExceptionFilter',
        {
          correlationId: 'validation-correlation-id',
          requestPath: '/api/auth/login',
          method: 'POST',
          userId: 'user-456',
          username: 'validationuser',
          accountType: 'premium',
        },
        {
          validationErrors: [
            {
              field: 'email',
              value: 'bad-email',
              constraints: {
                isEmail: 'email must be a valid email address',
              },
            },
          ],
          requestBody: { email: 'invalid-email', password: 'short' },
          requestQuery: { test: 'query' },
          requestParams: { id: '123' },
        },
      );
    });
  });

  describe('Simple String Error Handling', () => {
    it('should handle simple string validation errors', () => {
      const exception = new BadRequestException({
        message: 'Invalid input data',
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors).toHaveLength(1);
      expect(errorResponse.errors[0]).toEqual({
        field: 'unknown',
        value: undefined,
        constraints: { error: 'Invalid input data' },
      });
    });

    it('should handle exception with simple string message', () => {
      const exception = new BadRequestException('Simple validation error');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors[0]).toEqual({
        field: 'unknown',
        value: undefined,
        constraints: { error: 'Simple validation error' },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle exception without message property', () => {
      const exception = new BadRequestException({
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors).toHaveLength(0);
    });

    it('should handle exception with non-array, non-string message', () => {
      const exception = new BadRequestException({
        message: { unexpected: 'object' },
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors).toHaveLength(0);
    });

    it('should handle empty validation errors array', () => {
      const exception = new BadRequestException({
        message: [],
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors).toHaveLength(0);
    });
  });

  describe('Request Context Handling', () => {
    it('should handle request without correlationId', () => {
      mockRequest.correlationId = undefined;

      const exception = new BadRequestException({
        message: 'Test validation error',
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.correlationId).toBeUndefined();
    });

    it('should handle request without user', () => {
      mockRequest.user = undefined;

      const exception = new BadRequestException({
        message: 'Test validation error',
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.logWithContext).toHaveBeenCalledWith(
        'warn',
        expect.any(String),
        'ValidationExceptionFilter',
        expect.objectContaining({
          userId: undefined,
          username: undefined,
          accountType: undefined,
        }),
        expect.any(Object),
      );
    });

    it('should handle request with partial user data', () => {
      mockRequest.user = { id: 'user-789' };

      const exception = new BadRequestException({
        message: 'Test validation error',
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.logWithContext).toHaveBeenCalledWith(
        'warn',
        expect.any(String),
        'ValidationExceptionFilter',
        expect.objectContaining({
          userId: 'user-789',
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

      const exception = new BadRequestException({
        message: 'Test validation error',
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.logWithContext).toHaveBeenCalledWith(
        'warn',
        expect.any(String),
        'ValidationExceptionFilter',
        expect.any(Object),
        expect.objectContaining({
          requestBody: undefined,
          requestQuery: undefined,
          requestParams: undefined,
        }),
      );
    });
  });

  describe('Response Structure', () => {
    it('should create properly structured validation error response', () => {
      const validationErrors = [
        {
          property: 'email',
          value: 'test@',
          constraints: {
            isEmail: 'email must be a valid email address',
          },
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse).toMatchObject({
        statusCode: 400,
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
        path: '/api/auth/login',
        method: 'POST',
        message: 'Validation failed',
        correlationId: 'validation-correlation-id',
        errors: expect.any(Array),
      });
    });

    it('should have consistent timestamp format', () => {
      const exception = new BadRequestException('Test validation');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      const timestamp = new Date(errorResponse.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should always return statusCode 400', () => {
      const exception = new BadRequestException('Any validation error');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.statusCode).toBe(400);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should always have message "Validation failed"', () => {
      const exception = new BadRequestException('Custom error message');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.message).toBe('Validation failed');
    });
  });

  describe('Multiple Validation Errors', () => {
    it('should handle multiple fields with multiple constraints each', () => {
      const validationErrors = [
        {
          property: 'email',
          value: '',
          constraints: {
            isEmail: 'email must be a valid email address',
            isNotEmpty: 'email should not be empty',
            maxLength: 'email must be shorter than or equal to 100 characters',
          },
        },
        {
          property: 'password',
          value: '123',
          constraints: {
            minLength: 'password must be longer than or equal to 8 characters',
            matches: 'password must contain at least one uppercase letter',
          },
        },
        {
          property: 'age',
          value: -5,
          constraints: {
            min: 'age must not be less than 0',
            isInt: 'age must be an integer number',
          },
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors).toHaveLength(3);
      expect(errorResponse.errors[0].field).toBe('email');
      expect(errorResponse.errors[1].field).toBe('password');
      expect(errorResponse.errors[2].field).toBe('age');

      expect(Object.keys(errorResponse.errors[0].constraints)).toHaveLength(3);
      expect(Object.keys(errorResponse.errors[1].constraints)).toHaveLength(2);
      expect(Object.keys(errorResponse.errors[2].constraints)).toHaveLength(2);
    });

    it('should log correct count of validation errors', () => {
      const validationErrors = [
        { property: 'field1', constraints: { error: 'error1' } },
        { property: 'field2', constraints: { error: 'error2' } },
        { property: 'field3', constraints: { error: 'error3' } },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerService.logWithContext).toHaveBeenCalledWith(
        'warn',
        'Validation Error: 3 validation(s) failed',
        'ValidationExceptionFilter',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('Special Characters and Values', () => {
    it('should handle validation errors with special characters', () => {
      const validationErrors = [
        {
          property: 'name',
          value: '特殊文字🚀',
          constraints: {
            pattern: 'name must contain only alphanumeric characters',
          },
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors[0].value).toBe('特殊文字🚀');
    });

    it('should handle validation errors with complex values', () => {
      const complexValue = {
        nested: { object: true },
        array: [1, 2, 3],
        nullValue: null,
      };

      const validationErrors = [
        {
          property: 'data',
          value: complexValue,
          constraints: {
            isString: 'data must be a string',
          },
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors[0].value).toEqual(complexValue);
    });

    it('should handle very long validation messages', () => {
      const longMessage = 'x'.repeat(1000);
      const validationErrors = [
        {
          property: 'field',
          value: 'test',
          constraints: {
            custom: longMessage,
          },
        },
      ];

      const exception = new BadRequestException({
        message: validationErrors,
      });

      expect(() => {
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      }).not.toThrow();

      const responseCall = mockResponse.json as jest.Mock;
      const errorResponse = responseCall.mock
        .calls[0][0] as ValidationErrorResponse;

      expect(errorResponse.errors[0].constraints.custom).toBe(longMessage);
    });
  });
});
