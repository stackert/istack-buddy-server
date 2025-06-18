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

  catch(exception: BadRequestException, host: ArgumentsHost): void {
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
