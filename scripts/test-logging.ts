import { CustomLoggerService } from '../src/common/logger/custom-logger.service';

async function testLogging() {
  console.log('Testing dual logging system...\n');

  const logger = new CustomLoggerService();

  // Test basic logging methods
  logger.log('This is a basic log message', 'TestLogger');
  logger.warn('This is a warning message', 'TestLogger');
  logger.error('This is an error message', 'TestLogger');
  logger.debug('This is a debug message', 'TestLogger');
  logger.verbose('This is a verbose message', 'TestLogger');

  // Test structured logging
  logger.logWithContext(
    'log',
    'User authenticated successfully',
    'AuthService',
    {
      userId: 'user-123',
      correlationId: 'req-456',
      requestPath: '/auth/login',
      method: 'POST',
    },
    { permissions: ['read', 'write'], loginMethod: 'email' },
  );

  // Test error logging
  const testError = new Error('Database connection failed');
  logger.errorWithContext(
    'Database connection failed',
    testError,
    'DatabaseService.connect',
    { correlationId: 'req-789' },
    { connectionString: 'postgres://localhost:5432/test' },
  );

  // Test audit logging
  logger.auditLog(
    'USER_LOGIN',
    'success',
    'AuthController.login',
    { userId: 'user-123', correlationId: 'req-456' },
    { loginMethod: 'email', ipAddress: '192.168.1.1' },
  );

  // Test permission logging
  logger.permissionCheck(
    'user:profile:edit',
    true,
    'UserController.updateProfile',
    { userId: 'user-123', correlationId: 'req-456' },
    { targetUserId: 'user-123', sameUser: true },
  );

  // Test database operation logging
  logger.databaseOperation(
    'UPDATE',
    'user_profiles',
    'UserService.updateProfile',
    { userId: 'user-123', correlationId: 'req-456' },
    { fieldsUpdated: ['firstName', 'lastName'], recordId: 'profile-789' },
  );

  console.log('\nLogging test completed!');
  console.log('Check the console output for NestJS Logger messages.');
}

testLogging().catch(console.error);
