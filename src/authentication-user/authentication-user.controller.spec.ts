import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationUserController } from './authentication-user.controller';
import { AuthenticationUserService } from './authentication-user.service';
import { UserAuthRequestDto } from './dto/user-auth-request.dto';
import { UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';

describe('AuthenticationUserController', () => {
  let controller: AuthenticationUserController;
  let service: jest.Mocked<AuthenticationUserService>;
  let mockResponse: jest.Mocked<Response>;
  let mockRequest: jest.Mocked<Request>;

  beforeEach(async () => {
    const mockService = {
      authenticateUser: jest.fn(),
      getUserProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationUserController],
      providers: [
        {
          provide: AuthenticationUserService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AuthenticationUserController>(
      AuthenticationUserController,
    );
    service = module.get<AuthenticationUserService>(
      AuthenticationUserService,
    ) as jest.Mocked<AuthenticationUserService>;

    // Mock Response object
    mockResponse = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    // Mock Request object
    mockRequest = {
      cookies: {},
      headers: {},
      url: '/auth/user',
      method: 'POST',
    } as any;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('authenticateUser', () => {
    const validAuthRequest: UserAuthRequestDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockAuthResult = {
      success: true,
      userId: 'user-123',
      email: 'test@example.com',
      jwtToken: 'jwt-token-12345',
      permissions: ['user:read', 'user:write'],
      message: 'Authentication successful',
    };

    it('should authenticate user and set cookie', async () => {
      service.authenticateUser.mockResolvedValue(mockAuthResult);

      const result = await controller.authenticateUser(
        validAuthRequest,
        mockResponse,
      );

      expect(result).toEqual(mockAuthResult);
      expect(service.authenticateUser).toHaveBeenCalledWith(validAuthRequest);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'auth-token',
        'jwt-token-12345',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 8 * 60 * 60 * 1000, // 8 hours
        },
      );
    });

    it('should handle authentication failure', async () => {
      const authError = new Error('Authentication failed');
      service.authenticateUser.mockRejectedValue(authError);

      await expect(
        controller.authenticateUser(validAuthRequest, mockResponse),
      ).rejects.toThrow(authError);

      expect(service.authenticateUser).toHaveBeenCalledWith(validAuthRequest);
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it('should handle service returning error response', async () => {
      const errorResult = {
        success: false,
        message: 'Invalid credentials',
        userId: '',
        email: '',
        jwtToken: '',
        permissions: [],
      };
      service.authenticateUser.mockResolvedValue(errorResult);

      const result = await controller.authenticateUser(
        validAuthRequest,
        mockResponse,
      );

      expect(result).toEqual(errorResult);
      expect(service.authenticateUser).toHaveBeenCalledWith(validAuthRequest);
      // Cookie should still be set even if success is false (service handles the logic)
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'auth-token',
        '',
        expect.any(Object),
      );
    });
  });

  describe('getMyProfile', () => {
    const mockProfile = {
      success: true,
      userId: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      accountType: 'STUDENT',
      accountStatus: 'ACTIVE',
      permissions: ['user:read', 'user:write'],
      lastLogin: null,
      emailVerified: true,
    };

    it('should return user profile with valid auth token', async () => {
      mockRequest.cookies = { 'auth-token': 'valid-jwt-token' };
      service.getUserProfile.mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile(mockRequest);

      expect(result).toEqual(mockProfile);
      expect(service.getUserProfile).toHaveBeenCalledWith('valid-jwt-token');
    });

    it('should throw UnauthorizedException when no auth token provided', async () => {
      mockRequest.cookies = {};

      await expect(controller.getMyProfile(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.getUserProfile).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when auth token is empty', async () => {
      mockRequest.cookies = { 'auth-token': '' };

      await expect(controller.getMyProfile(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.getUserProfile).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when auth token is null', async () => {
      mockRequest.cookies = { 'auth-token': null };

      await expect(controller.getMyProfile(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.getUserProfile).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockRequest.cookies = { 'auth-token': 'invalid-token' };
      const serviceError = new Error('Invalid token');
      service.getUserProfile.mockRejectedValue(serviceError);

      await expect(controller.getMyProfile(mockRequest)).rejects.toThrow(
        serviceError,
      );
      expect(service.getUserProfile).toHaveBeenCalledWith('invalid-token');
    });

    it('should handle service returning null', async () => {
      mockRequest.cookies = { 'auth-token': 'expired-token' };
      service.getUserProfile.mockResolvedValue(null);

      const result = await controller.getMyProfile(mockRequest);

      expect(result).toBeNull();
      expect(service.getUserProfile).toHaveBeenCalledWith('expired-token');
    });
  });
});
