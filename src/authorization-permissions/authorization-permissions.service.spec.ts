// Mock the JSON imports before any imports
jest.doMock('./user-permissions.json', () => ({
  user_permissions: {
    user1: {
      permissions: ['read:chat'],
      jwtToken: 'test-jwt-1',
    },
  },
}));

jest.doMock('./group-permissions.json', () => ({
  group_permissions: {
    'admin-group': {
      permissions: ['write:chat'],
      members: ['user1'],
    },
  },
}));

jest.doMock('./user-group-memberships.json', () => ({
  user_group_memberships: {
    user1: ['admin-group'],
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthorizationPermissionsService } from './authorization-permissions.service';

describe('AuthorizationPermissionsService', () => {
  let service: AuthorizationPermissionsService;
  let logger: CustomLoggerService;
  let mockEvaluatePermission: jest.Mock;
  let mockGetUserEffectivePermissionChain: jest.Mock;

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
      evaluatedChain: ['read:chat', 'write:chat'],
    });

    mockGetUserEffectivePermissionChain.mockResolvedValue([
      {
        permissionId: 'read:chat',
        conditions: null,
        byVirtueOf: 'user',
      },
      {
        permissionId: 'write:chat',
        conditions: null,
        byVirtueOf: 'group',
        groupId: 'admin-group',
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
            permissionCheck: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthorizationPermissionsService>(
      AuthorizationPermissionsService,
    );
    logger = module.get<CustomLoggerService>(CustomLoggerService);
  });

  afterEach(() => {
    if (service) {
      service.clearTestUsers();
    }
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTestUserWithPermissions', () => {
    it('should create a test user with permissions', () => {
      const permissions = ['read:chat', 'write:chat'];
      const result = service.createTestUserWithPermissions(permissions);

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('jwt');
      expect(result.userId).toMatch(/^test-user-/);
      expect(result.jwt).toBeDefined();

      // Verify the user was created in memory
      const userPermissions = service.getTestUserPermissions(result.userId);
      expect(userPermissions).toBeDefined();
      expect(userPermissions?.permissions).toEqual(permissions);
    });

    it('should throw error when not in test mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      expect(() => {
        service.createTestUserWithPermissions(['read:chat']);
      }).toThrow(
        'createTestUserWithPermissions can only be called in test mode',
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('hasPermission', () => {
    it('should use helper function to evaluate permissions', async () => {
      // Create a test user first to ensure we have valid data
      const testUser = service.createTestUserWithPermissions([
        'read:chat',
        'write:chat',
      ]);

      mockEvaluatePermission.mockReturnValue({
        actor: testUser.userId,
        subjectPermission: 'read:chat',
        isAllowed: true,
        reason: 'Allowed - Permission found in chain',
        evaluatedChain: ['read:chat', 'write:chat'],
      });

      const result = await service.hasPermission(testUser.userId, 'read:chat');

      expect(mockEvaluatePermission).toHaveBeenCalledWith(
        testUser.userId,
        'read:chat',
        expect.any(Array),
        expect.any(Array),
        {},
      );
      expect(result).toBe(true);
    });

    it('should return false when helper function returns false', async () => {
      const testUser = service.createTestUserWithPermissions(['read:chat']);

      mockEvaluatePermission.mockReturnValue({
        actor: testUser.userId,
        subjectPermission: 'admin:system',
        isAllowed: false,
        reason: 'Permission is not allowed - Permission not found in chain',
        evaluatedChain: [],
      });

      const result = await service.hasPermission(
        testUser.userId,
        'admin:system',
      );

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const testUser = service.createTestUserWithPermissions(['read:chat']);

      mockEvaluatePermission.mockImplementation(() => {
        throw new Error('Helper error');
      });

      const result = await service.hasPermission(testUser.userId, 'read:chat');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserEffectivePermissions', () => {
    it('should use helper function to get effective permissions', async () => {
      const testUser = service.createTestUserWithPermissions([
        'read:chat',
        'write:chat',
      ]);

      const mockPermissions = [
        {
          permissionId: 'read:chat',
          conditions: null,
          byVirtueOf: 'user',
        },
      ];

      mockGetUserEffectivePermissionChain.mockResolvedValue(mockPermissions);

      const result = await service.getUserEffectivePermissions(testUser.userId);

      expect(mockGetUserEffectivePermissionChain).toHaveBeenCalledWith(
        testUser.userId,
        expect.any(Array),
        expect.any(Array),
        {},
      );
      expect(result).toEqual(mockPermissions);
    });

    it('should handle errors gracefully', async () => {
      const testUser = service.createTestUserWithPermissions(['read:chat']);

      mockGetUserEffectivePermissionChain.mockImplementation(() => {
        throw new Error('Helper error');
      });

      const result = await service.getUserEffectivePermissions(testUser.userId);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserPermissions (legacy method)', () => {
    it('should return permission IDs from effective permissions', async () => {
      const testUser = service.createTestUserWithPermissions([
        'read:chat',
        'write:chat',
      ]);

      const mockPermissions = [
        {
          permissionId: 'read:chat',
          conditions: null,
          byVirtueOf: 'user',
        },
        {
          permissionId: 'write:chat',
          conditions: null,
          byVirtueOf: 'group',
          groupId: 'admin-group',
        },
      ];

      mockGetUserEffectivePermissionChain.mockResolvedValue(mockPermissions);

      const result = await service.getUserPermissions(testUser.userId);

      expect(result).toEqual(['read:chat', 'write:chat']);
    });
  });
});
