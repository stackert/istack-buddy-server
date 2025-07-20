import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationPermissionsService } from './authorization-permissions.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

describe('AuthorizationPermissionsService', () => {
  let service: AuthorizationPermissionsService;
  let logger: CustomLoggerService;

  beforeEach(async () => {
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

  describe('createTestUserWithPermissions', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      // Set test environment
      process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      // Clear test users after each test
      service.clearTestUsers();
    });

    it('should create test user with permissions and return JWT token', () => {
      const permissions = ['user:profile:read', 'user:profile:edit'];

      const result = service.createTestUserWithPermissions(permissions);

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('jwt');
      expect(result.userId).toMatch(/^test-user-\d+-\w+$/);
      expect(result.jwt).toBeTruthy();

      // Verify user profile was created in memory
      const profile = service.getTestUserProfile(result.userId);
      expect(profile).toBeDefined();
      expect(profile?.username).toBe(result.userId);
      expect(profile?.email).toBe(`${result.userId}@test.example.com`);

      // Verify user permissions were created in memory
      const userPermissions = service.getTestUserPermissions(result.userId);
      expect(userPermissions).toBeDefined();
      expect(userPermissions?.permissions).toEqual(permissions);

      // Verify logger was called
      expect(logger.logWithContext).toHaveBeenCalledWith(
        'debug',
        'Test user created with permissions',
        'AuthorizationPermissionsService.createTestUserWithPermissions',
        undefined,
        expect.objectContaining({
          userId: result.userId,
          permissionCount: 2,
        }),
      );
    });

    it('should throw error when not in test mode', () => {
      process.env.NODE_ENV = 'development';

      expect(() => {
        service.createTestUserWithPermissions(['user:profile:read']);
      }).toThrow(
        'createTestUserWithPermissions can only be called in test mode',
      );
    });

    it('should create unique user IDs for each call', () => {
      const permissions = ['user:profile:read'];

      const result1 = service.createTestUserWithPermissions(permissions);
      const result2 = service.createTestUserWithPermissions(permissions);

      expect(result1.userId).not.toBe(result2.userId);
    });

    it('should clear test users when clearTestUsers is called', () => {
      const permissions = ['user:profile:read'];
      const result = service.createTestUserWithPermissions(permissions);

      // Verify user exists
      expect(service.getTestUserProfile(result.userId)).toBeDefined();
      expect(service.getTestUserPermissions(result.userId)).toBeDefined();

      // Clear users
      service.clearTestUsers();

      // Verify user no longer exists
      expect(service.getTestUserProfile(result.userId)).toBeUndefined();
      expect(service.getTestUserPermissions(result.userId)).toBeUndefined();
    });
  });
});
