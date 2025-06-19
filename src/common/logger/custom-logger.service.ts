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

  /**
   * Logs a message with structured context and data sanitization.
   *
   * This method provides context-aware logging with automatic data sanitization
   * to prevent sensitive information from being logged. In production, it outputs
   * structured JSON logs, while in development it uses NestJS's formatted output.
   *
   * @param level - The log level (log, error, warn, debug, verbose)
   * @param message - The main log message
   * @param context - The context/source of the log (typically class name)
   * @param logContext - Optional context with user, request, and correlation data
   * @param data - Optional additional data to log (will be sanitized)
   *
   * @example
   * ```typescript
   * logger.logWithContext(
   *   'log',
   *   'User authenticated successfully',
   *   'AuthService',
   *   { userId: 'user-123', correlationId: 'req-456' },
   *   { permissions: ['read', 'write'] }
   * );
   * ```
   */
  public logWithContext(
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

  /**
   * Logs an error with structured context and full error details.
   *
   * This method specifically handles error logging with stack traces and
   * associated context data. It automatically sanitizes any provided data
   * and formats the error appropriately for both development and production.
   *
   * @param message - Descriptive message about the error context
   * @param error - The Error object to log with stack trace
   * @param context - The context/source of the error (typically class.method)
   * @param logContext - Optional context with user, request, and correlation data
   * @param data - Optional additional data related to the error (will be sanitized)
   *
   * @example
   * ```typescript
   * logger.errorWithContext(
   *   'Database connection failed',
   *   dbError,
   *   'DatabaseService.connect',
   *   { correlationId: 'req-123' },
   *   { connectionString: 'postgres://...' }
   * );
   * ```
   */
  public errorWithContext(
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

  /**
   * Logs security and audit events for compliance and monitoring.
   *
   * This method creates audit trail entries for security-sensitive operations
   * such as authentication, authorization, data access, and system changes.
   * All audit logs are automatically sanitized and structured for analysis.
   *
   * @param event - The type of audit event (e.g., 'USER_LOGIN', 'DATA_ACCESS')
   * @param result - Whether the audited operation succeeded or failed
   * @param context - The context/source of the audit event
   * @param logContext - Optional context with user, request, and correlation data
   * @param details - Optional additional details about the audited operation
   *
   * @example
   * ```typescript
   * logger.auditLog(
   *   'USER_LOGIN',
   *   'success',
   *   'AuthController.login',
   *   { userId: 'user-123', correlationId: 'req-456' },
   *   { loginMethod: 'email', ipAddress: '192.168.1.1' }
   * );
   * ```
   */
  public auditLog(
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

  /**
   * Logs permission check operations for security monitoring.
   *
   * This method tracks permission verification attempts, logging both
   * successful grants and denied access attempts. Useful for security
   * monitoring and debugging authorization issues.
   *
   * @param permission - The permission being checked (e.g., 'user:edit', 'admin:delete')
   * @param allowed - Whether the permission check succeeded
   * @param context - The context/source of the permission check
   * @param logContext - Optional context with user, request, and correlation data
   * @param conditions - Optional conditions or criteria used in the permission check
   *
   * @example
   * ```typescript
   * logger.permissionCheck(
   *   'user:profile:edit',
   *   true,
   *   'UserController.updateProfile',
   *   { userId: 'user-123', correlationId: 'req-456' },
   *   { targetUserId: 'user-123', sameUser: true }
   * );
   * ```
   */
  public permissionCheck(
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

  /**
   * Logs database operations for performance monitoring and debugging.
   *
   * This method tracks database operations including queries, inserts, updates,
   * and deletes. Useful for monitoring database performance, debugging issues,
   * and maintaining audit trails of data changes.
   *
   * @param operation - The type of database operation (e.g., 'SELECT', 'INSERT', 'UPDATE')
   * @param table - The database table being operated on
   * @param context - The context/source of the database operation
   * @param logContext - Optional context with user, request, and correlation data
   * @param details - Optional additional details about the operation (will be sanitized)
   *
   * @example
   * ```typescript
   * logger.databaseOperation(
   *   'UPDATE',
   *   'user_profiles',
   *   'UserService.updateProfile',
   *   { userId: 'user-123', correlationId: 'req-456' },
   *   { fieldsUpdated: ['firstName', 'lastName'], recordId: 'profile-789' }
   * );
   * ```
   */
  public databaseOperation(
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
