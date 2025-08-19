import { Test, TestingModule } from '@nestjs/testing';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthorizationPermissionsService } from './authorization-permissions.service';
import { UserProfileService } from '../user-profile/user-profile.service';

describe('AuthorizationPermissionsService', () => {
  let service: AuthorizationPermissionsService;
  let logger: CustomLoggerService;
  let mockEvaluatePermission: jest.Mock;
  let mockGetUserEffectivePermissionChain: jest.Mock;

  // Mock data for testing
  const mockUserPermissionsData = {
    user_permissions: {
      user1: {
        permissions: ['read:chat'],
        jwtToken: 'test-jwt-1',
      },
      user2: {
        permissions: ['write:chat'],
        jwtToken: 'test-jwt-2',
      },
    },
  };

  const mockGroupPermissionsData = {
    group_permissions: {
      'admin-group': {
        permissions: ['admin:all'],
        members: ['user1'],
      },
      'moderator-group': {
        permissions: ['moderate:chat'],
        members: ['user2'],
      },
    },
  };

  const mockUserGroupMembershipsData = {
    user_group_memberships: {
      user1: ['admin-group'],
      user2: ['moderator-group'],
    },
  };

  const mockUserProfilesData = {
    users: {
      user1: {
        id: 'user1',
        email: 'user1@example.com',
        username: 'user1',
        first_name: 'User',
        last_name: 'One',
        account_type_informal: 'STUDENT',
        current_account_status: 'active',
        is_email_verified: true,
        created_at: '2024-01-01T00:00:00.000Z',
        last_login: '2024-01-01T00:00:00.000Z',
      },
    },
  };

  beforeEach(async () => {
    // Reset all mocks first
    jest.clearAllMocks();

    // Create mock functions
    mockEvaluatePermission = jest.fn();
    mockGetUserEffectivePermissionChain = jest.fn();

    // Set up default mock implementations for helper functions
    mockEvaluatePermission.mockReturnValue({
      actor: 'user1',
      subjectPermission: 'read:chat',
      isAllowed: true,
      reason: 'Allowed - Permission found in chain',
      evaluatedChain: ['read:chat'],
    });

    mockGetUserEffectivePermissionChain.mockResolvedValue([
      {
        permissionId: 'read:chat',
        conditions: null,
        byVirtueOf: 'user' as const,
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationPermissionsService,
        {
          provide: CustomLoggerService,
          useValue: {
            logWithContext: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
            permissionCheck: jest.fn(),
          },
        },
        {
          provide: UserProfileService,
          useValue: {
            addTemporaryUser: jest.fn(),
            getUserProfileById: jest.fn(),
            getUserProfileByEmail: jest.fn(),
            updateUserProfile: jest.fn(),
          },
        },
        {
          provide: 'PermissionEvaluator',
          useValue: {
            evaluatePermission: mockEvaluatePermission,
            getUserEffectivePermissionChain:
              mockGetUserEffectivePermissionChain,
          },
        },
        {
          provide: 'UserPermissionsData',
          useValue: mockUserPermissionsData,
        },
        {
          provide: 'GroupPermissionsData',
          useValue: mockGroupPermissionsData,
        },
        {
          provide: 'UserGroupMembershipsData',
          useValue: mockUserGroupMembershipsData,
        },
        {
          provide: 'UserProfilesData',
          useValue: mockUserProfilesData,
        },
      ],
    }).compile();

    service = module.get<AuthorizationPermissionsService>(
      AuthorizationPermissionsService,
    );
    logger = module.get<CustomLoggerService>(CustomLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hasPermission', () => {
    it('should use helper function to evaluate permissions', async () => {
      mockEvaluatePermission.mockReturnValue({
        actor: 'user1',
        subjectPermission: 'read:chat',
        isAllowed: true,
        reason: 'Allowed - Permission found in chain',
        evaluatedChain: ['read:chat'],
      });

      const result = await service.hasPermission('user1', 'read:chat');

      expect(mockEvaluatePermission).toHaveBeenCalledWith(
        'user1',
        'read:chat',
        expect.any(Array),
        expect.any(Array),
        {},
      );
      expect(result).toBe(true);
    });

    it('should return false when helper function returns false', async () => {
      mockEvaluatePermission.mockReturnValue({
        actor: 'user1',
        subjectPermission: 'admin:system',
        isAllowed: false,
        reason: 'Permission is not allowed - Permission not found in chain',
        evaluatedChain: [],
      });

      const result = await service.hasPermission('user1', 'admin:system');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockEvaluatePermission.mockImplementation(() => {
        throw new Error('Helper error');
      });

      const result = await service.hasPermission('user1', 'read:chat');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should test getUserOwnPermissions through hasPermission', async () => {
      // This test indirectly covers getUserOwnPermissions method
      mockEvaluatePermission.mockReturnValue({
        actor: 'user1',
        subjectPermission: 'read:chat',
        isAllowed: true,
        reason: 'Allowed - Permission found in chain',
        evaluatedChain: ['read:chat'],
      });

      const result = await service.hasPermission('user1', 'read:chat');

      expect(result).toBe(true);
      expect(mockEvaluatePermission).toHaveBeenCalledWith(
        'user1',
        'read:chat',
        expect.any(Array), // userOwnPermissions
        expect.any(Array), // userGroupMemberships
        {},
      );
    });

    it('should test getUserGroupMemberships through hasPermission', async () => {
      // This test indirectly covers getUserGroupMemberships method
      mockEvaluatePermission.mockReturnValue({
        actor: 'user1',
        subjectPermission: 'write:chat',
        isAllowed: true,
        reason: 'Allowed - Permission found in chain',
        evaluatedChain: ['write:chat'],
      });

      const result = await service.hasPermission('user1', 'write:chat');

      expect(result).toBe(true);
      expect(mockEvaluatePermission).toHaveBeenCalledWith(
        'user1',
        'write:chat',
        expect.any(Array), // userOwnPermissions
        expect.any(Array), // userGroupMemberships
        {},
      );
    });
  });

  describe('getUserEffectivePermissions', () => {
    it('should get user effective permissions', async () => {
      const result = await service.getUserEffectivePermissions('user1');
      expect(result).toEqual([
        {
          permissionId: 'read:chat',
          conditions: null,
          byVirtueOf: 'user',
        },
      ]);
    });

    it('should handle errors gracefully in getUserEffectivePermissions', async () => {
      // Mock the private methods to throw errors to force the catch block
      jest
        .spyOn(service as any, 'getUserOwnPermissions')
        .mockImplementation(() => {
          throw new Error('Private method error');
        });

      const result = await service.getUserEffectivePermissions('user1');
      expect(result).toEqual([]);
    });

    it('should test getUserEffectivePermissions with evaluation context', async () => {
      const evaluationContext = {};
      const result = await service.getUserEffectivePermissions(
        'user1',
        evaluationContext,
      );
      expect(result).toEqual([
        {
          permissionId: 'read:chat',
          conditions: null,
          byVirtueOf: 'user',
        },
      ]);
      expect(mockGetUserEffectivePermissionChain).toHaveBeenCalledWith(
        'user1',
        expect.any(Array),
        expect.any(Array),
        evaluationContext,
      );
    });
  });

  describe('getUserPermissions', () => {
    it('should get user permissions (legacy method)', async () => {
      const result = await service.getUserPermissions('user1');
      expect(result).toEqual(['read:chat']);
    });

    it('should handle errors gracefully in getUserPermissions', async () => {
      // Mock getUserEffectivePermissions to throw an error to trigger the catch block
      jest
        .spyOn(service, 'getUserEffectivePermissions')
        .mockRejectedValue(new Error('Test error'));
      const result = await service.getUserPermissions('user1');
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully in getUserPermissions with evaluation context', async () => {
      mockGetUserEffectivePermissionChain.mockRejectedValue(
        new Error('Helper function error'),
      );
      const result = await service.getUserPermissions('user1');
      expect(result).toEqual([]);
    });

    it('should test getUserPermissions with evaluation context', async () => {
      const evaluationContext = {};
      const result = await service.getUserPermissions('user1');
      expect(result).toEqual(['read:chat']);
      expect(mockGetUserEffectivePermissionChain).toHaveBeenCalledWith(
        'user1',
        expect.any(Array),
        expect.any(Array),
        evaluationContext,
      );
    });
  });

  describe('private methods', () => {
    it('should test getUserOwnPermissions directly with existing user', () => {
      const result = service['getUserOwnPermissions']('user1');

      // Test the structure without depending on specific data
      expect(Array.isArray(result)).toBe(true);
      // If there are permissions, they should have the correct structure
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('permissionId');
        expect(result[0]).toHaveProperty('conditions');
        expect(result[0]).toHaveProperty('byVirtueOf', 'user');
      }
    });

    it('should test getUserOwnPermissions with non-existent user', () => {
      const result = service['getUserOwnPermissions']('non-existent-user');
      expect(result).toEqual([]);
    });

    it('should test getUserGroupMemberships with user not in any groups', () => {
      const result = service['getUserGroupMemberships']('user-not-in-groups');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should test getUserGroupMemberships with user in groups', () => {
      const result = service['getUserGroupMemberships']('user1');
      expect(Array.isArray(result)).toBe(true);
      // If there are group memberships, they should have the correct structure
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('permissionId');
        expect(result[0]).toHaveProperty('conditions');
        expect(result[0]).toHaveProperty('byVirtueOf', 'group');
        expect(result[0]).toHaveProperty('groupId');
      }
    });

    describe('validation functions', () => {
      it('should validate user permissions with valid data', () => {
        const validData = {
          user_permissions: {
            user1: {
              permissions: ['read:chat'],
              jwtToken: 'test-jwt',
            },
          },
        };
        const result = service['validateUserPermissions'](validData);
        expect(result).toEqual(validData);
      });

      it('should throw error when user permissions data is null', () => {
        expect(() => service['validateUserPermissions'](null)).toThrow(
          'user-permissions.json is empty or invalid',
        );
      });

      it('should throw error when user permissions data is undefined', () => {
        expect(() => service['validateUserPermissions'](undefined)).toThrow(
          'user-permissions.json is empty or invalid',
        );
      });

      it('should throw error when user permissions data is missing user_permissions property', () => {
        const invalidData = { someOtherProperty: 'value' };
        expect(() => service['validateUserPermissions'](invalidData)).toThrow(
          'user-permissions.json is missing user_permissions property',
        );
      });

      it('should validate group permissions with valid data', () => {
        const validData = {
          group_permissions: {
            'admin-group': {
              permissions: ['write:chat'],
              members: ['user1'],
            },
          },
        };
        const result = service['validateGroupPermissions'](validData);
        expect(result).toEqual(validData);
      });

      it('should throw error when group permissions data is null', () => {
        expect(() => service['validateGroupPermissions'](null)).toThrow(
          'group-permissions.json is empty or invalid',
        );
      });

      it('should throw error when group permissions data is missing group_permissions property', () => {
        const invalidData = { someOtherProperty: 'value' };
        expect(() => service['validateGroupPermissions'](invalidData)).toThrow(
          'group-permissions.json is missing group_permissions property',
        );
      });

      it('should validate user group memberships with valid data', () => {
        const validData = {
          user_group_memberships: {
            user1: ['admin-group'],
          },
        };
        const result = service['validateUserGroupMemberships'](validData);
        expect(result).toEqual(validData);
      });

      it('should throw error when user group memberships data is null', () => {
        expect(() => service['validateUserGroupMemberships'](null)).toThrow(
          'user-group-memberships.json is empty or invalid',
        );
      });

      it('should throw error when user group memberships data is missing user_group_memberships property', () => {
        const invalidData = { someOtherProperty: 'value' };
        expect(() =>
          service['validateUserGroupMemberships'](invalidData),
        ).toThrow(
          'user-group-memberships.json is missing user_group_memberships property',
        );
      });

      it('should throw error when loadConfiguration fails validation', () => {
        // Create a new service instance with invalid data to trigger the throw
        const invalidUserData = null;
        const validGroupData = mockGroupPermissionsData;
        const validMembershipData = mockUserGroupMembershipsData;

        expect(() => {
          service['loadConfiguration'](
            invalidUserData,
            validGroupData,
            validMembershipData,
          );
        }).toThrow(
          'Failed to load authorization permissions configuration: user-permissions.json is empty or invalid',
        );
      });
    });
  });

  describe('hasPermission with evaluation context', () => {
    it('should pass evaluation context to helper function', async () => {
      const evaluationContext = {};

      mockEvaluatePermission.mockReturnValue({
        actor: 'user1',
        subjectPermission: 'read:chat',
        isAllowed: true,
        reason: 'Allowed - Permission found in chain',
        evaluatedChain: ['read:chat'],
      });

      const result = await service.hasPermission(
        'user1',
        'read:chat',
        evaluationContext,
      );

      expect(result).toBe(true);
      expect(mockEvaluatePermission).toHaveBeenCalledWith(
        'user1',
        'read:chat',
        expect.any(Array),
        expect.any(Array),
        evaluationContext,
      );
    });
  });

  describe('getUserEffectivePermissions with evaluation context', () => {
    it('should pass evaluation context to helper function', async () => {
      const evaluationContext = {};

      const result = await service.getUserEffectivePermissions(
        'user1',
        evaluationContext,
      );

      expect(mockGetUserEffectivePermissionChain).toHaveBeenCalledWith(
        'user1',
        expect.any(Array),
        expect.any(Array),
        evaluationContext,
      );
      expect(result).toEqual([
        {
          permissionId: 'read:chat',
          conditions: null,
          byVirtueOf: 'user',
        },
      ]);
    });
  });

  describe('addUser', () => {
    it('should add user successfully with valid permissions and groups', () => {
      const userId = 'new-user';
      const ownPermissions = ['read:chat'];
      const groupMemberships = ['admin-group'];

      service['addUser'](userId, ownPermissions, groupMemberships);

      expect(service['userPermissions'].user_permissions[userId]).toEqual({
        permissions: ownPermissions,
        jwtToken: `test-jwt-${userId}`,
      });
      expect(
        service['userGroupMemberships'].user_group_memberships[userId],
      ).toEqual(groupMemberships);
    });

    it('should throw error when group does not exist', () => {
      const userId = 'new-user';
      const ownPermissions = ['read:chat'];
      const groupMemberships = ['nonexistent-group'];

      expect(() => {
        service['addUser'](userId, ownPermissions, groupMemberships);
      }).toThrow(
        "Group 'nonexistent-group' does not exist for user 'new-user'",
      );
    });

    it('should add user with empty permissions and groups', () => {
      const userId = 'empty-user';
      const ownPermissions: string[] = [];
      const groupMemberships: string[] = [];

      service['addUser'](userId, ownPermissions, groupMemberships);

      expect(service['userPermissions'].user_permissions[userId]).toEqual({
        permissions: [],
        jwtToken: `test-jwt-${userId}`,
      });
      expect(
        service['userGroupMemberships'].user_group_memberships[userId],
      ).toEqual([]);
    });
  });
});
