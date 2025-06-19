import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationUserService } from './authentication-user.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthService } from '../auth/auth.service';

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authenticateUser', () => {
    it('should throw UnauthorizedException when email is missing', async () => {
      const authRequest = { email: '', password: 'valid-password' };

      await expect(service.authenticateUser(authRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is missing', async () => {
      const authRequest = { email: 'test@example.com', password: '' };

      await expect(service.authenticateUser(authRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user data when authentication is successful', async () => {
      const authRequest = {
        email: 'test@example.com',
        password: 'valid-password',
      };
      const mockAuthResult = {
        success: true,
        userId: 'test-user-id',
        jwtToken: 'test-jwt-token',
        permissions: ['test:permission'],
        message: 'Authentication successful',
      };

      (
        authService.authenticateUserByEmailAndPassword as jest.Mock
      ).mockResolvedValue(mockAuthResult);

      const result = await service.authenticateUser(authRequest);

      expect(result).toEqual({
        success: true,
        userId: 'test-user-id',
        email: 'test@example.com',
        jwtToken: 'test-jwt-token',
        permissions: ['test:permission'],
        message: 'Authentication successful',
      });
    });

    // TODO: Add more comprehensive tests when AuthService is properly mockable
    // This is a placeholder test structure for the development phase
  });

  describe('getUserProfile', () => {
    it('should throw UnauthorizedException when no token provided', async () => {
      await expect(service.getUserProfile('')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when session not found', async () => {
      (authService.getSessionByToken as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserProfile('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // TODO: Add more comprehensive tests for successful profile retrieval
  });
});
