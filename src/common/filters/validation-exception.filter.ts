import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  CustomLoggerService,
  LogContext,
} from '../logger/custom-logger.service';

export interface ValidationErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  correlationId?: string;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  value: any;
  constraints: Record<string, string>;
}

@Injectable()
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: CustomLoggerService) {}

  /**
   * Handles BadRequestException instances, particularly validation errors from class-validator.
   *
   * This filter catches validation exceptions and transforms them into structured error responses
   * with detailed field-level validation information. It extracts validation constraints from
   * class-validator errors and formats them for easy client consumption. All validation errors
   * are logged with full context for debugging and monitoring purposes.
   *
   * @param exception - The BadRequestException instance containing validation error details
   * @param host - The arguments host containing request/response context
   *
   * @example
   * ```typescript
   * // This filter automatically handles validation errors and returns structured responses:
   * // {
   * //   "statusCode": 400,
   * //   "timestamp": "2025-06-19T02:30:00.000Z",
   * //   "path": "/auth/user",
   * //   "method": "POST",
   * //   "message": "Validation failed",
   * //   "correlationId": "uuid-123",
   * //   "errors": [
   * //     {
   * //       "field": "email",
   * //       "value": "invalid-email",
   * //       "constraints": {
   * //         "isEmail": "email must be a valid email address"
   * //       }
   * //     }
   * //   ]
   * // }
   * ```
   */
  public catch(exception: BadRequestException, host: ArgumentsHost): void {
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

    const exceptionResponse = exception.getResponse() as any;
    let validationErrors: ValidationError[] = [];

    if (
      exceptionResponse &&
      exceptionResponse.message &&
      Array.isArray(exceptionResponse.message)
    ) {
      // Handle class-validator errors
      validationErrors = exceptionResponse.message.map((error: any) => ({
        field: error.property || 'unknown',
        value: error.value,
        constraints: error.constraints || {},
      }));
    } else if (typeof exceptionResponse.message === 'string') {
      // Handle simple validation errors
      validationErrors = [
        {
          field: 'unknown',
          value: undefined,
          constraints: { error: exceptionResponse.message },
        },
      ];
    }

    const errorResponse: ValidationErrorResponse = {
      statusCode: 400,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: 'Validation failed',
      correlationId: request.correlationId,
      errors: validationErrors,
    };

    // Log validation errors (these are usually not system errors, so use warn level)
    this.logger.logWithContext(
      'warn',
      `Validation Error: ${validationErrors.length} validation(s) failed`,
      'ValidationExceptionFilter',
      logContext,
      {
        validationErrors,
        requestBody: request.body,
        requestQuery: request.query,
        requestParams: request.params,
      },
    );

    response.status(400).json(errorResponse);
  }
}
