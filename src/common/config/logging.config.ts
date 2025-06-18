export interface LoggingConfig {
  level: 'error' | 'warn' | 'log' | 'debug' | 'verbose';
  enableRequestLogging: boolean;
  enableResponseLogging: boolean;
  enableCorrelationIds: boolean;
  enableAuditLogging: boolean;
  enableDatabaseLogging: boolean;
  enablePermissionLogging: boolean;
  logSensitiveData: boolean;
  externalLoggingService?: {
    enabled: boolean;
    endpoint?: string;
    apiKey?: string;
  };
}

export function getLoggingConfig(): LoggingConfig {
  const env = process.env.NODE_ENV || 'development';

  // Base configuration
  const baseConfig: LoggingConfig = {
    level: 'log',
    enableRequestLogging: true,
    enableResponseLogging: true,
    enableCorrelationIds: true,
    enableAuditLogging: true,
    enableDatabaseLogging: true,
    enablePermissionLogging: true,
    logSensitiveData: false,
  };

  // Environment-specific overrides
  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        level: 'debug',
        logSensitiveData: false, // Still keep this false even in dev
      };

    case 'test':
      return {
        ...baseConfig,
        level: 'warn',
        enableRequestLogging: false,
        enableResponseLogging: false,
        enableDatabaseLogging: false,
      };

    case 'production':
      return {
        ...baseConfig,
        level: 'log',
        logSensitiveData: false,
        externalLoggingService: {
          enabled: !!process.env.LOGGING_SERVICE_ENDPOINT,
          endpoint: process.env.LOGGING_SERVICE_ENDPOINT,
          apiKey: process.env.LOGGING_SERVICE_API_KEY,
        },
      };

    default:
      return baseConfig;
  }
}
