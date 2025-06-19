import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthenticationFailedException } from './exceptions/authentication-failed.exception';
import { Client, DatabaseError } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Mock pg module
jest.mock('pg');
jest.mock('fs');
jest.mock('path');

const MockedClient = Client as jest.MockedClass<typeof Client>;

describe('AuthService', () => {
  let service: AuthService;
  let logger: jest.Mocked<CustomLoggerService>;
  let mockClient: any;

  const mockConfig = {
    sessionTimeoutSeconds: 28800,
    sessionCleanupIntervalMinutes: 30,
  };

  const mockDbConfig = {
    development: {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass',
    },
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock fs.readFileSync
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('session-management.json')) {
        return JSON.stringify(mockConfig);
      }
      if (filePath.includes('database.json')) {
        return JSON.stringify(mockDbConfig);
      }
      throw new Error('File not found');
    });

    // Mock path.join
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Mock logger
    const mockLogger = {
      logWithContext: jest.fn(),
      auditLog: jest.fn(),
      error: jest.fn(),
      errorWithContext: jest.fn(),
    } as any;

    // Mock database client
    mockClient = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    };

    MockedClient.mockImplementation(() => mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    logger = module.get<CustomLoggerService>(
      CustomLoggerService,
    ) as jest.Mocked<CustomLoggerService>;
  });

  describe('Configuration Loading', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load configuration from file', () => {
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('session-management.json'),
        'utf8',
      );
    });

    it('should use fallback configuration when file reading fails', () => {
      // Create a new service instance with failing file read
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      const fallbackService = new AuthService(logger);
      expect(fallbackService).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.loadConfiguration',
        'Failed to load session management configuration',
        expect.any(Error),
        expect.any(Object),
      );
    });
  });

  describe('authenticateUserByEmailAndPassword', () => {
    const validEmail = 'test@example.com';
    const validPassword = 'password123';
    const userId = 'user-123';

    beforeEach(() => {
      // Mock successful user lookup
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('user_profiles')) {
          return Promise.resolve({
            rows: [
              {
                user_id: userId,
                email: validEmail,
                password_hash: 'placeholder.hash.for.development',
              },
            ],
          });
        }
        if (query.includes('INSERT INTO user_authentication_sessions')) {
          return Promise.resolve({ rows: [{ id: 'session-123' }] });
        }
        if (query.includes('access_permission_assignments')) {
          return Promise.resolve({
            rows: [
              { permission_id: 'user:read' },
              { permission_id: 'user:write' },
            ],
          });
        }
        if (query.includes('user_permission_groups')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });
    });

    it('should authenticate user with valid credentials', async () => {
      const result = await service.authenticateUserByEmailAndPassword(
        validEmail,
        validPassword,
      );

      expect(result).toEqual({
        success: true,
        sessionId: 'session-123',
        userId,
        permissions: ['user:read', 'user:write'],
        message: 'Authentication successful',
        jwtToken: expect.stringMatching(/^jwt-\d+-[a-z0-9]+$/),
      });

      expect(logger.auditLog).toHaveBeenCalledWith(
        'EMAIL_AUTH_SUCCESS',
        'success',
        'AuthService.authenticateUserByEmailAndPassword',
        undefined,
        expect.objectContaining({
          email: validEmail,
          userId,
          sessionId: 'session-123',
          permissionCount: 2,
        }),
      );
    });

    it('should throw AuthenticationFailedException for missing email', async () => {
      await expect(
        service.authenticateUserByEmailAndPassword('', validPassword),
      ).rejects.toThrow(AuthenticationFailedException);

      expect(logger.auditLog).toHaveBeenCalledWith(
        'EMAIL_AUTH_FAILED',
        'failure',
        'AuthService.authenticateUserByEmailAndPassword',
        undefined,
        expect.objectContaining({
          error: 'Missing email or password',
        }),
      );
    });

    it('should throw AuthenticationFailedException for missing password', async () => {
      await expect(
        service.authenticateUserByEmailAndPassword(validEmail, ''),
      ).rejects.toThrow(AuthenticationFailedException);
    });

    it('should throw AuthenticationFailedException for invalid credentials', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await expect(
        service.authenticateUserByEmailAndPassword(validEmail, validPassword),
      ).rejects.toThrow(AuthenticationFailedException);

      expect(logger.auditLog).toHaveBeenCalledWith(
        'EMAIL_AUTH_FAILED',
        'failure',
        'AuthService.authenticateUserByEmailAndPassword',
        undefined,
        expect.objectContaining({
          email: validEmail,
          reason: 'invalid_credentials',
        }),
      );
    });
  });

  describe('authenticateUser', () => {
    const userId = 'user-123';
    const validToken = 'jwt-valid-token-12345';

    beforeEach(() => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('SELECT id FROM users')) {
          return Promise.resolve({ rows: [{ id: userId }] });
        }
        if (query.includes('INSERT INTO user_authentication_sessions')) {
          return Promise.resolve({ rows: [{ id: 'session-123' }] });
        }
        if (query.includes('access_permission_assignments')) {
          return Promise.resolve({
            rows: [{ permission_id: 'user:read' }],
          });
        }
        if (query.includes('user_permission_groups')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });
    });

    it('should authenticate user with valid token', async () => {
      const result = await service.authenticateUser(userId, validToken);

      expect(result).toEqual({
        success: true,
        sessionId: 'session-123',
        userId,
        permissions: ['user:read'],
        message: 'Authentication successful',
      });

      expect(logger.auditLog).toHaveBeenCalledWith(
        'SESSION_ACTIVATED',
        'success',
        'AuthService.authenticateUser',
        undefined,
        expect.objectContaining({
          userId,
          sessionId: 'session-123',
          permissionCount: 1,
        }),
      );
    });

    it('should throw AuthenticationFailedException for invalid token', async () => {
      const shortToken = '123';

      await expect(
        service.authenticateUser(userId, shortToken),
      ).rejects.toThrow(AuthenticationFailedException);

      expect(logger.auditLog).toHaveBeenCalledWith(
        'SESSION_ACTIVATION_FAILED',
        'failure',
        'AuthService.authenticateUser',
        undefined,
        expect.objectContaining({
          userId,
          error: 'Invalid JWT token format',
        }),
      );
    });

    it('should throw AuthenticationFailedException for non-existent user', async () => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('SELECT id FROM users')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        service.authenticateUser(userId, validToken),
      ).rejects.toThrow(AuthenticationFailedException);
    });
  });

  describe('isUserAuthenticated', () => {
    const userId = 'user-123';
    const validToken = 'jwt-valid-token-12345';

    it('should return true for valid active session', async () => {
      const recentTime = new Date();
      mockClient.query.mockResolvedValue({
        rows: [
          {
            id: 'session-123',
            user_id: userId,
            jwt_token: validToken,
            last_access_time: recentTime.toISOString(),
          },
        ],
      });

      const result = await service.isUserAuthenticated(userId, validToken);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_authentication_sessions'),
        ['session-123'],
      );
    });

    it('should return false for non-existent session', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await service.isUserAuthenticated(userId, validToken);

      expect(result).toBe(false);
    });

    it('should return false and remove expired session', async () => {
      const expiredTime = new Date(Date.now() - 30000000); // Very old time
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('SELECT *')) {
          return Promise.resolve({
            rows: [
              {
                id: 'session-123',
                user_id: userId,
                jwt_token: validToken,
                last_access_time: expiredTime.toISOString(),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.isUserAuthenticated(userId, validToken);

      expect(result).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM user_authentication_sessions WHERE id = $1',
        ['session-123'],
      );
      expect(logger.auditLog).toHaveBeenCalledWith(
        'SESSION_DEACTIVATED',
        'success',
        'AuthService.isUserAuthenticated',
        undefined,
        expect.objectContaining({
          userId,
          sessionId: 'session-123',
          reason: 'timeout',
        }),
      );
    });

    it('should return false on database error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await service.isUserAuthenticated(userId, validToken);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.findActiveSession',
        'Database query failed',
        expect.any(Error),
        expect.objectContaining({ userId }),
      );
    });
  });

  describe('getUserPermissionSet', () => {
    const userId = 'user-123';

    it('should return cached permissions if available', async () => {
      mockClient.query.mockResolvedValue({
        rows: [
          {
            user_permission_chain: JSON.stringify(['user:read', 'user:write']),
            group_permission_chain: JSON.stringify(['group:admin']),
          },
        ],
      });

      const result = await service.getUserPermissionSet(userId);

      expect(result).toEqual(['user:read', 'user:write', 'group:admin']);
    });

    it('should fetch from database if no cache available', async () => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('user_permission_chain')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('access_permission_assignments_user')) {
          return Promise.resolve({
            rows: [{ permission_id: 'user:read' }],
          });
        }
        if (query.includes('access_permission_assignments_group')) {
          return Promise.resolve({
            rows: [{ permission_id: 'group:admin' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.getUserPermissionSet(userId);

      expect(result).toEqual(['user:read', 'group:admin']);
    });

    it('should return empty array on error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await service.getUserPermissionSet(userId);

      expect(result).toEqual([]);
      // The error gets logged in the helper methods, not the main method
      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.getCachedPermissions',
        'Failed to get cached permissions',
        expect.any(Error),
        expect.objectContaining({ userId }),
      );
    });
  });

  describe('getSessionByToken', () => {
    const jwtToken = 'jwt-valid-token-12345';
    const userId = 'user-123';
    const sessionId = 'session-123';

    it('should return session info for valid token', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ user_id: userId, session_id: sessionId }],
      });

      const result = await service.getSessionByToken(jwtToken);

      expect(result).toEqual({ userId, sessionId });
    });

    it('should return null for non-existent token', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await service.getSessionByToken(jwtToken);

      expect(result).toBeNull();
    });

    it('should return null on non-database errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Network error'));

      const result = await service.getSessionByToken(jwtToken);

      expect(result).toBeNull();
    });

    it('should correctly re-throw DatabaseError exceptions', async () => {
      const jwtToken = 'jwt-token-database';

      // Create a DatabaseError to test the re-throw path
      const dbError = new Error('Database connection failed');
      dbError.name = 'DatabaseError';
      // Make it an instance of DatabaseError
      Object.setPrototypeOf(dbError, DatabaseError.prototype);

      mockClient.query.mockRejectedValue(dbError);

      await expect(service.getSessionByToken(jwtToken)).rejects.toThrow(
        dbError,
      );

      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.getSessionByToken',
        'Database query failed',
        dbError,
        { tokenLength: jwtToken.length },
      );

      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.getSessionByToken',
        'FATAL: Database error during session lookup - re-throwing',
        dbError,
        { jwtToken: jwtToken.substring(0, 10) + '...', fatal: true },
      );
    });
  });

  describe('getUserProfileById', () => {
    const userId = 'user-123';
    const mockProfile = {
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      account_type_informal: 'STUDENT',
      current_account_status: 'ACTIVE',
      is_email_verified: true,
    };

    it('should return user profile for valid user ID', async () => {
      mockClient.query.mockResolvedValue({ rows: [mockProfile] });

      const result = await service.getUserProfileById(userId);

      expect(result).toEqual(mockProfile);
    });

    it('should return null for non-existent user', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await service.getUserProfileById(userId);

      expect(result).toBeNull();
    });

    it('should return null on non-database errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Network error'));

      const result = await service.getUserProfileById(userId);

      expect(result).toBeNull();
    });

    it('should correctly re-throw DatabaseError exceptions', async () => {
      const userId = 'user-database-error';

      // Create a DatabaseError to test the re-throw path
      const dbError = new Error('Database schema corruption detected');
      dbError.name = 'DatabaseError';
      // Make it an instance of DatabaseError
      Object.setPrototypeOf(dbError, DatabaseError.prototype);

      mockClient.query.mockRejectedValue(dbError);

      await expect(service.getUserProfileById(userId)).rejects.toThrow(dbError);

      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.getUserProfileById',
        'Database query failed',
        dbError,
        { userId },
      );

      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.getUserProfileById',
        'FATAL: Database error during profile lookup - re-throwing',
        dbError,
        { userId, fatal: true },
      );
    });
  });

  describe('Database Connection Errors', () => {
    it('should handle database connection failures in ensureDatabaseConnection', async () => {
      const connectionError = new Error('Failed to connect to database');
      mockClient.connect.mockRejectedValue(connectionError);

      // Try to trigger a database operation that would call ensureDatabaseConnection
      await expect(
        service.authenticateUserByEmailAndPassword(
          'test@example.com',
          'password',
        ),
      ).rejects.toThrow(connectionError);

      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.ensureDatabaseConnection',
        'Failed to initialize database connection',
        connectionError,
      );
    });
  });

  describe('Error Re-throwing Scenarios', () => {
    it('should re-throw unexpected errors in authenticateUserByEmailAndPassword', async () => {
      const unexpectedError = new Error('Unexpected system error');

      // Mock a scenario where validateUserCredentials throws an unexpected error
      mockClient.query.mockRejectedValue(unexpectedError);

      await expect(
        service.authenticateUserByEmailAndPassword(
          'test@example.com',
          'password',
        ),
      ).rejects.toThrow(unexpectedError);

      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.authenticateUserByEmailAndPassword',
        'Unexpected error during authentication - re-throwing',
        unexpectedError,
        expect.objectContaining({ email: 'test@example.com' }),
      );
    });

    it('should re-throw unexpected errors in authenticateUser', async () => {
      const unexpectedError = new Error('Unexpected authentication error');

      // Mock verifyUserExists to succeed, then make createOrUpdateSession fail
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }] }) // verifyUserExists succeeds
        .mockRejectedValueOnce(unexpectedError); // createOrUpdateSession fails

      await expect(
        service.authenticateUser('user-123', 'jwt-valid-token-12345'),
      ).rejects.toThrow(unexpectedError);

      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.authenticateUser',
        'Unexpected error during JWT authentication - re-throwing',
        unexpectedError,
        expect.objectContaining({ userId: 'user-123' }),
      );
    });
  });

  describe('Password Verification Edge Cases', () => {
    it('should handle placeholder development passwords', async () => {
      mockClient.query.mockResolvedValue({
        rows: [
          {
            user_id: 'user-123',
            email: 'test@example.com',
            password_hash: 'placeholder.hash.for.development',
          },
        ],
      });

      const result = await service.authenticateUserByEmailAndPassword(
        'test@example.com',
        'any-password',
      );

      expect(result.success).toBe(true);
    });

    it('should handle exact password matches for non-placeholder hashes', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-123',
              email: 'test@example.com',
              password_hash: 'exact-match-required',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.authenticateUserByEmailAndPassword(
        'test@example.com',
        'exact-match-required',
      );

      expect(result.success).toBe(true);
    });

    it('should reject wrong password for non-placeholder hashes', async () => {
      mockClient.query.mockResolvedValue({
        rows: [
          {
            user_id: 'user-123',
            email: 'test@example.com',
            password_hash: 'real-hash-value',
          },
        ],
      });

      await expect(
        service.authenticateUserByEmailAndPassword(
          'test@example.com',
          'wrong-password',
        ),
      ).rejects.toThrow(AuthenticationFailedException);
    });
  });

  describe('Session Management Edge Cases', () => {
    it('should handle existing session updates in createOrUpdateSession', async () => {
      const userId = 'user-123';
      const jwtToken = 'jwt-existing-token';

      // Mock finding existing session first, then updating it
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: userId }] }) // verifyUserExists
        .mockResolvedValueOnce({ rows: [{ id: 'existing-session-456' }] }) // find existing session
        .mockResolvedValueOnce({ rows: [] }) // update session
        .mockResolvedValueOnce({ rows: [] }) // permissions query 1
        .mockResolvedValueOnce({ rows: [] }) // permissions query 2
        .mockResolvedValueOnce({ rows: [] }); // group memberships

      const result = await service.authenticateUser(userId, jwtToken);

      expect(result.sessionId).toBe('existing-session-456');
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE user_authentication_sessions SET last_access_time = NOW(), updated_at = NOW() WHERE id = $1',
        ['existing-session-456'],
      );
    });

    it('should handle session access updates correctly', async () => {
      const userId = 'user-123';
      const jwtToken = 'jwt-token-456';
      const recentTime = new Date();

      mockClient.query.mockResolvedValue({
        rows: [
          {
            id: 'session-123',
            user_id: userId,
            jwt_token: jwtToken,
            last_access_time: recentTime.toISOString(),
          },
        ],
      });

      const result = await service.isUserAuthenticated(userId, jwtToken);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE user_authentication_sessions SET last_access_time = NOW(), updated_at = NOW() WHERE id = $1',
        ['session-123'],
      );
    });
  });

  describe('Permission Caching Edge Cases', () => {
    it('should handle permission caching errors gracefully', async () => {
      const userId = 'user-123';
      const jwtToken = 'jwt-token-789';

      // Mock successful user verification and session creation, but permission caching fails
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: userId }] }) // verifyUserExists
        .mockResolvedValueOnce({ rows: [] }) // no existing session
        .mockResolvedValueOnce({ rows: [{ id: 'new-session-789' }] }) // create new session
        .mockRejectedValueOnce(new Error('Permission query failed')); // cacheUserPermissions fails

      const result = await service.authenticateUser(userId, jwtToken);

      // The service should still succeed but with empty permissions
      expect(result.success).toBe(true);
      expect(result.permissions).toEqual([]);
      expect(result.sessionId).toBe('new-session-789');
    });

    it('should return empty permissions on database errors in getUserPermissionSet', async () => {
      const userId = 'user-123';
      mockClient.query.mockRejectedValue(new Error('Database connection lost'));

      const result = await service.getUserPermissionSet(userId);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.getCachedPermissions',
        'Failed to get cached permissions',
        expect.any(Error),
        expect.objectContaining({ userId }),
      );
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should reject empty tokens', async () => {
      await expect(service.authenticateUser('user-123', '')).rejects.toThrow(
        AuthenticationFailedException,
      );
    });

    it('should reject very short tokens', async () => {
      await expect(service.authenticateUser('user-123', '123')).rejects.toThrow(
        AuthenticationFailedException,
      );
    });

    it('should accept tokens exactly at the minimum length', async () => {
      const userId = 'user-123';
      const minimumToken = '12345678901'; // 11 characters (> 10)

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: userId }] }) // verifyUserExists
        .mockResolvedValueOnce({ rows: [] }) // no existing session
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // create session
        .mockResolvedValueOnce({ rows: [] }) // permissions
        .mockResolvedValueOnce({ rows: [] }) // group permissions
        .mockResolvedValueOnce({ rows: [] }) // group memberships
        .mockResolvedValueOnce({ rows: [] }); // update session with permissions

      const result = await service.authenticateUser(userId, minimumToken);

      expect(result.success).toBe(true);
    });
  });

  describe('Database Query Error Handling', () => {
    it('should handle verifyUserExists database errors', async () => {
      const userId = 'user-123';
      const jwtToken = 'jwt-valid-token-12345';

      mockClient.query.mockRejectedValue(new Error('Database query failed'));

      await expect(service.authenticateUser(userId, jwtToken)).rejects.toThrow(
        AuthenticationFailedException,
      );

      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.verifyUserExists',
        'Database query failed',
        expect.any(Error),
        expect.objectContaining({ userId }),
      );
    });

    it('should handle findActiveSession database errors', async () => {
      const userId = 'user-123';
      const jwtToken = 'jwt-token-456';

      mockClient.query.mockRejectedValue(new Error('Connection timeout'));

      const result = await service.isUserAuthenticated(userId, jwtToken);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.findActiveSession',
        'Database query failed',
        expect.any(Error),
        expect.objectContaining({ userId }),
      );
    });

    it('should handle removeExpiredSession database errors gracefully', async () => {
      const userId = 'user-123';
      const jwtToken = 'jwt-token-456';
      const expiredTime = new Date(Date.now() - 30000000);

      // Mock finding expired session, then error on removal
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'expired-session-123',
              user_id: userId,
              jwt_token: jwtToken,
              last_access_time: expiredTime.toISOString(),
            },
          ],
        })
        .mockRejectedValueOnce(new Error('Failed to delete session'));

      const result = await service.isUserAuthenticated(userId, jwtToken);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.removeExpiredSession',
        'Failed to remove expired session',
        expect.any(Error),
        expect.objectContaining({ sessionId: 'expired-session-123' }),
      );
    });

    it('should handle updateSessionAccess database errors gracefully', async () => {
      const userId = 'user-123';
      const jwtToken = 'jwt-token-456';
      const recentTime = new Date();

      // Mock finding valid session, then error on access update
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'valid-session-123',
              user_id: userId,
              jwt_token: jwtToken,
              last_access_time: recentTime.toISOString(),
            },
          ],
        })
        .mockRejectedValueOnce(new Error('Failed to update access time'));

      const result = await service.isUserAuthenticated(userId, jwtToken);

      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        'AuthService.updateSessionAccess',
        'Failed to update session access time',
        expect.any(Error),
        expect.objectContaining({ sessionId: 'valid-session-123' }),
      );
    });
  });

  describe('Missing Catch Block Coverage - Generic Error Handling', () => {
    describe('isUserAuthenticated catch block (lines 419-425) - PROBLEMATIC', () => {
      it('should expose problematic generic error handling - catches ALL errors without re-throwing', async () => {
        const userId = 'user-123';
        const jwtToken = 'jwt-token-456';

        // Force a generic error that should NOT be caught
        const spy = jest
          .spyOn(service as any, 'findActiveSession')
          .mockImplementation(() => {
            throw new Error('Unexpected critical system error');
          });

        const result = await service.isUserAuthenticated(userId, jwtToken);

        // This demonstrates the problem: critical errors are being swallowed!
        expect(result).toBe(false); // Should have thrown!
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.isUserAuthenticated',
          'Session validation failed',
          expect.any(Error),
          expect.objectContaining({ userId, tokenLength: jwtToken.length }),
        );

        spy.mockRestore();
      });

      it('should demonstrate error swallowing on memory errors', async () => {
        const userId = 'user-123';
        const jwtToken = 'jwt-token-456';

        const spy = jest
          .spyOn(service as any, 'findActiveSession')
          .mockImplementation(() => {
            throw new Error('Out of memory');
          });

        const result = await service.isUserAuthenticated(userId, jwtToken);

        // Memory errors should be fatal but are being swallowed!
        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.isUserAuthenticated',
          'Session validation failed',
          expect.any(Error),
          expect.objectContaining({ userId, tokenLength: jwtToken.length }),
        );

        spy.mockRestore();
      });
    });

    describe('getUserPermissionSet catch block (lines 489-495) - PROBLEMATIC', () => {
      it('should expose problematic generic error handling in permission retrieval', async () => {
        const userId = 'user-123';

        // Force a generic error that should NOT be caught
        const spy = jest
          .spyOn(service as any, 'getCachedPermissions')
          .mockImplementation(() => {
            throw new Error('Critical database connection lost');
          });

        const result = await service.getUserPermissionSet(userId);

        // This demonstrates the problem: database connection errors are being swallowed!
        expect(result).toEqual([]); // Should have thrown!
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getUserPermissionSet',
          'Failed to retrieve user permissions',
          expect.any(Error),
          expect.objectContaining({ userId }),
        );

        spy.mockRestore();
      });

      it('should demonstrate filesystem errors being swallowed', async () => {
        const userId = 'user-123';

        const spy = jest
          .spyOn(service as any, 'getCachedPermissions')
          .mockImplementation(() => {
            throw new Error('ENOSPC: no space left on device');
          });

        const result = await service.getUserPermissionSet(userId);

        // Filesystem errors should be fatal but are being swallowed!
        expect(result).toEqual([]);
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getUserPermissionSet',
          'Failed to retrieve user permissions',
          expect.any(Error),
          expect.objectContaining({ userId }),
        );

        spy.mockRestore();
      });
    });

    describe('cacheUserPermissions catch block (lines 731-737) - PROBLEMATIC', () => {
      it('should expose problematic generic error handling in permission caching', async () => {
        const userId = 'user-123';
        const sessionId = 'session-123';

        // Force a generic error that should NOT be caught
        const spy = jest
          .spyOn(service as any, 'fetchUserPermissionsFromDatabase')
          .mockImplementation(() => {
            throw new Error('Network interface down');
          });

        const result = await (service as any).cacheUserPermissions(
          userId,
          sessionId,
        );

        // This demonstrates the problem: network errors are being swallowed!
        expect(result).toEqual([]); // Should have thrown!
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.cacheUserPermissions',
          'Failed to cache permissions',
          expect.any(Error),
          expect.objectContaining({ userId, sessionId }),
        );

        spy.mockRestore();
      });

      it('should demonstrate authentication system errors being swallowed', async () => {
        const userId = 'user-123';
        const sessionId = 'session-123';

        const spy = jest
          .spyOn(service as any, 'fetchUserPermissionsFromDatabase')
          .mockImplementation(() => {
            throw new Error('Authentication service unavailable');
          });

        const result = await (service as any).cacheUserPermissions(
          userId,
          sessionId,
        );

        // Authentication service errors should be fatal but are being swallowed!
        expect(result).toEqual([]);
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.cacheUserPermissions',
          'Failed to cache permissions',
          expect.any(Error),
          expect.objectContaining({ userId, sessionId }),
        );

        spy.mockRestore();
      });
    });

    describe('getSessionByToken catch block (line 544) - ERROR SWALLOWING', () => {
      it('should expose error swallowing for non-DatabaseError exceptions', async () => {
        const jwtToken = 'jwt-token-123';

        // Mock a critical system error that should NOT be swallowed
        mockClient.query.mockRejectedValue(
          new Error('Critical system failure - CPU overheating'),
        );

        const result = await service.getSessionByToken(jwtToken);

        // This demonstrates the problem: critical errors are being swallowed!
        expect(result).toBeNull(); // Should have thrown!
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getSessionByToken',
          'Database query failed',
          expect.any(Error),
          { tokenLength: jwtToken.length },
        );
      });

      it('should expose error swallowing for memory/disk errors', async () => {
        const jwtToken = 'jwt-token-456';

        // Mock a memory error that should cause application shutdown
        mockClient.query.mockRejectedValue(new Error('ENOMEM: Out of memory'));

        const result = await service.getSessionByToken(jwtToken);

        // Memory errors should be fatal but are being swallowed!
        expect(result).toBeNull();
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getSessionByToken',
          'Database query failed',
          expect.any(Error),
          { tokenLength: jwtToken.length },
        );
      });

      it('should expose error swallowing for network/authentication service failures', async () => {
        const jwtToken = 'jwt-token-789';

        // Mock a network error that should cause graceful degradation or shutdown
        mockClient.query.mockRejectedValue(
          new Error('Network unreachable - authentication service down'),
        );

        const result = await service.getSessionByToken(jwtToken);

        // Service failures should be escalated but are being swallowed!
        expect(result).toBeNull();
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getSessionByToken',
          'Database query failed',
          expect.any(Error),
          { tokenLength: jwtToken.length },
        );
      });

      it('should correctly re-throw DatabaseError exceptions', async () => {
        const jwtToken = 'jwt-token-database';

        // Create a DatabaseError to test the re-throw path
        const dbError = new Error('Database connection failed');
        dbError.name = 'DatabaseError';
        // Make it an instance of DatabaseError
        Object.setPrototypeOf(dbError, DatabaseError.prototype);

        mockClient.query.mockRejectedValue(dbError);

        await expect(service.getSessionByToken(jwtToken)).rejects.toThrow(
          dbError,
        );

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getSessionByToken',
          'Database query failed',
          dbError,
          { tokenLength: jwtToken.length },
        );

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getSessionByToken',
          'FATAL: Database error during session lookup - re-throwing',
          dbError,
          { jwtToken: jwtToken.substring(0, 10) + '...', fatal: true },
        );
      });
    });

    describe('getUserProfileById catch block (line 615) - ERROR SWALLOWING', () => {
      it('should expose error swallowing for critical system errors', async () => {
        const userId = 'user-123';

        // Mock a critical error that should NOT be swallowed
        mockClient.query.mockRejectedValue(
          new Error('Kernel panic - system unstable'),
        );

        const result = await service.getUserProfileById(userId);

        // This demonstrates the problem: kernel errors are being swallowed!
        expect(result).toBeNull(); // Should have thrown!
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getUserProfileById',
          'Database query failed',
          expect.any(Error),
          { userId },
        );
      });

      it('should expose error swallowing for filesystem corruption', async () => {
        const userId = 'user-456';

        // Mock a filesystem error that should cause immediate shutdown
        mockClient.query.mockRejectedValue(
          new Error('EIO: I/O error - disk corruption detected'),
        );

        const result = await service.getUserProfileById(userId);

        // Filesystem corruption should be fatal but is being swallowed!
        expect(result).toBeNull();
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getUserProfileById',
          'Database query failed',
          expect.any(Error),
          { userId },
        );
      });

      it('should expose error swallowing for security breaches', async () => {
        const userId = 'user-789';

        // Mock a security error that should trigger immediate alerts
        mockClient.query.mockRejectedValue(
          new Error('SECURITY BREACH: Unauthorized database access detected'),
        );

        const result = await service.getUserProfileById(userId);

        // Security breaches should escalate immediately but are being swallowed!
        expect(result).toBeNull();
        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getUserProfileById',
          'Database query failed',
          expect.any(Error),
          { userId },
        );
      });

      it('should correctly re-throw DatabaseError exceptions', async () => {
        const userId = 'user-database-error';

        // Create a DatabaseError to test the re-throw path
        const dbError = new Error('Database schema corruption detected');
        dbError.name = 'DatabaseError';
        // Make it an instance of DatabaseError
        Object.setPrototypeOf(dbError, DatabaseError.prototype);

        mockClient.query.mockRejectedValue(dbError);

        await expect(service.getUserProfileById(userId)).rejects.toThrow(
          dbError,
        );

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getUserProfileById',
          'Database query failed',
          dbError,
          { userId },
        );

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.getUserProfileById',
          'FATAL: Database error during profile lookup - re-throwing',
          dbError,
          { userId, fatal: true },
        );
      });
    });

    describe('validateUserCredentials catch block (line 954) - ERROR SWALLOWING', () => {
      it('should expose error swallowing for non-DatabaseError exceptions', async () => {
        const email = 'test@example.com';
        const password = 'password123';

        // Mock a critical error that should NOT be swallowed
        mockClient.query.mockRejectedValue(
          new Error('Hardware failure - RAID array corrupted'),
        );

        await expect(
          (service as any).validateUserCredentials(email, password),
        ).rejects.toThrow('Hardware failure - RAID array corrupted');

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.validateUserCredentials',
          'Database query failed',
          expect.any(Error),
          { email },
        );
      });

      it('should expose incomplete error handling for authentication service errors', async () => {
        const email = 'test@example.com';
        const password = 'password123';

        // Mock an authentication service error
        mockClient.query.mockRejectedValue(
          new Error('Authentication backend service unavailable'),
        );

        await expect(
          (service as any).validateUserCredentials(email, password),
        ).rejects.toThrow('Authentication backend service unavailable');

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.validateUserCredentials',
          'Database query failed',
          expect.any(Error),
          { email },
        );
      });

      it('should demonstrate incomplete error categorization logic', async () => {
        const email = 'test@example.com';
        const password = 'password123';

        // Mock a scenario where DatabaseError check has incomplete logic
        const customError = new Error('Connection timeout');
        customError.name = 'TimeoutError'; // Not a DatabaseError

        mockClient.query.mockRejectedValue(customError);

        await expect(
          (service as any).validateUserCredentials(email, password),
        ).rejects.toThrow('Connection timeout');

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.validateUserCredentials',
          'Database query failed',
          expect.any(Error),
          { email },
        );

        // Should have logged the DatabaseError check failure too but doesn't
        expect(logger.error).not.toHaveBeenCalledWith(
          'AuthService.validateUserCredentials',
          'FATAL: Database error during credential validation - re-throwing',
          expect.any(Error),
          expect.objectContaining({ email, fatal: true }),
        );
      });

      it('should correctly handle DatabaseError re-throwing', async () => {
        const email = 'database@example.com';
        const password = 'password123';

        // Create a DatabaseError to test the re-throw path
        const dbError = new Error('Database connection pool exhausted');
        dbError.name = 'DatabaseError';
        // Make it an instance of DatabaseError
        Object.setPrototypeOf(dbError, DatabaseError.prototype);

        mockClient.query.mockRejectedValue(dbError);

        await expect(
          (service as any).validateUserCredentials(email, password),
        ).rejects.toThrow(dbError);

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.validateUserCredentials',
          'Database query failed',
          dbError,
          { email },
        );

        expect(logger.error).toHaveBeenCalledWith(
          'AuthService.validateUserCredentials',
          'FATAL: Database error during credential validation - re-throwing',
          dbError,
          { email, fatal: true },
        );
      });
    });
  });
});
