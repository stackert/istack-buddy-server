import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as path from 'path';

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
export class CustomLoggerService implements LoggerService {
  private logger: winston.Logger;
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

  constructor() {
    this.initializeLogger();
  }

  private context?: string;

  // Method to set context after instantiation
  setContext(context: string): void {
    this.context = context;
  }

  private initializeLogger(): void {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');

    // Define Winston transports
    const transports: winston.transport[] = [];

    // Console transport with colors for development
    if (isDevelopment && !isTest) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(
              ({ timestamp, level, message, context, ...meta }) => {
                const contextStr = context ? `[${context}]` : '';
                const metaStr = Object.keys(meta).length
                  ? ` ${JSON.stringify(meta)}`
                  : '';
                return `${timestamp} ${level} ${contextStr} ${message}${metaStr}`;
              },
            ),
          ),
        }),
      );
    }

    // File transport for clean logs (no color codes) - overwrite on each run
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'server.json'),
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
        options: { flags: 'w' }, // Overwrite file on each run
      }),
    );

    // Error file transport for errors only - overwrite on each run
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.json'),
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
        options: { flags: 'w' }, // Overwrite file on each run
      }),
    );

    // Create the Winston logger
    this.logger = winston.createLogger({
      level: logLevel,
      transports,
      exitOnError: false,
    });
  }

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

  // Winston logger methods - handle NestJS Logger interface
  log(message: any, context?: string | Record<string, any>, data?: any): void {
    let logContext = this.context || this.constructor.name;
    let logData = data;

    // Handle old NestJS Logger pattern: log(message, data)
    if (context && typeof context !== 'string') {
      logData = context;
    } else if (typeof context === 'string') {
      logContext = context;
    }

    const meta: any = { context: logContext };
    if (logData) {
      meta.data = this.sanitizeData(logData);
    }

    this.logger.info(message, meta);
  }

  error(context: string, message: string, error?: Error, data?: any): void {
    const logContext = context || this.context || this.constructor.name;
    const meta: any = { context: logContext };

    if (error) {
      meta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (data) {
      meta.data = this.sanitizeData(data);
    }

    this.logger.error(message, meta);
  }

  warn(message: any, context?: string | Record<string, any>, data?: any): void {
    let logContext = this.context || this.constructor.name;
    let logData = data;

    // Handle old NestJS Logger pattern: warn(message, data)
    if (context && typeof context !== 'string') {
      logData = context;
    } else if (typeof context === 'string') {
      logContext = context;
    }

    const meta: any = { context: logContext };
    if (logData) {
      meta.data = this.sanitizeData(logData);
    }

    this.logger.warn(message, meta);
  }

  debug(
    message: any,
    context?: string | Record<string, any>,
    data?: any,
  ): void {
    let logContext = this.context || this.constructor.name;
    let logData = data;

    // Handle old NestJS Logger pattern: debug(message, data)
    if (context && typeof context !== 'string') {
      logData = context;
    } else if (typeof context === 'string') {
      logContext = context;
    }

    const meta: any = { context: logContext };
    if (logData) {
      meta.data = this.sanitizeData(logData);
    }

    this.logger.debug(message, meta);
  }

  verbose(
    message: any,
    context?: string | Record<string, any>,
    data?: any,
  ): void {
    let logContext = this.context || this.constructor.name;
    let logData = data;

    // Handle old NestJS Logger pattern: verbose(message, data)
    if (context && typeof context !== 'string') {
      logData = context;
    } else if (typeof context === 'string') {
      logContext = context;
    }

    const meta: any = { context: logContext };
    if (logData) {
      meta.data = this.sanitizeData(logData);
    }

    this.logger.verbose(message, meta);
  }

  /**
   * Logs a message with structured context and data sanitization.
   *
   * This method provides context-aware logging with automatic data sanitization
   * to prevent sensitive information from being logged. It outputs structured
   * logs to both console (with colors) and file (clean format).
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

    const logMessage = logContext?.correlationId
      ? `[${logContext.correlationId}] ${message}`
      : message;

    const meta = {
      context,
      correlationId: logContext?.correlationId,
      userId: logContext?.userId,
      requestPath: logContext?.requestPath,
      method: logContext?.method,
      data: data ? this.sanitizeData(data) : undefined,
    };

    switch (level) {
      case 'log':
        this.logger.info(logMessage, meta);
        break;
      case 'error':
        this.logger.error(logMessage, meta);
        break;
      case 'warn':
        this.logger.warn(logMessage, meta);
        break;
      case 'debug':
        this.logger.debug(logMessage, meta);
        break;
      case 'verbose':
        this.logger.verbose(logMessage, meta);
        break;
    }
  }

  /**
   * Logs an error with structured context and full error details.
   *
   * This method specifically handles error logging with stack traces and
   * associated context data. It automatically sanitizes any provided data
   * and formats the error appropriately for both console and file output.
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

    const logMessage = logContext?.correlationId
      ? `[${logContext.correlationId}] ${message}`
      : message;

    const meta = {
      context,
      correlationId: logContext?.correlationId,
      userId: logContext?.userId,
      requestPath: logContext?.requestPath,
      method: logContext?.method,
      data: data ? this.sanitizeData(data) : undefined,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    };

    this.logger.error(logMessage, meta);
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
