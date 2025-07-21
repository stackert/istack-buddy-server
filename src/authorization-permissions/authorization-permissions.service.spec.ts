import { Test, TestingModule } from '@nestjs/testing';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

// Mock the helper functions before importing the service
const mockEvaluatePermission = jest.fn();
const mockGetUserEffectivePermissionChain = jest.fn();

jest.mock('./permission-evaluator.helper', () => ({
  evaluatePermission: mockEvaluatePermission,
  getUserEffectivePermissionChain: mockGetUserEffectivePermissionChain,
}));

// Import the service after mocking
import { AuthorizationPermissionsService } from './authorization-permissions.service';

describe('AuthorizationPermissionsService', () => {
  let service: AuthorizationPermissionsService;
  let logger: CustomLoggerService;

  beforeEach(async () => {
    // Reset all mocks first
    jest.clearAllMocks();

    // Set up default mock implementations for helper functions
    mockEvaluatePermission.mockReturnValue({
      actor: 'user1',
      subjectPermission: 'read:chat',
      isAllowed: true,
      reason: 'Allowed - Permission found in chain',
      evaluatedChain: ['read:chat', 'write:chat'],
    });

    mockGetUserEffectivePermissionChain.mockResolvedValue([]);

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
      mockEvaluatePermission.mockReturnValue({
        actor: 'user1',
        subjectPermission: 'read:chat',
        isAllowed: true,
        reason: 'Allowed - Permission found in chain',
        evaluatedChain: ['read:chat', 'write:chat'],
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
  });

  describe('getUserEffectivePermissions', () => {
    it('should use helper function to get effective permissions', async () => {
      const mockPermissions = [
        {
          permissionId: 'read:chat',
          conditions: null,
          byVirtueOf: 'user',
        },
      ];

      mockGetUserEffectivePermissionChain.mockResolvedValue(mockPermissions);

      const result = await service.getUserEffectivePermissions('user1');

      expect(mockGetUserEffectivePermissionChain).toHaveBeenCalledWith(
        'user1',
        expect.any(Array),
        expect.any(Array),
        {},
      );
      expect(result).toEqual(mockPermissions);
    });

    it('should handle errors gracefully', async () => {
      mockGetUserEffectivePermissionChain.mockImplementation(() => {
        throw new Error('Helper error');
      });

      const result = await service.getUserEffectivePermissions('user1');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserPermissions (legacy method)', () => {
    it('should return permission IDs from effective permissions', async () => {
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

      const result = await service.getUserPermissions('user1');

      expect(result).toEqual(['read:chat', 'write:chat']);
    });
  });

  describe('test user management', () => {
    it('should clear test users', () => {
      // Create a test user first
      const testUser = service.createTestUserWithPermissions(['read:chat']);

      // Verify user exists
      const userPermissions = service.getTestUserPermissions(testUser.userId);
      expect(userPermissions).toBeDefined();

      // Clear users
      service.clearTestUsers();

      // Verify user is gone
      const clearedUserPermissions = service.getTestUserPermissions(
        testUser.userId,
      );
      expect(clearedUserPermissions).toBeUndefined();
    });
  });
});
