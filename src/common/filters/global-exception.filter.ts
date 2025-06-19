import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  CustomLoggerService,
  LogContext,
} from '../logger/custom-logger.service';

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  correlationId?: string;
  details?: any;
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: CustomLoggerService) {}

  /**
   * Handles all unhandled exceptions throughout the application.
   *
   * This global exception filter serves as the last line of defense for error handling,
   * catching any exceptions that aren't handled by more specific filters. It provides
   * consistent error response formatting, comprehensive logging, and special handling
   * for security-related errors. The filter automatically creates audit logs for
   * authentication/authorization failures and ensures sensitive information is not
   * exposed in production environments.
   *
   * @param exception - The exception that was thrown (can be HttpException, Error, or unknown)
   * @param host - The arguments host containing request/response context
   *
   * @example
   * ```typescript
   * // This filter handles various exception types and returns structured responses:
   *
   * // For HttpException:
   * // {
   * //   "statusCode": 404,
   * //   "timestamp": "2025-06-19T02:30:00.000Z",
   * //   "path": "/api/users/999",
   * //   "method": "GET",
   * //   "message": "User not found",
   * //   "correlationId": "uuid-123"
   * // }
   *
   * // For unknown errors (production):
   * // {
   * //   "statusCode": 500,
   * //   "timestamp": "2025-06-19T02:30:00.000Z",
   * //   "path": "/api/endpoint",
   * //   "method": "POST",
   * //   "message": "Internal server error",
   * //   "correlationId": "uuid-123"
   * // }
   *
   * // Additional features:
   * // - Automatic audit logging for 401/403 errors
   * // - Detailed error info in development environments
   * // - Full request context logging for debugging
   * ```
   */
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & { correlationId?: string; user?: any }
    >();

    const logContext: LogContext = {
      correlationId: request.correlationId,
      requestPath: request.url,
      method: request.method,
      userId: request.user?.id,
      username: request.user?.username,
      accountType: request.user?.accountType,
    };

    let status: number;
    let message: string;
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        details = exceptionResponse;
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      details = {
        name: exception.name,
        message: exception.message,
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Unknown server error';
      details = { exception };
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      correlationId: request.correlationId,
      // Only include details in development
      details: process.env.NODE_ENV === 'development' ? details : undefined,
    };

    // Log the error
    this.logger.errorWithContext(
      `HTTP Exception ${status}: ${message}`,
      exception instanceof Error ? exception : new Error(String(exception)),
      'GlobalExceptionFilter',
      logContext,
      {
        statusCode: status,
        requestBody: request.body,
        requestQuery: request.query,
        requestParams: request.params,
      },
    );

    // Audit log for security-related errors
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      this.logger.auditLog(
        'ACCESS_DENIED',
        'failure',
        'GlobalExceptionFilter',
        logContext,
        {
          statusCode: status,
          reason: message,
          attemptedResource: request.url,
        },
      );
    }

    response.status(status).json(errorResponse);
  }
}
