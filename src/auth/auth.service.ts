import { Injectable } from '@nestjs/common';
import { Client, DatabaseError } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import {
  AuthenticationResult,
  SessionValidationResult,
} from './interfaces/auth-result.interface';
import {
  AuthSession,
  AuthSessionQueryResult,
} from './interfaces/auth-session.interface';

import { AuthenticationFailedException } from './exceptions/authentication-failed.exception';
import { SessionExpiredException } from './exceptions/session-expired.exception';

interface SessionConfig {
  sessionTimeoutSeconds: number;
  sessionCleanupIntervalMinutes: number;
  jwtSecret?: string;
  jwtExpiration?: string;
  jwtIssuer?: string;
}

@Injectable()
export class AuthService {
  private config: SessionConfig;
  private dbClient: Client | null = null;

  constructor(private readonly logger: CustomLoggerService) {
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    try {
      const configPath = path.join(
        process.cwd(),
        'config',
        'session-management.json',
      );
      const configFile = fs.readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configFile);

      this.logger.logWithContext(
        'debug',
        'Session management configuration loaded',
        'AuthService.loadConfiguration',
        undefined,
        { sessionTimeoutSeconds: this.config.sessionTimeoutSeconds },
      );
    } catch (error) {
      this.logger.error(
        'AuthService.loadConfiguration',
        'Failed to load session management configuration',
        error as Error,
        { configPath: 'config/session-management.json' },
      );

      // Fallback to default configuration
      this.config = {
        sessionTimeoutSeconds: 28800, // 8 hours
        sessionCleanupIntervalMinutes: 30,
      };
    }
  }

  private async ensureDatabaseConnection(): Promise<Client> {
    if (this.dbClient) {
      return this.dbClient;
    }

    try {
      // Load database configuration from config file
      const configPath = path.join(process.cwd(), 'config', 'database.json');
      const dbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const config = dbConfig.development; // Use development config for now

      this.dbClient = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
      });

      await this.dbClient.connect();

      this.logger.logWithContext(
        'log',
        'Database connection established for AuthService',
        'AuthService.ensureDatabaseConnection',
        undefined,
        {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
        },
      );

      return this.dbClient;
    } catch (error) {
      this.logger.error(
        'AuthService.ensureDatabaseConnection',
        'Failed to initialize database connection',
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Authenticates user by email and password
   * @param email - User email address
   * @param password - User password
   * @returns Authentication result with JWT token and session information
   */
  async authenticateUserByEmailAndPassword(
    email: string,
    password: string,
  ): Promise<AuthenticationResult> {
    const logContext = { email, hasPassword: !!password };

    this.logger.logWithContext(
      'log',
      'Email/password authentication attempt started',
      'AuthService.authenticateUserByEmailAndPassword',
      undefined,
      logContext,
    );

    try {
      // Validate input parameters
      if (!email || !password) {
        throw new AuthenticationFailedException('Missing email or password');
      }

      // Look up user by email and validate password
      const userInfo = await this.validateUserCredentials(email, password);
      if (!userInfo) {
        this.logger.auditLog(
          'EMAIL_AUTH_FAILED',
          'failure',
          'AuthService.authenticateUserByEmailAndPassword',
          undefined,
          { email, reason: 'invalid_credentials' },
        );
        throw new AuthenticationFailedException('Invalid email or password');
      }

      const { userId } = userInfo;

      // Generate JWT token (placeholder for now)
      // TODO: Replace with proper JWT generation
      const jwtToken = `jwt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create authentication session
      const sessionId = await this.createOrUpdateSession(userId, jwtToken);

      // Cache user permissions
      const permissions = await this.cacheUserPermissions(userId, sessionId);

      // Log successful authentication
      this.logger.auditLog(
        'EMAIL_AUTH_SUCCESS',
        'success',
        'AuthService.authenticateUserByEmailAndPassword',
        undefined,
        { email, userId, sessionId, permissionCount: permissions.length },
      );

      return {
        success: true,
        sessionId,
        userId,
        permissions,
        message: 'Authentication successful',
        jwtToken, // Return the JWT token
      };
    } catch (error) {
      this.logger.auditLog(
        'EMAIL_AUTH_FAILED',
        'failure',
        'AuthService.authenticateUserByEmailAndPassword',
        undefined,
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      if (error instanceof AuthenticationFailedException) {
        throw error;
      }

      // For any other error type, log and re-throw - don't catch what we can't handle
      this.logger.error(
        'AuthService.authenticateUserByEmailAndPassword',
        'Unexpected error during authentication - re-throwing',
        error as Error,
        { email },
      );
      throw error;
    }
  }

  /**
   * Validates JWT token and creates/updates authentication session
   * @param userId - User ID to authenticate
   * @param jwtToken - JWT token to validate
   * @returns Authentication result with session information
   */
  async authenticateUser(
    userId: string,
    jwtToken: string,
  ): Promise<AuthenticationResult> {
    const logContext = { userId, tokenLength: jwtToken.length };

    this.logger.logWithContext(
      'log',
      'Authentication attempt started',
      'AuthService.authenticateUser',
      undefined,
      logContext,
    );

    try {
      // TODO: Implement proper JWT validation
      // Current implementation: Accept any token with length > 10 characters
      if (!this.isValidToken(jwtToken)) {
        throw new AuthenticationFailedException(
          'Invalid JWT token format',
          userId,
        );
      }

      // Verify user exists in database
      const userExists = await this.verifyUserExists(userId);
      if (!userExists) {
        throw new AuthenticationFailedException('User not found', userId);
      }

      // Create or update authentication session
      const sessionId = await this.createOrUpdateSession(userId, jwtToken);

      // Cache user permissions
      const permissions = await this.cacheUserPermissions(userId, sessionId);

      // Log successful authentication
      this.logger.auditLog(
        'SESSION_ACTIVATED',
        'success',
        'AuthService.authenticateUser',
        undefined,
        { userId, sessionId, permissionCount: permissions.length },
      );

      return {
        success: true,
        sessionId,
        userId,
        permissions,
        message: 'Authentication successful',
      };
    } catch (error) {
      this.logger.auditLog(
        'SESSION_ACTIVATION_FAILED',
        'failure',
        'AuthService.authenticateUser',
        undefined,
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      if (error instanceof AuthenticationFailedException) {
        throw error;
      }

      // For any other error type, log and re-throw - don't catch what we can't handle
      this.logger.error(
        'AuthService.authenticateUser',
        'Unexpected error during JWT authentication - re-throwing',
        error as Error,
        { userId },
      );
      throw error;
    }
  }

  /**
   * Checks if user session is valid and active
   * @param userId - User ID to check
   * @param jwtToken - JWT token to validate
   * @returns True if session is valid and active
   */
  async isUserAuthenticated(
    userId: string,
    jwtToken: string,
  ): Promise<boolean> {
    const logContext = { userId, tokenLength: jwtToken.length };

    this.logger.logWithContext(
      'debug',
      'Session validation check started',
      'AuthService.isUserAuthenticated',
      undefined,
      logContext,
    );

    try {
      // Find active session for user/token combination
      const session = await this.findActiveSession(userId, jwtToken);

      if (!session) {
        this.logger.logWithContext(
          'debug',
          'No active session found',
          'AuthService.isUserAuthenticated',
          undefined,
          logContext,
        );
        return false;
      }

      // Check if session is within timeout period
      const now = new Date();
      const lastAccess = new Date(session.last_access_time);
      const sessionAge = (now.getTime() - lastAccess.getTime()) / 1000;

      if (sessionAge > this.config.sessionTimeoutSeconds) {
        // Session expired - remove it and log deactivation
        await this.removeExpiredSession(session.id);

        this.logger.auditLog(
          'SESSION_DEACTIVATED',
          'success',
          'AuthService.isUserAuthenticated',
          undefined,
          {
            userId,
            sessionId: session.id,
            reason: 'timeout',
            sessionDuration: sessionAge,
          },
        );

        return false;
      }

      // Update last_access_time for valid session
      await this.updateSessionAccess(session.id);

      this.logger.logWithContext(
        'debug',
        'Session validation successful',
        'AuthService.isUserAuthenticated',
        undefined,
        { ...logContext, sessionId: session.id },
      );

      return true;
    } catch (error) {
      this.logger.error(
        'AuthService.isUserAuthenticated',
        'Session validation failed',
        error as Error,
        logContext,
      );
      return false;
    }
  }

  /**
   * Retrieves user's effective permissions (combined group and individual permissions)
   * @param userId - User ID to get permissions for
   * @returns Array of permission strings
   */
  async getUserPermissionSet(userId: string): Promise<string[]> {
    this.logger.logWithContext(
      'debug',
      'Retrieving user permission set',
      'AuthService.getUserPermissionSet',
      undefined,
      { userId },
    );

    try {
      // First try to get cached permissions from active session
      const cachedPermissions = await this.getCachedPermissions(userId);

      if (cachedPermissions.length > 0) {
        this.logger.logWithContext(
          'debug',
          'Using cached permissions from session',
          'AuthService.getUserPermissionSet',
          undefined,
          { userId, permissionCount: cachedPermissions.length },
        );
        return cachedPermissions;
      }

      // If no active session, fetch permissions from database
      const permissions = await this.fetchUserPermissionsFromDatabase(userId);

      this.logger.logWithContext(
        'debug',
        'Fetched permissions from database',
        'AuthService.getUserPermissionSet',
        undefined,
        { userId, permissionCount: permissions.length },
      );

      return permissions;
    } catch (error) {
      this.logger.error(
        'AuthService.getUserPermissionSet',
        'Failed to retrieve user permissions',
        error as Error,
        { userId },
      );
      return [];
    }
  }

  // Private helper methods

  private isValidToken(token: string): boolean {
    // TODO: Replace with proper JWT validation
    // Current implementation: Accept any token with length > 10 characters
    return token && token.length > 10;
  }

  private async verifyUserExists(userId: string): Promise<boolean> {
    try {
      const dbClient = await this.ensureDatabaseConnection();
      const result = await dbClient.query(
        'SELECT id FROM users WHERE id = $1',
        [userId],
      );
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error(
        'AuthService.verifyUserExists',
        'Database query failed',
        error as Error,
        { userId },
      );
      return false;
    }
  }

  private async createOrUpdateSession(
    userId: string,
    jwtToken: string,
  ): Promise<string> {
    try {
      const dbClient = await this.ensureDatabaseConnection();

      // Check if session already exists for this user/token combination
      const existingSession = await dbClient.query(
        'SELECT id FROM user_authentication_sessions WHERE user_id = $1 AND jwt_token = $2',
        [userId, jwtToken],
      );

      if (existingSession.rows.length > 0) {
        // Update existing session
        const sessionId = existingSession.rows[0].id;
        await dbClient.query(
          'UPDATE user_authentication_sessions SET last_access_time = NOW(), updated_at = NOW() WHERE id = $1',
          [sessionId],
        );
        return sessionId;
      } else {
        // Create new session
        const result = await dbClient.query(
          `INSERT INTO user_authentication_sessions 
           (user_id, jwt_token, group_permission_chain, user_permission_chain, group_memberships) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING id`,
          [userId, jwtToken, '[]', '[]', '[]'],
        );
        return result.rows[0].id;
      }
    } catch (error) {
      this.logger.error(
        'AuthService.createOrUpdateSession',
        'Failed to create/update session',
        error as Error,
        { userId },
      );
      throw error;
    }
  }

  private async cacheUserPermissions(
    userId: string,
    sessionId: string,
  ): Promise<string[]> {
    try {
      const permissions = await this.fetchUserPermissionsFromDatabase(userId);
      const groupMemberships = await this.fetchUserGroupMemberships(userId);

      const dbClient = await this.ensureDatabaseConnection();
      // Update session with cached permissions
      await dbClient.query(
        `UPDATE user_authentication_sessions 
         SET user_permission_chain = $1, group_memberships = $2, updated_at = NOW() 
         WHERE id = $3`,
        [
          JSON.stringify(permissions),
          JSON.stringify(groupMemberships),
          sessionId,
        ],
      );

      return permissions;
    } catch (error) {
      this.logger.error(
        'AuthService.cacheUserPermissions',
        'Failed to cache permissions',
        error as Error,
        { userId, sessionId },
      );
      return [];
    }
  }

  private async findActiveSession(
    userId: string,
    jwtToken: string,
  ): Promise<AuthSessionQueryResult | null> {
    try {
      const dbClient = await this.ensureDatabaseConnection();
      const result = await dbClient.query(
        'SELECT * FROM user_authentication_sessions WHERE user_id = $1 AND jwt_token = $2',
        [userId, jwtToken],
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.logger.error(
        'AuthService.findActiveSession',
        'Database query failed',
        error as Error,
        { userId },
      );
      return null;
    }
  }

  private async removeExpiredSession(sessionId: string): Promise<void> {
    try {
      const dbClient = await this.ensureDatabaseConnection();
      await dbClient.query(
        'DELETE FROM user_authentication_sessions WHERE id = $1',
        [sessionId],
      );
    } catch (error) {
      this.logger.error(
        'AuthService.removeExpiredSession',
        'Failed to remove expired session',
        error as Error,
        { sessionId },
      );
    }
  }

  private async updateSessionAccess(sessionId: string): Promise<void> {
    try {
      const dbClient = await this.ensureDatabaseConnection();
      await dbClient.query(
        'UPDATE user_authentication_sessions SET last_access_time = NOW(), updated_at = NOW() WHERE id = $1',
        [sessionId],
      );
    } catch (error) {
      this.logger.error(
        'AuthService.updateSessionAccess',
        'Failed to update session access time',
        error as Error,
        { sessionId },
      );
    }
  }

  private async getCachedPermissions(userId: string): Promise<string[]> {
    try {
      const dbClient = await this.ensureDatabaseConnection();
      const result = await dbClient.query(
        `SELECT user_permission_chain, group_permission_chain 
         FROM user_authentication_sessions 
         WHERE user_id = $1 
         AND (NOW() - last_access_time) < INTERVAL '${this.config.sessionTimeoutSeconds} seconds'
         ORDER BY last_access_time DESC 
         LIMIT 1`,
        [userId],
      );

      if (result.rows.length > 0) {
        const userPermissions = JSON.parse(
          result.rows[0].user_permission_chain || '[]',
        );
        const groupPermissions = JSON.parse(
          result.rows[0].group_permission_chain || '[]',
        );

        // Combine and deduplicate permissions
        const allPermissions = [...userPermissions, ...groupPermissions];
        return [...new Set(allPermissions)];
      }

      return [];
    } catch (error) {
      this.logger.error(
        'AuthService.getCachedPermissions',
        'Failed to get cached permissions',
        error as Error,
        { userId },
      );
      return [];
    }
  }

  private async fetchUserPermissionsFromDatabase(
    userId: string,
  ): Promise<string[]> {
    try {
      const dbClient = await this.ensureDatabaseConnection();

      // Get individual user permissions
      const userPermissions = await dbClient.query(
        `SELECT permission_id 
         FROM access_permission_assignments_user 
         WHERE user_id = $1 AND allow_deny = 'ALLOW'`,
        [userId],
      );

      // Get group permissions through memberships
      const groupPermissions = await dbClient.query(
        `SELECT DISTINCT apag.permission_id 
         FROM access_permission_assignments_group apag
         JOIN user_permission_group_membership apgm ON apag.permission_group_id = apgm.permission_group_id
         WHERE apgm.user_id = $1 AND apgm.status = 'ACTIVE' AND apag.allow_deny = 'ALLOW'`,
        [userId],
      );

      // Combine permissions
      const allPermissions = [
        ...userPermissions.rows.map((row) => row.permission_id),
        ...groupPermissions.rows.map((row) => row.permission_id),
      ];

      // Return deduplicated permissions
      return [...new Set(allPermissions)];
    } catch (error) {
      this.logger.error(
        'AuthService.fetchUserPermissionsFromDatabase',
        'Failed to fetch permissions from database',
        error as Error,
        { userId },
      );
      return [];
    }
  }

  private async fetchUserGroupMemberships(userId: string): Promise<string[]> {
    try {
      const dbClient = await this.ensureDatabaseConnection();
      const result = await dbClient.query(
        `SELECT upg.name 
         FROM user_permission_groups upg
         JOIN user_permission_group_membership apgm ON upg.id = apgm.permission_group_id
         WHERE apgm.user_id = $1 AND apgm.status = 'ACTIVE'`,
        [userId],
      );

      return result.rows.map((row) => row.name);
    } catch (error) {
      this.logger.error(
        'AuthService.fetchUserGroupMemberships',
        'Failed to fetch group memberships',
        error as Error,
        { userId },
      );
      return [];
    }
  }

  /**
   * Validates user credentials against the database
   * @param email - User email address
   * @param password - User password
   * @returns User info if valid, null if invalid
   */
  private async validateUserCredentials(
    email: string,
    password: string,
  ): Promise<{ userId: string; email: string } | null> {
    try {
      const dbClient = await this.ensureDatabaseConnection();

      // Look up user by email from user_profiles and get password from user_logins
      const result = await dbClient.query(
        `SELECT up.user_id, up.email, ul.password_hash 
         FROM user_profiles up
         JOIN user_logins ul ON up.user_id = ul.user_id
         WHERE up.email = $1 AND up.current_account_status = $2`,
        [email, 'ACTIVE'],
      );

      if (result.rows.length === 0) {
        this.logger.logWithContext(
          'debug',
          'User not found or not active',
          'AuthService.validateUserCredentials',
          undefined,
          { email },
        );
        return null;
      }

      const user = result.rows[0];

      // TODO: Implement proper password hashing verification
      // For now, we'll use a simple comparison since the seed data uses placeholder hashes
      // In production, this should use bcrypt.compare() or similar
      const isValidPassword = this.verifyPassword(password, user.password_hash);

      if (!isValidPassword) {
        this.logger.logWithContext(
          'debug',
          'Invalid password provided',
          'AuthService.validateUserCredentials',
          undefined,
          { email },
        );
        return null;
      }

      return {
        userId: user.user_id,
        email: user.email,
      };
    } catch (error) {
      this.logger.error(
        'AuthService.validateUserCredentials',
        'Database query failed',
        error as Error,
        { email },
      );

      // Check if this is a database-related error that should be fatal
      if (error instanceof DatabaseError) {
        this.logger.error(
          'AuthService.validateUserCredentials',
          'FATAL: Database error during credential validation - re-throwing',
          error,
          { email, fatal: true },
        );
        // Re-throw database errors - caller should handle fatal errors
      }
      throw error;
    }
  }

  /**
   * Verify password against stored hash
   * TODO: Replace with proper bcrypt verification in production
   */
  private verifyPassword(password: string, hash: string): boolean {
    // For development with placeholder hashes, accept any password for seed users
    if (hash.includes('placeholder.hash.for.development')) {
      return true;
    }

    // TODO: Implement proper password verification
    // return bcrypt.compare(password, hash);

    // For now, simple string comparison (NOT SECURE - development only)
    return password === hash;
  }

  /**
   * Get session information by JWT token
   * @param jwtToken - JWT token to look up
   * @returns Session info if found, null otherwise
   */
  async getSessionByToken(
    jwtToken: string,
  ): Promise<{ userId: string; sessionId: string } | null> {
    try {
      const dbClient = await this.ensureDatabaseConnection();
      const result = await dbClient.query(
        'SELECT user_id, id as session_id FROM user_authentication_sessions WHERE jwt_token = $1',
        [jwtToken],
      );

      if (result.rows.length === 0) {
        this.logger.logWithContext(
          'debug',
          'No session found for JWT token',
          'AuthService.getSessionByToken',
          undefined,
          { tokenLength: jwtToken.length },
        );
        return null;
      }

      return {
        userId: result.rows[0].user_id,
        sessionId: result.rows[0].session_id,
      };
    } catch (error) {
      this.logger.error(
        'AuthService.getSessionByToken',
        'Database query failed',
        error as Error,
        { tokenLength: jwtToken.length },
      );

      if (error instanceof DatabaseError) {
        this.logger.error(
          'AuthService.getSessionByToken',
          'FATAL: Database error during session lookup - re-throwing',
          error,
          { jwtToken: jwtToken.substring(0, 10) + '...', fatal: true },
        );
        throw error;
      }

      return null;
    }
  }

  /**
   * Get user profile information by user ID
   * @param userId - User ID to get profile for
   * @returns User profile if found, null otherwise
   */
  async getUserProfileById(userId: string): Promise<any | null> {
    try {
      const dbClient = await this.ensureDatabaseConnection();
      const result = await dbClient.query(
        `SELECT up.email, up.username, up.first_name, up.last_name, 
                up.account_type_informal, up.current_account_status, 
                up.last_login_at, up.is_email_verified, up.ui_handle,
                up.display_name, up.bio_about_me, up.location_text,
                up.profile_visibility
         FROM user_profiles up 
         WHERE up.user_id = $1`,
        [userId],
      );

      if (result.rows.length === 0) {
        this.logger.logWithContext(
          'debug',
          'User profile not found',
          'AuthService.getUserProfileById',
          undefined,
          { userId },
        );
        return null;
      }

      return result.rows[0];
    } catch (error) {
      this.logger.error(
        'AuthService.getUserProfileById',
        'Database query failed',
        error as Error,
        { userId },
      );

      if (error instanceof DatabaseError) {
        this.logger.error(
          'AuthService.getUserProfileById',
          'FATAL: Database error during profile lookup - re-throwing',
          error,
          { userId, fatal: true },
        );
        throw error;
      }

      return null;
    }
  }
}
