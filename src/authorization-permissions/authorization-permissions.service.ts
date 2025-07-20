import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

const JWT_SECRET = 'istack-buddy-secret-key-2024';

interface TestUserResult {
  userId: string;
  jwt: string;
}

interface TestUserProfile {
  username: string;
  email: string;
  account_type_informal: string;
  created_at: string;
  updated_at: string;
}

interface TestUserPermissions {
  permissions: string[];
  jwtToken: string;
}

@Injectable()
export class AuthorizationPermissionsService {
  // In-memory storage for test users
  private testUserProfiles: Record<string, TestUserProfile> = {};
  private testUserPermissions: Record<string, TestUserPermissions> = {};

  constructor(private readonly logger: CustomLoggerService) {}

  /**
   * Creates a test user with specified permissions and returns JWT token.
   * Only available in test mode.
   */
  public createTestUserWithPermissions(permissions: string[]): TestUserResult {
    // Ensure we're in test mode
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'createTestUserWithPermissions can only be called in test mode',
      );
    }

    const userId = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create user profile in memory
    this.createTestUserProfile(userId);

    // Create user permissions in memory
    this.createTestUserPermissions(userId, permissions);

    // Generate JWT token
    const jwtToken = jwt.sign(
      {
        userId,
        email: `${userId}@test.example.com`,
        username: userId,
        accountType: 'test',
      },
      JWT_SECRET,
      { expiresIn: '8h' },
    );

    this.logger.logWithContext(
      'debug',
      'Test user created with permissions',
      'AuthorizationPermissionsService.createTestUserWithPermissions',
      undefined,
      { userId, permissionCount: permissions.length },
    );

    return { userId, jwt: jwtToken };
  }

  private createTestUserProfile(userId: string): void {
    const profile: TestUserProfile = {
      username: userId,
      email: `${userId}@test.example.com`,
      account_type_informal: 'test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.testUserProfiles[userId] = profile;
  }

  private createTestUserPermissions(
    userId: string,
    permissions: string[],
  ): void {
    const userPermissions: TestUserPermissions = {
      permissions: permissions,
      jwtToken: '', // Will be set by authentication service
    };

    this.testUserPermissions[userId] = userPermissions;
  }

  /**
   * Gets test user profile from memory (for testing purposes)
   */
  public getTestUserProfile(userId: string): TestUserProfile | undefined {
    return this.testUserProfiles[userId];
  }

  /**
   * Gets test user permissions from memory (for testing purposes)
   */
  public getTestUserPermissions(
    userId: string,
  ): TestUserPermissions | undefined {
    return this.testUserPermissions[userId];
  }

  /**
   * Clears all test users from memory (for test cleanup)
   */
  public clearTestUsers(): void {
    this.testUserProfiles = {};
    this.testUserPermissions = {};
  }

  /**
   * Evaluates if a user has the required permission.
   */
  public async hasPermission(
    userId: string,
    requiredPermission: string,
  ): Promise<boolean> {
    this.logger.logWithContext(
      'debug',
      'Evaluating permission',
      'AuthorizationPermissionsService.hasPermission',
      undefined,
      { userId, requiredPermission },
    );

    try {
      // TODO: Get user permissions from file-based storage
      // For now, return true for basic permissions
      const userPermissions = ['auth:user', 'auth:user:{self}'];

      const hasPermission = userPermissions.includes(requiredPermission);

      this.logger.permissionCheck(
        requiredPermission,
        hasPermission,
        'AuthorizationPermissionsService.hasPermission',
        { userId },
      );

      return hasPermission;
    } catch (error) {
      this.logger.error(
        'AuthorizationPermissionsService.hasPermission',
        'Failed to evaluate permission',
        error as Error,
        { userId, requiredPermission },
      );
      return false;
    }
  }

  /**
   * Gets all permissions for a user.
   */
  public async getUserPermissions(userId: string): Promise<string[]> {
    this.logger.logWithContext(
      'debug',
      'Getting user permissions',
      'AuthorizationPermissionsService.getUserPermissions',
      undefined,
      { userId },
    );

    try {
      // TODO: Get permissions from file-based storage
      // For now, return basic permissions
      return ['auth:user', 'auth:user:{self}'];
    } catch (error) {
      this.logger.error(
        'AuthorizationPermissionsService.getUserPermissions',
        'Failed to get user permissions',
        error as Error,
        { userId },
      );
      return [];
    }
  }
}
