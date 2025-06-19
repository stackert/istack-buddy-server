import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  CustomLoggerService,
  LogContext,
} from '../logger/custom-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {}

  /**
   * Intercepts HTTP requests and responses to provide comprehensive request/response logging.
   *
   * This interceptor automatically logs all incoming HTTP requests and their responses,
   * including timing information, status codes, and request metadata. It integrates with
   * the correlation ID system and provides structured logging for monitoring and debugging.
   * The interceptor sanitizes sensitive data and provides different log levels for
   * successful responses versus errors.
   *
   * @param context - The execution context containing request/response information
   * @param next - The call handler to continue the request processing pipeline
   * @returns Observable that emits the response data with logging side effects
   *
   * @example
   * ```typescript
   * // This interceptor is typically applied globally or to specific controllers
   * // It automatically logs:
   * // - Incoming requests with method, URL, user info, and metadata
   * // - Outgoing responses with status codes and timing
   * // - Errors with full context and timing information
   * ```
   */
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const now = Date.now();

    const logContext: LogContext = {
      correlationId: request.correlationId,
      requestPath: request.url,
      method: request.method,
      userId: request.user?.id,
      username: request.user?.username,
      accountType: request.user?.accountType,
    };

    // Log incoming request
    this.logger.logWithContext(
      'log',
      `Incoming ${request.method} ${request.url}`,
      'HttpRequest',
      logContext,
      {
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        params: request.params,
        query: request.query,
        // Don't log request body by default - can contain sensitive data
      },
    );

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          const elapsed = Date.now() - now;

          this.logger.logWithContext(
            'log',
            `Response ${request.method} ${request.url} ${response.statusCode} - ${elapsed}ms`,
            'HttpResponse',
            logContext,
            {
              statusCode: response.statusCode,
              elapsed: `${elapsed}ms`,
              // Don't log response data by default - can be large/sensitive
            },
          );
        },
        error: (error) => {
          const elapsed = Date.now() - now;

          this.logger.errorWithContext(
            `Error ${request.method} ${request.url} - ${elapsed}ms`,
            error,
            'HttpError',
            logContext,
            {
              statusCode: response.statusCode || 500,
              elapsed: `${elapsed}ms`,
            },
          );
        },
      }),
    );
  }
}
