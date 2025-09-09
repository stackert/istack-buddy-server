# Logging and Error Handling Conventions

## Overview

This document defines the logging and error handling conventions used throughout the iStack Buddy project. These conventions ensure consistent, traceable, and secure logging across all application components.

## Logging Architecture

### Core Components

- **CustomLoggerService**: Main logging service with structured logging, data sanitization, and contextual information
- **CorrelationInterceptor**: Adds unique correlation IDs to all requests for request tracing
- **LoggingInterceptor**: Logs all HTTP requests and responses with timing information
- **GlobalExceptionFilter**: Handles all unhandled exceptions with structured error responses
- **ValidationExceptionFilter**: Specifically handles validation errors with detailed field information

### Structured Logging Format

All logs follow a consistent JSON structure:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info|warn|error|debug|verbose",
  "context": "ServiceName.methodName",
  "message": "Human readable message",
  "correlationId": "uuid-v4",
  "userId": "user-id-if-available",
  "requestPath": "/api/endpoint",
  "data": {
    "sanitized": "application data"
  },
  "error": {
    "name": "ErrorName",
    "message": "Error message",
    "stack": "Error stack trace"
  }
}
```

## Logging Conventions

### Context Naming

- **Format**: `ServiceName.methodName` or `ComponentName`
- **Examples**:
  - `DevDebugService.authenticate`
  - `HttpRequest`, `HttpResponse`, `HttpError`
  - `GlobalExceptionFilter`
  - `DatabaseScript`

### Log Levels

- **error**: System errors, exceptions, failed operations
- **warn**: Validation failures, permission denials, recoverable issues
- **log**: Normal operations, successful requests, important events
- **debug**: Development information, detailed operation flow
- **verbose**: Detailed debugging information, typically disabled in production

### Correlation IDs

- **Format**: UUID v4 generated per request
- **Header**: `x-correlation-id` (both request and response)
- **Usage**: Include in all log entries within a request scope
- **Purpose**: Trace all operations for a single request across services

### Data Sanitization

**Sensitive Fields (Automatically Redacted):**

- `password`, `passwordHash`
- `token`, `accessToken`, `refreshToken`
- `secret`, `key`
- `authorization`

**Sanitization Rules:**

- Recursive sanitization of nested objects
- Array elements are individually sanitized
- Sensitive fields replaced with `[REDACTED]`
- Applied to all log data automatically

## Error Handling Conventions

### Error Response Format

All HTTP errors return consistent structure:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "path": "/api/endpoint",
  "method": "POST",
  "message": "Error description",
  "correlationId": "uuid-v4",
  "details": {
    "development_only": "additional details"
  }
}
```

### Validation Error Format

Validation errors provide detailed field information:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "path": "/api/endpoint",
  "method": "POST",
  "message": "Validation failed",
  "correlationId": "uuid-v4",
  "errors": [
    {
      "field": "email",
      "value": "invalid-email",
      "constraints": {
        "isEmail": "email must be a valid email"
      }
    }
  ]
}
```

### Exception Handling Priority

1. **ValidationExceptionFilter**: Handles `BadRequestException` with detailed validation errors
2. **GlobalExceptionFilter**: Catches all other exceptions with structured error responses

## Specialized Logging Methods

### Audit Logging

```typescript
logger.auditLog(
  'LOGIN_ATTEMPT',
  'success|failure',
  'AuthService.login',
  logContext,
  { userId, timestamp, ip },
);
```

**Use Cases:**

- Authentication attempts
- Permission grants/denials
- Data access operations
- Administrative actions

### Permission Logging

```typescript
logger.permissionCheck(
  'user:read',
  true | false,
  'UserService.getUser',
  logContext,
  { conditions, userId },
);
```

**Use Cases:**

- Access control decisions
- Permission evaluations
- Role-based access checks

### Database Operation Logging

```typescript
logger.databaseOperation(
  'INSERT|UPDATE|DELETE|SELECT',
  'users',
  'UserService.createUser',
  logContext,
  { affectedRows, query },
);
```

**Use Cases:**

- Database mutations
- Complex queries
- Bulk operations
- Schema changes

## Integration Patterns

### Service Integration

```typescript
@Injectable()
export class MyService {
  constructor(private readonly logger: CustomLoggerService) {}

  async myMethod(data: any): Promise<Result> {
    const logContext: LogContext = {
      correlationId: request.correlationId,
      userId: request.user?.id,
    };

    this.logger.logWithContext(
      'log',
      'Starting operation',
      'MyService.myMethod',
      logContext,
      { inputData: data },
    );

    // ... operation logic

    this.logger.logWithContext(
      'log',
      'Operation completed',
      'MyService.myMethod',
      logContext,
      { result },
    );

    return result;
  }
}
```

### Error Handling Integration

```typescript
try {
  // operation
} catch (error) {
  this.logger.errorWithContext(
    'Operation failed',
    error,
    'MyService.myMethod',
    logContext,
    { attemptedOperation: 'description' },
  );

  throw new HttpException(
    'User-friendly error message',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
```

## Environment Configuration

### Development

- **Level**: `debug`
- **Request/Response Logging**: Enabled
- **Sensitive Data**: Hidden
- **Format**: Pretty-printed console output

### Test

- **Level**: `warn`
- **Request/Response Logging**: Disabled
- **Database Logging**: Disabled
- **Format**: Minimal output

### Production

- **Level**: `log`
- **Format**: JSON structured output
- **External Service**: Configurable via environment variables
- **Sensitive Data**: Strictly hidden

## Database Script Logging

### Pattern

```typescript
const logger = new DatabaseLogger();

logger.log('operation-name', 'Human readable message', {
  database: 'db-name',
  affected: 'details',
});
```

### Operations

- **create-database**: Database creation operations
- **seed-database**: Data seeding operations
- **migration**: Schema migration operations

## Security Considerations

1. **Never Log Sensitive Data**: Automatic sanitization prevents accidental exposure
2. **Correlation IDs**: Enable request tracing without exposing user data
3. **Audit Trail**: All security-relevant operations are logged
4. **Access Control**: Permission checks are logged for compliance
5. **Error Details**: Detailed error information only in development

## Monitoring Integration

### Structured Logs Enable:

- **Request Tracing**: Follow requests across services
- **Performance Monitoring**: Request timing and response codes
- **Error Tracking**: Automatic error aggregation and alerting
- **Audit Compliance**: Security event tracking
- **Debugging**: Correlation-based log filtering

## Best Practices

1. **Always Include Context**: Use service and method names consistently
2. **Use Appropriate Log Levels**: Follow level conventions strictly
3. **Include Correlation IDs**: Enable request tracing
4. **Sanitize Data**: Never log sensitive information
5. **Structured Data**: Use JSON objects for complex data
6. **Error Context**: Include relevant context with errors
7. **Audit Important Events**: Log security-relevant operations
8. **Performance Aware**: Log response times and performance metrics
