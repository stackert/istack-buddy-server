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
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
