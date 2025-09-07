import { Injectable, Inject } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { UserProfileService } from '../user-profile/user-profile.service';
import {
  PermissionWithConditions,
  EvaluateAllowConditions,
} from './permission-evaluator.helper';

const JWT_SECRET = 'istack-buddy-secret-key-2024';

export interface IFormMarvSession {
  sessionId: string;
  userId: string;
  jwtToken: string;
  formId: string;
  conversationId: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresInMs: number;
}

export interface TempUserAndSessionResult {
  sessionId: string;
  userId: string;
  jwtToken: string;
}

export interface IDevSession {
  sessionId: string;
  userId: string;
  jwtToken: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresInMs: number;
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
  // Configuration data - CONFIGURATION LOADING IS FATAL
  private userPermissions: FileBasedUserPermissions;
  private groupPermissions: FileBasedGroupPermissions;
  private userGroupMemberships: FileBasedUserGroupMemberships;

  // Session management
  private formMarvSessions: Record<string, IFormMarvSession> = {};
  private devSessions: Record<string, IDevSession> = {};

  constructor(
    private readonly logger: CustomLoggerService,
    private readonly userProfileService: UserProfileService,
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
   * Add a user with their own permissions and group memberships.
   * Throws error if validation fails - does not try to fix issues.
   *
   * NOTE: This method is designed for testing and temporary users only.
   * We have no real intention of supporting actual user management at this time.
   * Use cases requiring identity will be 'testing users' or 'temporary users' only.
   *
   * When we integrate with the larger ecosystem, we anticipate redoing much of
   * the user creation, authentication, and possibly authorization code.
   * This method should be considered temporary and will likely be replaced.
   */
  public addUser(
    userId: string,
    ownPermissions: string[],
    groupMemberships: string[],
  ): void {
    // Validate that all groups exist
    for (const groupId of groupMemberships) {
      if (!this.groupPermissions.group_permissions[groupId]) {
        throw new Error(
          `Group '${groupId}' does not exist for user '${userId}'`,
        );
      }
    }

    // Add user's own permissions
    this.userPermissions.user_permissions[userId] = {
      permissions: ownPermissions,
      jwtToken: `test-jwt-${userId}`,
    };

    // Add user's group memberships
    this.userGroupMemberships.user_group_memberships[userId] = groupMemberships;

    this.logger.logWithContext(
      'debug',
      'User added successfully',
      'AuthorizationPermissionsService.addUser',
      undefined,
      {
        userId,
        ownPermissionsCount: ownPermissions.length,
        groupMembershipsCount: groupMemberships.length,
      },
    );
  }

  /**
   * Create a temporary user and session for a specific conversation
   * @param sessionId The session/conversation ID to use as the user ID
   * @param formId The form ID for the session
   * @returns Object containing sessionId, userId, and jwtToken
   */
  createTempUserAndSession(
    sessionId: string,
    formId: string,
  ): TempUserAndSessionResult {
    const userId = sessionId; // Use the provided sessionId as userId
    const now = new Date();
    const expiresInMs = 24 * 60 * 60 * 1000; // 24 hours

    // Create a temporary user with the required permissions for both read and write
    this.addUser(
      userId,
      ['cx-agent:form-marv:read', 'cx-agent:form-marv:write'],
      [],
    );

    // Create a temporary user profile
    this.userProfileService.addTemporaryUser(userId, {
      email: `marv-session-${Date.now()}@istackbuddy.com`,
      username: userId,
      account_type_informal: 'TEMPORARY',
      first_name: 'Temporary',
      last_name: 'Session-' + sessionId,
    });

    // Create JWT token for the temporary user
    const jwtSecret = process.env.ISTACK_BUDDY_INTERNAL_JWT_SECRET;
    if (!jwtSecret) {
      throw new Error(
        'ISTACK_BUDDY_INTERNAL_JWT_SECRET environment variable is not set',
      );
    }

    const jwtToken = jwt.sign(
      {
        userId,
        email: `marv-session-${Date.now()}@istackbuddy.com`,
        username: userId,
        accountType: 'TEMPORARY',
        sessionId,
        formId,
      },
      jwtSecret,
      { expiresIn: '8h' },
    );

    // Create and store the session using JWT token as internal key
    const session: IFormMarvSession = {
      sessionId, // Use sessionId for URL path (obscure, not secret)
      userId,
      jwtToken,
      formId,
      conversationId: sessionId, // Keep original sessionId as conversationId
      createdAt: now,
      lastActivityAt: now,
      expiresInMs,
    };

    this.formMarvSessions[jwtToken] = session;

    this.logger.logWithContext(
      'log',
      'Temporary user and session created',
      'AuthorizationPermissionsService.createTempUserAndSession',
      undefined,
      { sessionId, userId, formId },
    );

    return {
      sessionId,
      userId,
      jwtToken,
    };
  }

  /**
   * Create a temporary dev user and session for robot router testing
   * Based on marv-session pattern but for dev/debug purposes
   * @returns Object containing sessionId, userId, and jwtToken
   */
  createDevUserAndSession(): TempUserAndSessionResult {
    const sessionId = uuidv4();
    const userId = sessionId;
    const now = new Date();
    const expiresInMs = 8 * 60 * 60 * 1000; // 8 hours (same as marv)

    // Create a temporary user with dev permissions
    this.addUser(
      userId,
      ['dev-debug:chat:read', 'dev-debug:chat:write', 'dev-debug:monitor:read'],
      [],
    );

    // Create a temporary user profile
    this.userProfileService.addTemporaryUser(userId, {
      email: `dev-session-${Date.now()}@istackbuddy.com`,
      username: userId,
      account_type_informal: 'TEMPORARY_DEV',
      first_name: 'Dev',
      last_name: 'Session-' + sessionId.slice(0, 8),
    });

    // Create JWT token for the temporary user
    const jwtSecret = process.env.ISTACK_BUDDY_INTERNAL_JWT_SECRET;
    if (!jwtSecret) {
      throw new Error(
        'ISTACK_BUDDY_INTERNAL_JWT_SECRET environment variable is not set',
      );
    }

    const jwtToken = jwt.sign(
      {
        userId,
        email: `dev-session-${Date.now()}@istackbuddy.com`,
        username: userId,
        accountType: 'TEMPORARY_DEV',
        sessionId,
      },
      jwtSecret,
      { expiresIn: '8h' },
    );

    // Create and store the dev session
    const session: IDevSession = {
      sessionId,
      userId,
      jwtToken,
      createdAt: now,
      lastActivityAt: now,
      expiresInMs,
    };

    this.devSessions[jwtToken] = session;

    this.logger.logWithContext(
      'log',
      'Temporary dev user and session created',
      'AuthorizationPermissionsService.createDevUserAndSession',
      undefined,
      { sessionId, userId },
    );

    return {
      sessionId,
      userId,
      jwtToken,
    };
  }

  /**
   * Get a dev session by JWT token and update last activity
   * @param jwtToken The JWT token to look up
   * @returns The dev session if found and not expired, null otherwise
   */
  getDevSessionByJwtToken(jwtToken: string): IDevSession | null {
    const session = this.devSessions[jwtToken];
    if (!session) {
      return null;
    }

    // Check if session has expired
    const now = new Date();
    if (now.getTime() - session.createdAt.getTime() > session.expiresInMs) {
      delete this.devSessions[jwtToken];
      return null;
    }

    // Update last activity
    session.lastActivityAt = now;
    this.devSessions[jwtToken] = session;

    return session;
  }

  /**
   * Get a session by JWT token and update last activity
   * @param jwtToken The JWT token to look up
   * @returns The session if found and not expired, null otherwise
   */
  getSessionByJwt(jwtToken: string): IFormMarvSession | null {
    const session = this.formMarvSessions[jwtToken];

    if (!session) {
      return null;
    }

    // Check if session is expired
    const now = new Date();
    const expirationTime = new Date(
      session.createdAt.getTime() + session.expiresInMs,
    );

    if (now > expirationTime) {
      delete this.formMarvSessions[jwtToken];
      this.logger.logWithContext(
        'log',
        'Form-marv session expired and removed',
        'AuthorizationPermissionsService.getSessionByJwt',
        undefined,
        { jwtToken: jwtToken.substring(0, 20) + '...' },
      );
      return null;
    }

    // Update last activity
    session.lastActivityAt = now;
    this.formMarvSessions[jwtToken] = session;

    return session;
  }

  /**
   * Update an existing session
   * @param jwtToken The JWT token of the session to update
   * @param updatedSession The updated session data
   */
  updateSession(jwtToken: string, updatedSession: IFormMarvSession): void {
    this.formMarvSessions[jwtToken] = updatedSession;

    this.logger.logWithContext(
      'log',
      'Form-marv session updated',
      'AuthorizationPermissionsService.updateSession',
      undefined,
      { conversationId: updatedSession.conversationId },
    );
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [jwtToken, session] of Object.entries(this.formMarvSessions)) {
      const expirationTime = new Date(
        session.createdAt.getTime() + session.expiresInMs,
      );
      if (now > expirationTime) {
        expiredTokens.push(jwtToken);
      }
    }

    expiredTokens.forEach((token) => {
      delete this.formMarvSessions[token];
    });

    if (expiredTokens.length > 0) {
      this.logger.logWithContext(
        'log',
        'Cleaned up expired form-marv sessions',
        'AuthorizationPermissionsService.cleanupExpiredSessions',
        undefined,
        { expiredCount: expiredTokens.length },
      );
    }
  }

  /**
   * Get all active Form Marv sessions
   * @returns Array of all active sessions
   */
  getAllFormMarvSessions(): IFormMarvSession[] {
    // Clean up expired sessions first
    this.cleanupExpiredSessions();
    return Object.values(this.formMarvSessions);
  }

  /**
   * Get session statistics for debugging
   */
  getSessionStats(): { total: number; active: number } {
    const now = new Date();
    let activeCount = 0;

    for (const session of Object.values(this.formMarvSessions)) {
      const expirationTime = new Date(
        session.createdAt.getTime() + session.expiresInMs,
      );
      if (now <= expirationTime) {
        activeCount++;
      }
    }

    return {
      total: Object.keys(this.formMarvSessions).length,
      active: activeCount,
    };
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
