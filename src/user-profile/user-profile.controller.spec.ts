import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

describe('UserProfileController', () => {
  let controller: UserProfileController;
  let userProfileService: jest.Mocked<UserProfileService>;
  let authenticationService: jest.Mocked<AuthenticationService>;

  const mockUserProfile = {
    id: 'user1',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'John',
    last_name: 'Doe',
    account_type_informal: 'customer',
    current_account_status: 'active',
    is_email_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-01T12:00:00Z',
  };

  const mockRequestWithUser = {
    user: {
      userId: 'user1',
      email: 'test@example.com',
      username: 'testuser',
      accountType: 'customer',
    },
  };

  beforeEach(async () => {
    const mockUserProfileService = {
      getUserProfileById: jest.fn(),
      getUserProfileByEmail: jest.fn(),
      updateUserProfile: jest.fn(),
    };

    const mockAuthenticationService = {
      getUserPermissionSet: jest.fn(),
      authenticateUserByEmailAndPassword: jest.fn(),
      authenticateUser: jest.fn(),
      isUserAuthenticated: jest.fn(),
      getSessionByToken: jest.fn(),
      getUserProfileById: jest.fn(),
    };

    const mockLogger = {
      logWithContext: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserProfileController],
      providers: [
        {
          provide: UserProfileService,
          useValue: mockUserProfileService,
        },
        {
          provide: AuthenticationService,
          useValue: mockAuthenticationService,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<UserProfileController>(UserProfileController);
    userProfileService = module.get(UserProfileService);
    authenticationService = module.get(AuthenticationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyProfile', () => {
    it('should return user profile successfully', async () => {
      const mockPermissions = ['read:chat', 'write:chat'];

      userProfileService.getUserProfileById.mockResolvedValue(mockUserProfile);
      authenticationService.getUserPermissionSet.mockResolvedValue(
        mockPermissions,
      );

      const result = await controller.getMyProfile(mockRequestWithUser);

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
        lastLogin: '2024-01-01T12:00:00Z',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
      });

      expect(userProfileService.getUserProfileById).toHaveBeenCalledWith(
        'user1',
      );
      expect(authenticationService.getUserPermissionSet).toHaveBeenCalledWith(
        'user1',
      );
    });

    it('should throw UnauthorizedException when user information is not found', async () => {
      const requestWithoutUser = {};

      await expect(controller.getMyProfile(requestWithoutUser)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userProfileService.getUserProfileById).not.toHaveBeenCalled();
      expect(authenticationService.getUserPermissionSet).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user.userId is undefined', async () => {
      const requestWithUndefinedUserId = {
        user: {
          userId: undefined as any,
          email: 'test@example.com',
          username: 'testuser',
          accountType: 'customer',
        },
      };

      await expect(
        controller.getMyProfile(requestWithUndefinedUserId),
      ).rejects.toThrow(UnauthorizedException);
      expect(userProfileService.getUserProfileById).not.toHaveBeenCalled();
      expect(authenticationService.getUserPermissionSet).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user profile is not found', async () => {
      userProfileService.getUserProfileById.mockResolvedValue(null);

      await expect(
        controller.getMyProfile(mockRequestWithUser),
      ).rejects.toThrow(UnauthorizedException);
      expect(userProfileService.getUserProfileById).toHaveBeenCalledWith(
        'user1',
      );
      expect(authenticationService.getUserPermissionSet).not.toHaveBeenCalled();
    });

    it('should handle case where user object is null', async () => {
      const requestWithNullUser = { user: null as any };

      await expect(
        controller.getMyProfile(requestWithNullUser),
      ).rejects.toThrow(UnauthorizedException);
      expect(userProfileService.getUserProfileById).not.toHaveBeenCalled();
      expect(authenticationService.getUserPermissionSet).not.toHaveBeenCalled();
    });

    it('should handle case where user object is undefined', async () => {
      const requestWithUndefinedUser = { user: undefined };

      await expect(
        controller.getMyProfile(requestWithUndefinedUser),
      ).rejects.toThrow(UnauthorizedException);
      expect(userProfileService.getUserProfileById).not.toHaveBeenCalled();
      expect(authenticationService.getUserPermissionSet).not.toHaveBeenCalled();
    });

    it('should handle case where user.userId is null', async () => {
      const requestWithNullUserId = {
        user: {
          userId: null as any,
          email: 'test@example.com',
          username: 'testuser',
          accountType: 'customer',
        },
      };

      await expect(
        controller.getMyProfile(requestWithNullUserId),
      ).rejects.toThrow(UnauthorizedException);
      expect(userProfileService.getUserProfileById).not.toHaveBeenCalled();
      expect(authenticationService.getUserPermissionSet).not.toHaveBeenCalled();
    });

    it('should handle case where user.userId is empty string', async () => {
      const requestWithEmptyUserId = {
        user: {
          userId: '',
          email: 'test@example.com',
          username: 'testuser',
          accountType: 'customer',
        },
      };

      await expect(
        controller.getMyProfile(requestWithEmptyUserId),
      ).rejects.toThrow(UnauthorizedException);
      expect(userProfileService.getUserProfileById).not.toHaveBeenCalled();
      expect(authenticationService.getUserPermissionSet).not.toHaveBeenCalled();
    });
  });
});
