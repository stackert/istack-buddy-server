import { Injectable, Logger, LoggerService } from '@nestjs/common';

export interface LogContext {
  userId?: string;
  username?: string;
  accountType?: string;
  correlationId?: string;
  requestPath?: string;
  method?: string;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  correlationId?: string;
  userId?: string;
  requestPath?: string;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

@Injectable()
export class CustomLoggerService extends Logger implements LoggerService {
  private sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'key',
    'authorization',
  ];

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized = { ...data };
    for (const field of this.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      }
    }

    return sanitized;
  }

  private createStructuredLog(
    level: string,
    message: string,
    context: string,
    logContext?: LogContext,
    data?: any,
    error?: Error,
  ): StructuredLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      correlationId: logContext?.correlationId,
      userId: logContext?.userId,
      requestPath: logContext?.requestPath,
      data: data ? this.sanitizeData(data) : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
  }

  logWithContext(
    level: 'log' | 'error' | 'warn' | 'debug' | 'verbose',
    message: string,
    context: string,
    logContext?: LogContext,
    data?: any,
  ): void {
    const structuredLog = this.createStructuredLog(
      level,
      message,
      context,
      logContext,
      data,
    );

    // In production, you might want to send this to an external logging service
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(structuredLog));
    } else {
      // Development: use NestJS's built-in logger for nice formatting
      const logMessage = logContext?.correlationId
        ? `[${logContext.correlationId}] ${message}`
        : message;

      super[level](logMessage, context);

      if (data) {
        super[level](
          `Data: ${JSON.stringify(this.sanitizeData(data), null, 2)}`,
          context,
        );
      }
    }
  }

  errorWithContext(
    message: string,
    error: Error,
    context: string,
    logContext?: LogContext,
    data?: any,
  ): void {
    const structuredLog = this.createStructuredLog(
      'error',
      message,
      context,
      logContext,
      data,
      error,
    );

    if (process.env.NODE_ENV === 'production') {
      console.error(JSON.stringify(structuredLog));
    } else {
      const logMessage = logContext?.correlationId
        ? `[${logContext.correlationId}] ${message}`
        : message;

      super.error(logMessage, error.stack, context);

      if (data) {
        super.error(
          `Data: ${JSON.stringify(this.sanitizeData(data), null, 2)}`,
          context,
        );
      }
    }
  }

  // Audit logging for security events
  auditLog(
    event: string,
    result: 'success' | 'failure',
    context: string,
    logContext?: LogContext,
    details?: any,
  ): void {
    this.logWithContext(
      'log',
      `AUDIT: ${event} - ${result}`,
      context,
      logContext,
      {
        auditEvent: event,
        result,
        details: this.sanitizeData(details),
      },
    );
  }

  // Permission logging
  permissionCheck(
    permission: string,
    allowed: boolean,
    context: string,
    logContext?: LogContext,
    conditions?: any,
  ): void {
    this.logWithContext(
      allowed ? 'debug' : 'warn',
      `Permission check: ${permission} - ${allowed ? 'ALLOWED' : 'DENIED'}`,
      context,
      logContext,
      {
        permission,
        allowed,
        conditions: this.sanitizeData(conditions),
      },
    );
  }

  // Database operation logging
  databaseOperation(
    operation: string,
    table: string,
    context: string,
    logContext?: LogContext,
    details?: any,
  ): void {
    this.logWithContext(
      'debug',
      `Database ${operation} on ${table}`,
      context,
      logContext,
      {
        operation,
        table,
        details: this.sanitizeData(details),
      },
    );
  }
}
