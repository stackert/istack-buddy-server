import { getLoggingConfig } from './logging.config';

describe('Logging Configuration', () => {
  let originalEnv: string | undefined;
  let originalLoggingEndpoint: string | undefined;
  let originalLoggingApiKey: string | undefined;

  beforeEach(() => {
    // Store original environment variables
    originalEnv = process.env.NODE_ENV;
    originalLoggingEndpoint = process.env.LOGGING_SERVICE_ENDPOINT;
    originalLoggingApiKey = process.env.LOGGING_SERVICE_API_KEY;
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    if (originalLoggingEndpoint !== undefined) {
      process.env.LOGGING_SERVICE_ENDPOINT = originalLoggingEndpoint;
    } else {
      delete process.env.LOGGING_SERVICE_ENDPOINT;
    }

    if (originalLoggingApiKey !== undefined) {
      process.env.LOGGING_SERVICE_API_KEY = originalLoggingApiKey;
    } else {
      delete process.env.LOGGING_SERVICE_API_KEY;
    }
  });

  describe('Function Availability', () => {
    it('should export getLoggingConfig function', () => {
      expect(typeof getLoggingConfig).toBe('function');
    });

    it('should return a configuration object', () => {
      const config = getLoggingConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });

  describe('Configuration Interface', () => {
    it('should have all required properties with correct types', () => {
      const config = getLoggingConfig();

      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('enableRequestLogging');
      expect(config).toHaveProperty('enableResponseLogging');
      expect(config).toHaveProperty('enableCorrelationIds');
      expect(config).toHaveProperty('enableAuditLogging');
      expect(config).toHaveProperty('enableDatabaseLogging');
      expect(config).toHaveProperty('enablePermissionLogging');
      expect(config).toHaveProperty('logSensitiveData');

      expect(typeof config.level).toBe('string');
      expect(typeof config.enableRequestLogging).toBe('boolean');
      expect(typeof config.enableResponseLogging).toBe('boolean');
      expect(typeof config.enableCorrelationIds).toBe('boolean');
      expect(typeof config.enableAuditLogging).toBe('boolean');
      expect(typeof config.enableDatabaseLogging).toBe('boolean');
      expect(typeof config.enablePermissionLogging).toBe('boolean');
      expect(typeof config.logSensitiveData).toBe('boolean');
    });

    it('should have valid log level', () => {
      const config = getLoggingConfig();
      const validLogLevels = ['error', 'warn', 'log', 'debug', 'verbose'];
      expect(validLogLevels).toContain(config.level);
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should use debug log level', () => {
      const config = getLoggingConfig();
      expect(config.level).toBe('debug');
    });

    it('should enable all logging features', () => {
      const config = getLoggingConfig();
      expect(config.enableRequestLogging).toBe(true);
      expect(config.enableResponseLogging).toBe(true);
      expect(config.enableCorrelationIds).toBe(true);
      expect(config.enableAuditLogging).toBe(true);
      expect(config.enableDatabaseLogging).toBe(true);
      expect(config.enablePermissionLogging).toBe(true);
    });

    it('should not log sensitive data', () => {
      const config = getLoggingConfig();
      expect(config.logSensitiveData).toBe(false);
    });

    it('should not have external logging service', () => {
      const config = getLoggingConfig();
      expect(config.externalLoggingService).toBeUndefined();
    });
  });

  describe('Test Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should use warn log level', () => {
      const config = getLoggingConfig();
      expect(config.level).toBe('warn');
    });

    it('should disable verbose logging for performance', () => {
      const config = getLoggingConfig();
      expect(config.enableRequestLogging).toBe(false);
      expect(config.enableResponseLogging).toBe(false);
      expect(config.enableDatabaseLogging).toBe(false);
    });

    it('should keep essential logging enabled', () => {
      const config = getLoggingConfig();
      expect(config.enableCorrelationIds).toBe(true);
      expect(config.enableAuditLogging).toBe(true);
      expect(config.enablePermissionLogging).toBe(true);
    });

    it('should not log sensitive data', () => {
      const config = getLoggingConfig();
      expect(config.logSensitiveData).toBe(false);
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should use log level', () => {
      const config = getLoggingConfig();
      expect(config.level).toBe('log');
    });

    it('should enable all logging features', () => {
      const config = getLoggingConfig();
      expect(config.enableRequestLogging).toBe(true);
      expect(config.enableResponseLogging).toBe(true);
      expect(config.enableCorrelationIds).toBe(true);
      expect(config.enableAuditLogging).toBe(true);
      expect(config.enableDatabaseLogging).toBe(true);
      expect(config.enablePermissionLogging).toBe(true);
    });

    it('should not log sensitive data', () => {
      const config = getLoggingConfig();
      expect(config.logSensitiveData).toBe(false);
    });

    it('should include external logging service configuration', () => {
      const config = getLoggingConfig();
      expect(config.externalLoggingService).toBeDefined();
      expect(config.externalLoggingService).toHaveProperty('enabled');
      expect(config.externalLoggingService).toHaveProperty('endpoint');
      expect(config.externalLoggingService).toHaveProperty('apiKey');
    });

    it('should enable external logging when endpoint is provided', () => {
      process.env.LOGGING_SERVICE_ENDPOINT = 'https://logs.example.com';
      process.env.LOGGING_SERVICE_API_KEY = 'test-key';

      const config = getLoggingConfig();
      expect(config.externalLoggingService!.enabled).toBe(true);
      expect(config.externalLoggingService!.endpoint).toBe(
        'https://logs.example.com',
      );
      expect(config.externalLoggingService!.apiKey).toBe('test-key');
    });

    it('should disable external logging when endpoint is not provided', () => {
      delete process.env.LOGGING_SERVICE_ENDPOINT;

      const config = getLoggingConfig();
      expect(config.externalLoggingService!.enabled).toBe(false);
    });

    it('should handle empty endpoint', () => {
      process.env.LOGGING_SERVICE_ENDPOINT = '';

      const config = getLoggingConfig();
      expect(config.externalLoggingService!.enabled).toBe(false);
    });
  });

  describe('Default/Unknown Environment', () => {
    it('should use base configuration for unknown environment', () => {
      process.env.NODE_ENV = 'staging';

      const config = getLoggingConfig();
      expect(config.level).toBe('log');
      expect(config.enableRequestLogging).toBe(true);
      expect(config.enableResponseLogging).toBe(true);
      expect(config.enableCorrelationIds).toBe(true);
      expect(config.enableAuditLogging).toBe(true);
      expect(config.enableDatabaseLogging).toBe(true);
      expect(config.enablePermissionLogging).toBe(true);
      expect(config.logSensitiveData).toBe(false);
      expect(config.externalLoggingService).toBeUndefined();
    });

    it('should use base configuration when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;

      const config = getLoggingConfig();
      expect(config.level).toBe('debug'); // Defaults to 'development' when undefined
      expect(config.logSensitiveData).toBe(false);
    });
  });

  describe('Security Requirements', () => {
    it('should never enable sensitive data logging', () => {
      const environments = ['development', 'test', 'production', 'staging'];

      for (const env of environments) {
        process.env.NODE_ENV = env;
        const config = getLoggingConfig();
        expect(config.logSensitiveData).toBe(false);
      }
    });

    it('should always enable correlation IDs', () => {
      const environments = ['development', 'test', 'production', 'staging'];

      for (const env of environments) {
        process.env.NODE_ENV = env;
        const config = getLoggingConfig();
        expect(config.enableCorrelationIds).toBe(true);
      }
    });

    it('should always enable audit logging', () => {
      const environments = ['development', 'test', 'production', 'staging'];

      for (const env of environments) {
        process.env.NODE_ENV = env;
        const config = getLoggingConfig();
        expect(config.enableAuditLogging).toBe(true);
      }
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle various endpoint values correctly', () => {
      process.env.NODE_ENV = 'production';

      const testCases = [
        { endpoint: 'https://logs.service.com', expected: true },
        { endpoint: 'http://localhost:3000/logs', expected: true },
        { endpoint: '', expected: false }, // Empty string is falsy
        { endpoint: '0', expected: true }, // String '0' is truthy
        { endpoint: 'false', expected: true }, // String 'false' is truthy
      ];

      for (const testCase of testCases) {
        process.env.LOGGING_SERVICE_ENDPOINT = testCase.endpoint;
        const config = getLoggingConfig();
        expect(config.externalLoggingService!.enabled).toBe(testCase.expected);
      }
    });

    it('should preserve API key value regardless of enabled state', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOGGING_SERVICE_ENDPOINT = '';
      process.env.LOGGING_SERVICE_API_KEY = 'secret-key';

      const config = getLoggingConfig();
      expect(config.externalLoggingService!.enabled).toBe(false);
      expect(config.externalLoggingService!.apiKey).toBe('secret-key');
    });
  });

  describe('Configuration Immutability', () => {
    it('should return new objects on each call', () => {
      const config1 = getLoggingConfig();
      const config2 = getLoggingConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should not share references between calls', () => {
      process.env.NODE_ENV = 'development';

      const config1 = getLoggingConfig();
      const config2 = getLoggingConfig();

      config1.level = 'error';
      config1.enableRequestLogging = false;

      expect(config2.level).toBe('debug');
      expect(config2.enableRequestLogging).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle case sensitivity in environment names', () => {
      const variants = [
        'PRODUCTION',
        'Production',
        'DEVELOPMENT',
        'Development',
      ];

      for (const variant of variants) {
        process.env.NODE_ENV = variant;
        const config = getLoggingConfig();
        expect(config.level).toBe('log'); // Should fall back to default
      }
    });

    it('should handle special characters in external service config', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOGGING_SERVICE_ENDPOINT =
        'https://api.logs.co/v1?key=special&format=json';
      process.env.LOGGING_SERVICE_API_KEY = 'key-123_ABC!@#$%';

      const config = getLoggingConfig();
      expect(config.externalLoggingService!.enabled).toBe(true);
      expect(config.externalLoggingService!.endpoint).toBe(
        'https://api.logs.co/v1?key=special&format=json',
      );
      expect(config.externalLoggingService!.apiKey).toBe('key-123_ABC!@#$%');
    });

    it('should handle whitespace in environment variable', () => {
      process.env.NODE_ENV = ' production ';
      const config = getLoggingConfig();
      expect(config.level).toBe('log'); // Should fall back to default
    });
  });

  describe('Log Level Consistency', () => {
    it('should use correct log levels per environment', () => {
      const expectations = {
        development: 'debug',
        test: 'warn',
        production: 'log',
        other: 'log',
      };

      for (const [env, expectedLevel] of Object.entries(expectations)) {
        if (env === 'other') {
          process.env.NODE_ENV = 'unknown-environment';
        } else {
          process.env.NODE_ENV = env;
        }

        const config = getLoggingConfig();
        expect(config.level).toBe(expectedLevel);
      }
    });
  });

  describe('Performance Configuration', () => {
    it('should optimize for test performance', () => {
      process.env.NODE_ENV = 'test';
      const config = getLoggingConfig();

      // Performance optimizations for testing
      expect(config.enableRequestLogging).toBe(false);
      expect(config.enableResponseLogging).toBe(false);
      expect(config.enableDatabaseLogging).toBe(false);
      expect(config.level).toBe('warn'); // Less verbose
    });

    it('should enable full monitoring in production', () => {
      process.env.NODE_ENV = 'production';
      const config = getLoggingConfig();

      // Full monitoring in production
      expect(config.enableRequestLogging).toBe(true);
      expect(config.enableResponseLogging).toBe(true);
      expect(config.enableDatabaseLogging).toBe(true);
      expect(config.enableAuditLogging).toBe(true);
      expect(config.enablePermissionLogging).toBe(true);
    });
  });
});
