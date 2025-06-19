import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationUserService } from './authentication-user.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthService } from '../auth/auth.service';
import { DatabaseError } from 'pg';

describe('AuthenticationUserService', () => {
  let service: AuthenticationUserService;
  let authService: AuthService;
  let logger: CustomLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationUserService,
        {
          provide: CustomLoggerService,
          useValue: {
            logWithContext: jest.fn(),
            auditLog: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            authenticateUserByEmailAndPassword: jest.fn(),
            isUserAuthenticated: jest.fn(),
            getUserPermissionSet: jest.fn(),
            getSessionByToken: jest.fn(),
            getUserProfileById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthenticationUserService>(AuthenticationUserService);
    authService = module.get<AuthService>(AuthService);
    logger = module.get<CustomLoggerService>(CustomLoggerService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authenticateUser', () => {
    const validAuthRequest = {
      email: 'test@example.com',
      password: 'valid-password',
    };

    describe('Input Validation', () => {
      it('should throw UnauthorizedException when email is missing', async () => {
        const authRequest = { email: '', password: 'valid-password' };

        await expect(service.authenticateUser(authRequest)).rejects.toThrow(
          new UnauthorizedException('Missing email or password'),
        );

        expect(logger.logWithContext).toHaveBeenCalledWith(
          'log',
          'External user authentication request received',
          'AuthenticationUserService.authenticateUser',
          undefined,
          { email: '', hasPassword: true },
        );

        expect(logger.logWithContext).toHaveBeenCalledWith(
          'warn',
          'Authentication request missing required parameters',
          'AuthenticationUserService.authenticateUser',
          undefined,
          { hasEmail: false, hasPassword: true },
        );
      });

      it('should throw UnauthorizedException when password is missing', async () => {
        const authRequest = { email: 'test@example.com', password: '' };

        await expect(service.authenticateUser(authRequest)).rejects.toThrow(
          new UnauthorizedException('Missing email or password'),
        );

        expect(logger.logWithContext).toHaveBeenCalledWith(
          'warn',
          'Authentication request missing required parameters',
          'AuthenticationUserService.authenticateUser',
          undefined,
          { hasEmail: true, hasPassword: false },
        );
      });

      it('should throw UnauthorizedException when both email and password are missing', async () => {
        const authRequest = { email: '', password: '' };

        await expect(service.authenticateUser(authRequest)).rejects.toThrow(
          new UnauthorizedException('Missing email or password'),
        );

        expect(logger.logWithContext).toHaveBeenCalledWith(
          'warn',
          'Authentication request missing required parameters',
          'AuthenticationUserService.authenticateUser',
          undefined,
          { hasEmail: false, hasPassword: false },
        );
      });
    });

    describe('Successful Authentication', () => {
      it('should return user data when authentication is successful', async () => {
        const mockAuthResult = {
          success: true,
          userId: 'test-user-id',
          jwtToken: 'test-jwt-token',
          sessionId: 'session-123',
          permissions: ['test:permission'],
          message: 'Authentication successful',
        };

        (
          authService.authenticateUserByEmailAndPassword as jest.Mock
        ).mockResolvedValue(mockAuthResult);

        const result = await service.authenticateUser(validAuthRequest);

        expect(result).toEqual({
          success: true,
          userId: 'test-user-id',
          email: 'test@example.com',
          jwtToken: 'test-jwt-token',
          permissions: ['test:permission'],
          message: 'Authentication successful',
        });

        expect(logger.auditLog).toHaveBeenCalledWith(
          'EXTERNAL_AUTH_SUCCESS',
          'success',
          'AuthenticationUserService.authenticateUser',
          undefined,
          {
            email: 'test@example.com',
            userId: 'test-user-id',
            sessionId: 'session-123',
            permissionCount: 1,
          },
        );
      });

      it('should handle authentication with no permissions', async () => {
        const mockAuthResult = {
          success: true,
          userId: 'test-user-id',
          jwtToken: 'test-jwt-token',
          sessionId: 'session-123',
          permissions: null,
          message: 'Authentication successful',
        };

        (
          authService.authenticateUserByEmailAndPassword as jest.Mock
        ).mockResolvedValue(mockAuthResult);

        const result = await service.authenticateUser(validAuthRequest);

        expect(result).toEqual({
          success: true,
          userId: 'test-user-id',
          email: 'test@example.com',
          jwtToken: 'test-jwt-token',
          permissions: [],
          message: 'Authentication successful',
        });

        expect(logger.auditLog).toHaveBeenCalledWith(
          'EXTERNAL_AUTH_SUCCESS',
          'success',
          'AuthenticationUserService.authenticateUser',
          undefined,
          {
            email: 'test@example.com',
            userId: 'test-user-id',
            sessionId: 'session-123',
            permissionCount: 0,
          },
        );
      });

      it('should handle authentication with no message', async () => {
        const mockAuthResult = {
          success: true,
          userId: 'test-user-id',
          jwtToken: 'test-jwt-token',
          sessionId: 'session-123',
          permissions: ['test:permission'],
          message: null,
        };

        (
          authService.authenticateUserByEmailAndPassword as jest.Mock
        ).mockResolvedValue(mockAuthResult);

        const result = await service.authenticateUser(validAuthRequest);

        expect(result.message).toBe('Authentication successful');
      });
    });

    describe('Authentication Failures', () => {
      it('should throw UnauthorizedException when AuthService returns failure', async () => {
        const mockAuthResult = {
          success: false,
          message: 'Invalid credentials',
        };

        (
          authService.authenticateUserByEmailAndPassword as jest.Mock
        ).mockResolvedValue(mockAuthResult);

        await expect(
          service.authenticateUser(validAuthRequest),
        ).rejects.toThrow(new UnauthorizedException('Authentication failed'));

        expect(logger.auditLog).toHaveBeenCalledWith(
          'EXTERNAL_AUTH_FAILED',
          'failure',
          'AuthenticationUserService.authenticateUser',
          undefined,
          { email: 'test@example.com', reason: 'auth_service_failed' },
        );
      });
    });

    describe('Error Handling', () => {
      it('should re-throw UnauthorizedException as-is', async () => {
        const unauthorizedError = new UnauthorizedException(
          'Custom auth error',
        );

        (
          authService.authenticateUserByEmailAndPassword as jest.Mock
        ).mockRejectedValue(unauthorizedError);

        await expect(
          service.authenticateUser(validAuthRequest),
        ).rejects.toThrow(unauthorizedError);

        expect(logger.auditLog).toHaveBeenCalledWith(
          'EXTERNAL_AUTH_FAILED',
          'failure',
          'AuthenticationUserService.authenticateUser',
          undefined,
          {
            email: 'test@example.com',
            error: 'Custom auth error',
            errorType: 'UnauthorizedException',
          },
        );
      });

      it('should re-throw DatabaseError as fatal error', async () => {
        const dbError = new DatabaseError(
          'Database connection failed',
          1,
          'error',
        );

        (
          authService.authenticateUserByEmailAndPassword as jest.Mock
        ).mockRejectedValue(dbError);

        await expect(
          service.authenticateUser(validAuthRequest),
        ).rejects.toThrow(dbError);

        expect(logger.error).toHaveBeenCalledWith(
          'AuthenticationUserService.authenticateUser',
          'FATAL: Database error during external authentication - re-throwing',
          dbError,
          { email: 'test@example.com', fatal: true },
        );

        expect(logger.auditLog).toHaveBeenCalledWith(
          'EXTERNAL_AUTH_FAILED',
          'failure',
          'AuthenticationUserService.authenticateUser',
          undefined,
          {
            email: 'test@example.com',
            error: 'Database connection failed',
            errorType: 'DatabaseError',
          },
        );
      });

      it('should convert other errors to UnauthorizedException', async () => {
        const genericError = new Error('Network timeout');

        (
          authService.authenticateUserByEmailAndPassword as jest.Mock
        ).mockRejectedValue(genericError);

        await expect(
          service.authenticateUser(validAuthRequest),
        ).rejects.toThrow(new UnauthorizedException('Authentication failed'));

        expect(logger.auditLog).toHaveBeenCalledWith(
          'EXTERNAL_AUTH_FAILED',
          'failure',
          'AuthenticationUserService.authenticateUser',
          undefined,
          {
            email: 'test@example.com',
            error: 'Network timeout',
            errorType: 'Error',
          },
        );
      });

      it('should handle non-Error objects thrown', async () => {
        const stringError = 'String error';

        (
          authService.authenticateUserByEmailAndPassword as jest.Mock
        ).mockRejectedValue(stringError);

        await expect(
          service.authenticateUser(validAuthRequest),
        ).rejects.toThrow(new UnauthorizedException('Authentication failed'));

        expect(logger.auditLog).toHaveBeenCalledWith(
          'EXTERNAL_AUTH_FAILED',
          'failure',
          'AuthenticationUserService.authenticateUser',
          undefined,
          {
            email: 'test@example.com',
            error: 'Unknown error',
            errorType: 'String',
          },
        );
      });
    });
  });

  describe('getUserProfile', () => {
    const validToken = 'valid-jwt-token';
    const mockSessionInfo = {
      userId: 'test-user-id',
      sessionId: 'session-123',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };

    const mockUserProfile = {
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      account_type_informal: 'standard',
      current_account_status: 'active',
      last_login_at: new Date(),
      is_email_verified: true,
    };

    const mockPermissions = ['read:profile', 'write:data'];

    describe('Token Validation', () => {
      it('should throw UnauthorizedException when token is empty', async () => {
        await expect(service.getUserProfile('')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired authentication token'),
        );

        expect(authService.getSessionByToken).toHaveBeenCalledWith('');
      });

      it('should throw UnauthorizedException when session not found', async () => {
        (authService.getSessionByToken as jest.Mock).mockResolvedValue(null);

        await expect(service.getUserProfile(validToken)).rejects.toThrow(
          new UnauthorizedException('Invalid or expired authentication token'),
        );

        expect(logger.logWithContext).toHaveBeenCalledWith(
          'warn',
          'Invalid or expired authentication token',
          'AuthenticationUserService.getUserProfile',
          undefined,
          { tokenLength: validToken.length },
        );
      });

      it('should throw UnauthorizedException when session is expired', async () => {
        (authService.getSessionByToken as jest.Mock).mockResolvedValue(
          mockSessionInfo,
        );
        (authService.isUserAuthenticated as jest.Mock).mockResolvedValue(false);

        await expect(service.getUserProfile(validToken)).rejects.toThrow(
          new UnauthorizedException('Authentication token has expired'),
        );

        expect(logger.logWithContext).toHaveBeenCalledWith(
          'warn',
          'Authentication token has expired',
          'AuthenticationUserService.getUserProfile',
          undefined,
          { userId: mockSessionInfo.userId, tokenLength: validToken.length },
        );
      });

      it('should throw UnauthorizedException when user profile not found', async () => {
        (authService.getSessionByToken as jest.Mock).mockResolvedValue(
          mockSessionInfo,
        );
        (authService.isUserAuthenticated as jest.Mock).mockResolvedValue(true);
        (authService.getUserProfileById as jest.Mock).mockResolvedValue(null);

        await expect(service.getUserProfile(validToken)).rejects.toThrow(
          new UnauthorizedException('User profile not found'),
        );

        expect(logger.logWithContext).toHaveBeenCalledWith(
          'warn',
          'User profile not found',
          'AuthenticationUserService.getUserProfile',
          undefined,
          { userId: mockSessionInfo.userId },
        );
      });
    });

    describe('Successful Profile Retrieval', () => {
      beforeEach(() => {
        (authService.getSessionByToken as jest.Mock).mockResolvedValue(
          mockSessionInfo,
        );
        (authService.isUserAuthenticated as jest.Mock).mockResolvedValue(true);
        (authService.getUserProfileById as jest.Mock).mockResolvedValue(
          mockUserProfile,
        );
        (authService.getUserPermissionSet as jest.Mock).mockResolvedValue(
          mockPermissions,
        );
      });

      it('should return complete user profile with permissions', async () => {
        const result = await service.getUserProfile(validToken);

        expect(result).toEqual({
          success: true,
          userId: mockSessionInfo.userId,
          email: mockUserProfile.email,
          username: mockUserProfile.username,
          firstName: mockUserProfile.first_name,
          lastName: mockUserProfile.last_name,
          accountType: mockUserProfile.account_type_informal,
          accountStatus: mockUserProfile.current_account_status,
          permissions: mockPermissions,
          lastLogin: mockUserProfile.last_login_at,
          emailVerified: mockUserProfile.is_email_verified,
        });

        expect(logger.logWithContext).toHaveBeenCalledWith(
          'log',
          'User profile retrieved successfully',
          'AuthenticationUserService.getUserProfile',
          undefined,
          {
            userId: mockSessionInfo.userId,
            email: mockUserProfile.email,
            permissionCount: mockPermissions.length,
          },
        );
      });

      it('should handle empty permissions array', async () => {
        (authService.getUserPermissionSet as jest.Mock).mockResolvedValue([]);

        const result = await service.getUserProfile(validToken);

        expect(result.permissions).toEqual([]);
        expect(logger.logWithContext).toHaveBeenCalledWith(
          'log',
          'User profile retrieved successfully',
          'AuthenticationUserService.getUserProfile',
          undefined,
          {
            userId: mockSessionInfo.userId,
            email: mockUserProfile.email,
            permissionCount: 0,
          },
        );
      });
    });

    describe('Error Handling', () => {
      it('should re-throw UnauthorizedException as-is', async () => {
        const unauthorizedError = new UnauthorizedException(
          'Custom profile error',
        );

        (authService.getSessionByToken as jest.Mock).mockRejectedValue(
          unauthorizedError,
        );

        await expect(service.getUserProfile(validToken)).rejects.toThrow(
          unauthorizedError,
        );

        expect(logger.auditLog).toHaveBeenCalledWith(
          'PROFILE_ACCESS_FAILED',
          'failure',
          'AuthenticationUserService.getUserProfile',
          undefined,
          {
            tokenLength: validToken.length,
            error: 'Custom profile error',
            errorType: 'UnauthorizedException',
          },
        );
      });

      it('should convert other errors to UnauthorizedException', async () => {
        const genericError = new Error('Database connection failed');

        (authService.getSessionByToken as jest.Mock).mockRejectedValue(
          genericError,
        );

        await expect(service.getUserProfile(validToken)).rejects.toThrow(
          new UnauthorizedException('Failed to retrieve user profile'),
        );

        expect(logger.auditLog).toHaveBeenCalledWith(
          'PROFILE_ACCESS_FAILED',
          'failure',
          'AuthenticationUserService.getUserProfile',
          undefined,
          {
            tokenLength: validToken.length,
            error: 'Database connection failed',
            errorType: 'Error',
          },
        );
      });

      it('should handle non-Error objects thrown', async () => {
        const stringError = 'String error in profile';

        (authService.getSessionByToken as jest.Mock).mockRejectedValue(
          stringError,
        );

        await expect(service.getUserProfile(validToken)).rejects.toThrow(
          new UnauthorizedException('Failed to retrieve user profile'),
        );

        expect(logger.auditLog).toHaveBeenCalledWith(
          'PROFILE_ACCESS_FAILED',
          'failure',
          'AuthenticationUserService.getUserProfile',
          undefined,
          {
            tokenLength: validToken.length,
            error: 'Unknown error',
            errorType: 'String',
          },
        );
      });
    });

    describe('Service Integration', () => {
      it('should call all required AuthService methods in correct order', async () => {
        (authService.getSessionByToken as jest.Mock).mockResolvedValue(
          mockSessionInfo,
        );
        (authService.isUserAuthenticated as jest.Mock).mockResolvedValue(true);
        (authService.getUserProfileById as jest.Mock).mockResolvedValue(
          mockUserProfile,
        );
        (authService.getUserPermissionSet as jest.Mock).mockResolvedValue(
          mockPermissions,
        );

        await service.getUserProfile(validToken);

        expect(authService.getSessionByToken).toHaveBeenCalledWith(validToken);
        expect(authService.isUserAuthenticated).toHaveBeenCalledWith(
          mockSessionInfo.userId,
          validToken,
        );
        expect(authService.getUserProfileById).toHaveBeenCalledWith(
          mockSessionInfo.userId,
        );
        expect(authService.getUserPermissionSet).toHaveBeenCalledWith(
          mockSessionInfo.userId,
        );
      });
    });
  });

  describe('Logging Verification', () => {
    it('should log user authentication request', async () => {
      const authRequest = {
        email: 'test@example.com',
        password: 'valid-password',
      };

      const mockAuthResult = {
        success: false,
        message: 'Invalid credentials',
      };

      (
        authService.authenticateUserByEmailAndPassword as jest.Mock
      ).mockResolvedValue(mockAuthResult);

      await expect(service.authenticateUser(authRequest)).rejects.toThrow();

      expect(logger.logWithContext).toHaveBeenCalledWith(
        'log',
        'External user authentication request received',
        'AuthenticationUserService.authenticateUser',
        undefined,
        { email: 'test@example.com', hasPassword: true },
      );
    });

    it('should log user profile request', async () => {
      const token = 'test-token';

      (authService.getSessionByToken as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserProfile(token)).rejects.toThrow();

      expect(logger.logWithContext).toHaveBeenCalledWith(
        'log',
        'User profile request received',
        'AuthenticationUserService.getUserProfile',
        undefined,
        { tokenLength: token.length },
      );
    });
  });
});
