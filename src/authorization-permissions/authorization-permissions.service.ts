import { Injectable, Inject } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import {
  PermissionWithConditions,
  EvaluateAllowConditions,
} from './permission-evaluator.helper';

// Import JSON files directly for compile-time checking
import userPermissionsData from './user-permissions.json';
import groupPermissionsData from './group-permissions.json';
import userGroupMembershipsData from './user-group-memberships.json';

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

interface FileBasedUserPermissions {
  user_permissions: {
    [userId: string]: {
      permissions: string[];
      jwtToken: string;
    };
  };
}

interface FileBasedGroupPermissions {
  group_permissions: {
    [groupId: string]: {
      permissions: string[];
      members: string[];
    };
  };
}

interface FileBasedUserGroupMemberships {
  user_group_memberships: {
    [userId: string]: string[]; // Array of group IDs
  };
}

// Define interfaces for the helper functions to make them injectable
interface PermissionEvaluator {
  evaluatePermission: (
    userId: string,
    requiredPermission: string,
    userOwnPermissions: PermissionWithConditions[],
    userGroupMemberships: PermissionWithConditions[],
    evaluationContext: EvaluateAllowConditions,
  ) => {
    actor: string;
    subjectPermission: string;
    isAllowed: boolean;
    reason: string;
    evaluatedChain: string[];
  };
  getUserEffectivePermissionChain: (
    userId: string,
    userOwnPermissions: PermissionWithConditions[],
    userGroupMemberships: PermissionWithConditions[],
    evaluationContext: EvaluateAllowConditions,
  ) => Promise<PermissionWithConditions[]>;
}

@Injectable()
export class AuthorizationPermissionsService {
  // In-memory storage for test users
  private testUserProfiles: Record<string, TestUserProfile> = {};
  private testUserPermissions: Record<string, TestUserPermissions> = {};

  // Use imported JSON data directly
  private userPermissions: FileBasedUserPermissions = userPermissionsData;
  private groupPermissions: FileBasedGroupPermissions = groupPermissionsData;
  private userGroupMemberships: FileBasedUserGroupMemberships =
    userGroupMembershipsData;

  constructor(
    private readonly logger: CustomLoggerService,
    @Inject('PermissionEvaluator')
    private readonly permissionEvaluator: PermissionEvaluator,
  ) {
    this.logger.logWithContext(
      'debug',
      'File-based permissions loaded successfully',
      'AuthorizationPermissionsService.constructor',
      undefined,
      {},
    );
  }

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
   * Get user's own permissions as PermissionWithConditions array
   */
  private getUserOwnPermissions(userId: string): PermissionWithConditions[] {
    // First check if this is a test user
    const testUserPermissions = this.getTestUserPermissions(userId);
    if (testUserPermissions) {
      return testUserPermissions.permissions.map((permissionId) => ({
        permissionId,
        conditions: null, // Test users have no conditions
        byVirtueOf: 'user' as const,
      }));
    }

    // Check file-based permissions (with null check)
    if (this.userPermissions?.user_permissions?.[userId]) {
      return this.userPermissions.user_permissions[userId].permissions.map(
        (permissionId) => ({
          permissionId,
          conditions: null, // TODO: Add conditions support to file-based permissions
          byVirtueOf: 'user' as const,
        }),
      );
    }

    return [];
  }

  /**
   * Get user's group membership permissions as PermissionWithConditions array
   */
  private getUserGroupMemberships(userId: string): PermissionWithConditions[] {
    const groupMemberships: PermissionWithConditions[] = [];

    // Get user's group memberships (with null check)
    const userGroups =
      this.userGroupMemberships?.user_group_memberships?.[userId] || [];

    // For each group, get the permissions
    userGroups.forEach((groupId) => {
      const groupData = this.groupPermissions?.group_permissions?.[groupId];
      if (groupData) {
        groupData.permissions.forEach((permissionId) => {
          groupMemberships.push({
            permissionId,
            conditions: null, // TODO: Add conditions support to file-based permissions
            byVirtueOf: 'group' as const,
            groupId,
          });
        });
      }
    });

    return groupMemberships;
  }

  /**
   * Evaluates if a user has the required permission using the helper function.
   */
  public async hasPermission(
    userId: string,
    requiredPermission: string,
    evaluationContext: EvaluateAllowConditions = {},
  ): Promise<boolean> {
    this.logger.logWithContext(
      'debug',
      'Evaluating permission using helper function',
      'AuthorizationPermissionsService.hasPermission',
      undefined,
      { userId, requiredPermission },
    );

    try {
      // Get user's own permissions
      const userOwnPermissions = this.getUserOwnPermissions(userId);

      // Get user's group membership permissions
      const userGroupMemberships = this.getUserGroupMemberships(userId);

      // Use the helper function to evaluate the permission
      const result = this.permissionEvaluator.evaluatePermission(
        userId,
        requiredPermission,
        userOwnPermissions,
        userGroupMemberships,
        evaluationContext,
      );

      this.logger.permissionCheck(
        requiredPermission,
        result.isAllowed,
        'AuthorizationPermissionsService.hasPermission',
        { userId },
      );

      return result.isAllowed;
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
   * Gets all effective permissions for a user (own + group memberships, with conditions evaluated).
   */
  public async getUserEffectivePermissions(
    userId: string,
    evaluationContext: EvaluateAllowConditions = {},
  ): Promise<PermissionWithConditions[]> {
    this.logger.logWithContext(
      'debug',
      'Getting user effective permissions using helper function',
      'AuthorizationPermissionsService.getUserEffectivePermissions',
      undefined,
      { userId },
    );

    try {
      // Get user's own permissions
      const userOwnPermissions = this.getUserOwnPermissions(userId);

      // Get user's group membership permissions
      const userGroupMemberships = this.getUserGroupMemberships(userId);

      // Use the helper function to get the effective permission chain
      const effectivePermissions =
        await this.permissionEvaluator.getUserEffectivePermissionChain(
          userId,
          userOwnPermissions,
          userGroupMemberships,
          evaluationContext,
        );

      return effectivePermissions;
    } catch (error) {
      this.logger.error(
        'AuthorizationPermissionsService.getUserEffectivePermissions',
        'Failed to get user effective permissions',
        error as Error,
        { userId },
      );
      return [];
    }
  }

  /**
   * Gets all permissions for a user (legacy method for backward compatibility).
   */
  public async getUserPermissions(userId: string): Promise<string[]> {
    this.logger.logWithContext(
      'debug',
      'Getting user permissions (legacy method)',
      'AuthorizationPermissionsService.getUserPermissions',
      undefined,
      { userId },
    );

    try {
      const effectivePermissions =
        await this.getUserEffectivePermissions(userId);
      return effectivePermissions.map((p) => p.permissionId);
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
