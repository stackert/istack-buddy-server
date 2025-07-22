import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { UserAuthRequestDto } from './dto/user-auth-request.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';
import { Request, Response } from 'express';

describe('AuthenticationController', () => {
  let controller: AuthenticationController;
  let authenticationService: jest.Mocked<AuthenticationService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const mockUserProfile = {
    id: 'user1',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'John',
    last_name: 'Doe',
    account_type_informal: 'customer',
    current_account_status: 'active',
    is_email_verified: true,
  };

  beforeEach(async () => {
    const mockAuthenticationService = {
      authenticateUserByEmailAndPassword: jest.fn(),
      getSessionByToken: jest.fn(),
      isUserAuthenticated: jest.fn(),
      getUserProfileById: jest.fn(),
      getUserPermissionSet: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        {
          provide: AuthenticationService,
          useValue: mockAuthenticationService,
        },
      ],
    }).compile();

    controller = module.get<AuthenticationController>(AuthenticationController);
    authenticationService = module.get(AuthenticationService);

    // Setup mock request and response
    mockRequest = {
      cookies: {},
    };

    mockResponse = {
      cookie: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateUser', () => {
    const authRequest: UserAuthRequestDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should authenticate user successfully and set cookie', async () => {
      const mockAuthResult = {
        success: true,
        userId: 'user1',
        jwtToken: 'jwt-token-123',
        sessionId: 'session-123',
      };

      authenticationService.authenticateUserByEmailAndPassword.mockResolvedValue(
        mockAuthResult,
      );

      const result = await controller.authenticateUser(
        authRequest,
        mockResponse as Response,
      );

      expect(result).toEqual({
        success: true,
        userId: 'user1',
        email: 'test@example.com',
        jwtToken: 'jwt-token-123',
        permissions: [],
        message: 'Authentication successful',
      });

      expect(
        authenticationService.authenticateUserByEmailAndPassword,
      ).toHaveBeenCalledWith('test@example.com', 'password123');

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'auth-token',
        'jwt-token-123',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 8 * 60 * 60 * 1000,
        },
      );
    });

    it('should handle authentication failure', async () => {
      const mockAuthResult = {
        success: false,
        error: 'Invalid credentials',
      };

      authenticationService.authenticateUserByEmailAndPassword.mockResolvedValue(
        mockAuthResult,
      );

      const result = await controller.authenticateUser(
        authRequest,
        mockResponse as Response,
      );

      expect(result).toEqual({
        success: false,
        userId: undefined,
        email: 'test@example.com',
        jwtToken: undefined,
        permissions: [],
        message: 'Invalid credentials',
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'auth-token',
        undefined,
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 8 * 60 * 60 * 1000,
        },
      );
    });

    it('should handle authentication failure with no error message', async () => {
      const mockAuthResult = {
        success: false,
      };

      authenticationService.authenticateUserByEmailAndPassword.mockResolvedValue(
        mockAuthResult,
      );

      const result = await controller.authenticateUser(
        authRequest,
        mockResponse as Response,
      );

      expect(result.message).toBe('Authentication failed');
    });
  });

  describe('getMyProfile', () => {
    it('should return user profile successfully', async () => {
      const authToken = 'valid-jwt-token';
      mockRequest.cookies = { 'auth-token': authToken };

      const mockSessionInfo = {
        userId: 'user1',
        sessionId: 'session-123',
      };

      const mockPermissions = ['read:chat', 'write:chat'];

      authenticationService.getSessionByToken.mockResolvedValue(
        mockSessionInfo,
      );
      authenticationService.isUserAuthenticated.mockResolvedValue(true);
      authenticationService.getUserProfileById.mockResolvedValue(
        mockUserProfile,
      );
      authenticationService.getUserPermissionSet.mockResolvedValue(
        mockPermissions,
      );

      const result = await controller.getMyProfile(mockRequest as Request);

      expect(result).toEqual({
        success: true,
        userId: 'user1',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'John',
        lastName: 'Doe',
        accountType: 'customer',
        accountStatus: 'active',
        permissions: mockPermissions,
        lastLogin: null,
        emailVerified: true,
      });

      expect(authenticationService.getSessionByToken).toHaveBeenCalledWith(
        authToken,
      );
      expect(authenticationService.isUserAuthenticated).toHaveBeenCalledWith(
        'user1',
        authToken,
      );
      expect(authenticationService.getUserProfileById).toHaveBeenCalledWith(
        'user1',
      );
      expect(authenticationService.getUserPermissionSet).toHaveBeenCalledWith(
        'user1',
      );
    });

    it('should throw UnauthorizedException when no auth token is provided', async () => {
      mockRequest.cookies = {};

      await expect(
        controller.getMyProfile(mockRequest as Request),
      ).rejects.toThrow(UnauthorizedException);
      expect(authenticationService.getSessionByToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when auth token is null', async () => {
      mockRequest.cookies = { 'auth-token': null };

      await expect(
        controller.getMyProfile(mockRequest as Request),
      ).rejects.toThrow(UnauthorizedException);
      expect(authenticationService.getSessionByToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when session info is null', async () => {
      const authToken = 'invalid-jwt-token';
      mockRequest.cookies = { 'auth-token': authToken };

      authenticationService.getSessionByToken.mockResolvedValue(null);

      await expect(
        controller.getMyProfile(mockRequest as Request),
      ).rejects.toThrow(UnauthorizedException);
      expect(authenticationService.getSessionByToken).toHaveBeenCalledWith(
        authToken,
      );
      expect(authenticationService.isUserAuthenticated).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const authToken = 'expired-jwt-token';
      mockRequest.cookies = { 'auth-token': authToken };

      const mockSessionInfo = {
        userId: 'user1',
        sessionId: 'session-123',
      };

      authenticationService.getSessionByToken.mockResolvedValue(
        mockSessionInfo,
      );
      authenticationService.isUserAuthenticated.mockResolvedValue(false);

      await expect(
        controller.getMyProfile(mockRequest as Request),
      ).rejects.toThrow(UnauthorizedException);
      expect(authenticationService.getSessionByToken).toHaveBeenCalledWith(
        authToken,
      );
      expect(authenticationService.isUserAuthenticated).toHaveBeenCalledWith(
        'user1',
        authToken,
      );
      expect(authenticationService.getUserProfileById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user profile is not found', async () => {
      const authToken = 'valid-jwt-token';
      mockRequest.cookies = { 'auth-token': authToken };

      const mockSessionInfo = {
        userId: 'user1',
        sessionId: 'session-123',
      };

      authenticationService.getSessionByToken.mockResolvedValue(
        mockSessionInfo,
      );
      authenticationService.isUserAuthenticated.mockResolvedValue(true);
      authenticationService.getUserProfileById.mockResolvedValue(null);

      await expect(
        controller.getMyProfile(mockRequest as Request),
      ).rejects.toThrow(UnauthorizedException);
      expect(authenticationService.getSessionByToken).toHaveBeenCalledWith(
        authToken,
      );
      expect(authenticationService.isUserAuthenticated).toHaveBeenCalledWith(
        'user1',
        authToken,
      );
      expect(authenticationService.getUserProfileById).toHaveBeenCalledWith(
        'user1',
      );
      expect(authenticationService.getUserPermissionSet).not.toHaveBeenCalled();
    });

    it('should handle case where cookies object is undefined', async () => {
      mockRequest.cookies = undefined;

      await expect(
        controller.getMyProfile(mockRequest as Request),
      ).rejects.toThrow(UnauthorizedException);
      expect(authenticationService.getSessionByToken).not.toHaveBeenCalled();
    });
  });
});
