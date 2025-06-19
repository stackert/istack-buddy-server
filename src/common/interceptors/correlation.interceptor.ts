import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  /**
   * Intercepts HTTP requests to generate and manage correlation IDs for request tracing.
   *
   * This interceptor ensures every HTTP request has a unique correlation ID that can be
   * used to trace the request through the entire application lifecycle. It checks for
   * existing correlation IDs in request headers and generates new ones if none exist.
   * The correlation ID is added to both the request object and response headers for
   * end-to-end traceability.
   *
   * @param context - The execution context containing request/response information
   * @param next - The call handler to continue the request processing pipeline
   * @returns Observable that continues the request processing with correlation ID attached
   *
   * @example
   * ```typescript
   * // This interceptor automatically:
   * // 1. Checks for 'x-correlation-id' header in incoming requests
   * // 2. Generates a new UUID if no correlation ID exists
   * // 3. Attaches correlation ID to request object as request.correlationId
   * // 4. Adds 'x-correlation-id' header to response for client tracing
   *
   * // Usage in other services:
   * const correlationId = request.correlationId; // Available throughout request lifecycle
   * ```
   */
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Generate or use existing correlation ID
    const correlationId = request.headers['x-correlation-id'] || uuidv4();

    // Store correlation ID in request for later use
    request.correlationId = correlationId;

    // Add correlation ID to response headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('x-correlation-id', correlationId);

    return next.handle();
  }
}
