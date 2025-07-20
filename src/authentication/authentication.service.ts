import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthenticationResult } from './interfaces/auth-result.interface';
import { AuthenticationFailedException } from './exceptions/authentication-failed.exception';

interface SessionConfig {
  sessionTimeoutSeconds: number;
  sessionCleanupIntervalMinutes: number;
  jwtSecret?: string;
  jwtExpiration?: string;
  jwtIssuer?: string;
}

interface UserPermissions {
  user_permissions: {
    [userId: string]: {
      permissions: string[];
      jwtToken: string;
    };
  };
}

interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  accountType: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = 'istack-buddy-secret-key-2024';

@Injectable()
export class AuthenticationService {
  private config: SessionConfig;
  private userPermissions: UserPermissions | null = null;

  constructor(private readonly logger: CustomLoggerService) {
    this.loadConfiguration();
    this.loadUserPermissions();
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
        'AuthenticationService.loadConfiguration',
        undefined,
        { sessionTimeoutSeconds: this.config.sessionTimeoutSeconds },
      );
    } catch (error) {
      this.logger.error(
        'AuthenticationService.loadConfiguration',
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

  private loadUserPermissions(): void {
    try {
      const permissionsPath = path.join(
        process.cwd(),
        'src',
        'authorization-permissions',
        'user-permissions.json',
      );
      const permissionsFile = fs.readFileSync(permissionsPath, 'utf8');
      this.userPermissions = JSON.parse(permissionsFile);

      this.logger.logWithContext(
        'debug',
        'User permissions loaded',
        'AuthenticationService.loadUserPermissions',
        undefined,
        {
          userCount: Object.keys(this.userPermissions!.user_permissions).length,
        },
      );
    } catch (error) {
      this.logger.error(
        'AuthenticationService.loadUserPermissions',
        'Failed to load user permissions',
        error as Error,
        {
          permissionsPath:
            'src/authorization-permissions/user-permissions.json',
        },
      );
      this.userPermissions = null;
    }
  }

  /**
   * Authenticates a user using email and password credentials.
   */
  public async authenticateUserByEmailAndPassword(
    email: string,
    password: string,
  ): Promise<AuthenticationResult> {
    const logContext = { email, hasPassword: !!password };

    this.logger.logWithContext(
      'log',
      'Email/password authentication attempt started',
      'AuthenticationService.authenticateUserByEmailAndPassword',
      undefined,
      logContext,
    );

    try {
      // Validate input parameters
      if (!email || !password) {
        throw new AuthenticationFailedException('Missing email or password');
      }

      // Load user profiles to find user by email
      const profilesPath = path.join(
        process.cwd(),
        'src',
        'user-profile',
        'user-profiles.json',
      );
      const profilesFile = fs.readFileSync(profilesPath, 'utf8');
      const profiles = JSON.parse(profilesFile);

      // Find user by email
      let userId = null;
      for (const [id, profile] of Object.entries(profiles.users)) {
        if ((profile as any).email === email) {
          userId = id;
          break;
        }
      }

      if (!userId) {
        throw new AuthenticationFailedException('Invalid email or password');
      }

      // For now, accept any password for existing users
      // TODO: Implement proper password validation
      if (password !== 'password123') {
        throw new AuthenticationFailedException('Invalid email or password');
      }

      // Get user permissions
      const permissions = await this.getUserPermissionSet(userId);

      // Generate JWT token
      const jwtToken = jwt.sign(
        {
          userId,
          email,
          username: profiles.users[userId].username,
          accountType: profiles.users[userId].account_type_informal,
        },
        JWT_SECRET,
        { expiresIn: '8h' },
      );

      const sessionId = `session-${userId}-${Date.now()}`;

      // Log successful authentication
      this.logger.auditLog(
        'EMAIL_AUTH_SUCCESS',
        'success',
        'AuthenticationService.authenticateUserByEmailAndPassword',
        undefined,
        { email, userId, sessionId, permissionCount: permissions.length },
      );

      return {
        success: true,
        sessionId,
        userId,
        permissions,
        message: 'Authentication successful',
        jwtToken,
      };
    } catch (error) {
      this.logger.auditLog(
        'EMAIL_AUTH_FAILED',
        'failure',
        'AuthenticationService.authenticateUserByEmailAndPassword',
        undefined,
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      if (error instanceof AuthenticationFailedException) {
        throw error;
      }

      throw new AuthenticationFailedException('Authentication failed');
    }
  }

  /**
   * Validates a JWT token and returns user information.
   */
  public async authenticateUser(
    userId: string,
    jwtToken: string,
  ): Promise<AuthenticationResult> {
    this.logger.logWithContext(
      'log',
      'Authentication attempt started',
      'AuthenticationService.authenticateUser',
      undefined,
      { userId },
    );

    try {
      // Validate JWT token format
      if (!this.isValidToken(jwtToken)) {
        throw new AuthenticationFailedException(
          'Invalid JWT token format',
          userId,
        );
      }

      // TODO: Verify user exists in file-based storage
      // For now, assume user exists

      // TODO: Create or update session in file-based storage
      const sessionId = `session-${Date.now()}`;

      // TODO: Get permissions from file-based storage
      const permissions = ['auth:user', 'auth:user:{self}'];

      // Log successful authentication
      this.logger.auditLog(
        'SESSION_ACTIVATED',
        'success',
        'AuthenticationService.authenticateUser',
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
        'AuthenticationService.authenticateUser',
        undefined,
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      if (error instanceof AuthenticationFailedException) {
        throw error;
      }

      throw error;
    }
  }

  /**
   * Checks if a user's authentication session is valid and active.
   */
  public async isUserAuthenticated(
    userId: string,
    jwtToken: string,
  ): Promise<boolean> {
    try {
      // TODO: Implement file-based session validation
      // For now, return true if token format is valid
      return this.isValidToken(jwtToken);
    } catch (error) {
      this.logger.error(
        'AuthenticationService.isUserAuthenticated',
        'Failed to validate user authentication',
        error as Error,
        { userId },
      );
      return false;
    }
  }

  /**
   * Gets the user's permission set.
   */
  public async getUserPermissionSet(userId: string): Promise<string[]> {
    this.logger.logWithContext(
      'debug',
      'Retrieving user permission set',
      'AuthenticationService.getUserPermissionSet',
      undefined,
      { userId },
    );

    try {
      if (!this.userPermissions) {
        this.logger.error(
          'AuthenticationService.getUserPermissionSet',
          'User permissions not loaded',
          new Error('User permissions not available'),
          { userId },
        );
        return [];
      }

      const userData = this.userPermissions.user_permissions[userId];
      if (!userData) {
        this.logger.logWithContext(
          'debug',
          'User not found in permissions',
          'AuthenticationService.getUserPermissionSet',
          undefined,
          { userId },
        );
        return [];
      }

      return userData.permissions;
    } catch (error) {
      this.logger.error(
        'AuthenticationService.getUserPermissionSet',
        'Failed to retrieve user permissions',
        error as Error,
        { userId },
      );
      return [];
    }
  }

  /**
   * Gets session information by JWT token.
   */
  public async getSessionByToken(
    jwtToken: string,
  ): Promise<{ userId: string; sessionId: string } | null> {
    try {
      // Decode and verify JWT token
      const decoded = jwt.verify(jwtToken, JWT_SECRET) as JWTPayload;

      this.logger.logWithContext(
        'debug',
        'JWT token decoded successfully',
        'AuthenticationService.getSessionByToken',
        undefined,
        { userId: decoded.userId, email: decoded.email },
      );

      return {
        userId: decoded.userId,
        sessionId: `session-${decoded.userId}-${Date.now()}`,
      };
    } catch (error) {
      this.logger.logWithContext(
        'debug',
        'JWT token verification failed',
        'AuthenticationService.getSessionByToken',
        undefined,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tokenLength: jwtToken.length,
        },
      );
      return null;
    }
  }

  /**
   * Gets user profile by ID.
   */
  public async getUserProfileById(userId: string): Promise<any | null> {
    try {
      const profilesPath = path.join(
        process.cwd(),
        'src',
        'user-profile',
        'user-profiles.json',
      );
      const profilesFile = fs.readFileSync(profilesPath, 'utf8');
      const profiles = JSON.parse(profilesFile);

      const userProfile = profiles.users[userId];
      if (!userProfile) {
        this.logger.logWithContext(
          'debug',
          'User profile not found',
          'AuthenticationService.getUserProfileById',
          undefined,
          { userId },
        );
        return null;
      }

      return userProfile;
    } catch (error) {
      this.logger.error(
        'AuthenticationService.getUserProfileById',
        'Failed to get user profile',
        error as Error,
        { userId },
      );
      return null;
    }
  }

  private isValidToken(token: string): boolean {
    try {
      // Verify JWT token
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch (error) {
      return false;
    }
  }
}
