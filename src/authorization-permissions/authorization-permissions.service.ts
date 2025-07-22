import { Injectable, Inject } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import {
  PermissionWithConditions,
  EvaluateAllowConditions,
} from './permission-evaluator.helper';

const JWT_SECRET = 'istack-buddy-secret-key-2024';

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
  // Configuration data - CONFIGURATION LOADING IS FATAL
  private userPermissions: FileBasedUserPermissions;
  private groupPermissions: FileBasedGroupPermissions;
  private userGroupMemberships: FileBasedUserGroupMemberships;

  constructor(
    private readonly logger: CustomLoggerService,
    @Inject('PermissionEvaluator')
    private readonly permissionEvaluator: PermissionEvaluator,
    // Accept configuration data as constructor parameters for testability
    // NOTE: At this time, we have no users and therefore no real user management.
    // It's expected that we will eventually integrate with a larger project that will provide user identity services and this code will need to be changed.
    // In the meantime, we load bare necessity from file.
    @Inject('UserPermissionsData')
    userPermissionsData: Partial<FileBasedUserPermissions>,
    @Inject('GroupPermissionsData')
    groupPermissionsData: any,
    @Inject('UserGroupMembershipsData')
    userGroupMembershipsData: any,
  ) {
    // CONFIGURATION LOADING IS FATAL - THE SERVER MUST NOT START IF THIS FAILS
    this.loadConfiguration(
      userPermissionsData,
      groupPermissionsData,
      userGroupMembershipsData,
    );

    this.logger.logWithContext(
      'debug',
      'File-based permissions loaded successfully',
      'AuthorizationPermissionsService.constructor',
      undefined,
      {
        userPermissionsCount: Object.keys(this.userPermissions.user_permissions)
          .length,
        groupPermissionsCount: Object.keys(
          this.groupPermissions.group_permissions,
        ).length,
        userGroupMembershipsCount: Object.keys(
          this.userGroupMemberships.user_group_memberships,
        ).length,
      },
    );
  }

  /**
   * Validate user permissions data - CONFIGURATION LOADING IS FATAL
   */
  private validateUserPermissions(data: any): FileBasedUserPermissions {
    if (!data) {
      throw new Error('user-permissions.json is empty or invalid');
    }
    if (!data.user_permissions) {
      throw new Error(
        'user-permissions.json is missing user_permissions property',
      );
    }
    return data as FileBasedUserPermissions;
  }

  /**
   * Validate group permissions data - CONFIGURATION LOADING IS FATAL
   */
  private validateGroupPermissions(data: any): FileBasedGroupPermissions {
    if (!data) {
      throw new Error('group-permissions.json is empty or invalid');
    }
    if (!data.group_permissions) {
      throw new Error(
        'group-permissions.json is missing group_permissions property',
      );
    }
    return data as FileBasedGroupPermissions;
  }

  /**
   * Validate user group memberships data - CONFIGURATION LOADING IS FATAL
   */
  private validateUserGroupMemberships(
    data: any,
  ): FileBasedUserGroupMemberships {
    if (!data) {
      throw new Error('user-group-memberships.json is empty or invalid');
    }
    if (!data.user_group_memberships) {
      throw new Error(
        'user-group-memberships.json is missing user_group_memberships property',
      );
    }
    return data as FileBasedUserGroupMemberships;
  }

  /**
   * Load configuration - CONFIGURATION LOADING IS FATAL
   */
  private loadConfiguration(
    userPermissionsData: any,
    groupPermissionsData: any,
    userGroupMembershipsData: any,
  ): void {
    try {
      // Validate each JSON data separately for granular error handling
      this.userPermissions = this.validateUserPermissions(userPermissionsData);
      this.groupPermissions =
        this.validateGroupPermissions(groupPermissionsData);
      this.userGroupMemberships = this.validateUserGroupMemberships(
        userGroupMembershipsData,
      );
    } catch (error) {
      // CONFIGURATION LOADING IS FATAL - THE SERVER MUST NOT START
      throw new Error(
        `Failed to load authorization permissions configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get user's own permissions as PermissionWithConditions array
   * ALL USERS ARE TREATED UNIFORMLY - NO TEST USER SPECIAL HANDLING
   */
  private getUserOwnPermissions(userId: string): PermissionWithConditions[] {
    // Check file-based permissions - NO OPTIONAL CHAINING, DATA IS GUARANTEED TO EXIST
    if (this.userPermissions.user_permissions[userId]) {
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

    // Get user's group memberships - NO OPTIONAL CHAINING, DATA IS GUARANTEED TO EXIST
    const userGroups =
      this.userGroupMemberships.user_group_memberships[userId] || [];

    // For each group, get the permissions
    userGroups.forEach((groupId) => {
      const groupData = this.groupPermissions.group_permissions[groupId];
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
