import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { UserProfileService } from '../user-profile/user-profile.service';
import { AuthenticationFailedException } from './exceptions/authentication-failed.exception';

// Import JSON files directly for compile-time checking
import sessionConfig from '../../config/session-management.json';

const JWT_SECRET = 'istack-buddy-secret-key-2024';

interface SessionConfig {
  sessionTimeoutSeconds: number;
  sessionCleanupIntervalMinutes: number;
  jwtSecret?: string;
  jwtExpiration?: string;
  jwtIssuer?: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  accountType: string;
  iat: number;
  exp: number;
}

interface AuthenticationResult {
  success: boolean;
  userId?: string;
  jwtToken?: string;
  sessionId?: string;
  error?: string;
}

@Injectable()
export class AuthenticationService {
  private config: SessionConfig;

  constructor(
    private readonly logger: CustomLoggerService,
    private readonly authPermissionsService: AuthorizationPermissionsService,
    private readonly userProfileService: UserProfileService,
  ) {
    // Use imported JSON data directly
    this.config = sessionConfig;

    this.logger.logWithContext(
      'debug',
      'Authentication service initialized with configuration',
      'AuthenticationService.constructor',
      undefined,
      { sessionTimeoutSeconds: this.config.sessionTimeoutSeconds },
    );
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

      // Find user by email using UserProfileService
      const userProfile =
        await this.userProfileService.getUserProfileByEmail(email);
      if (!userProfile) {
        throw new AuthenticationFailedException('User not found');
      }

      // TODO: Add password validation logic here
      // For now, assume any password is valid for existing users
      if (!password || password.length < 1) {
        throw new AuthenticationFailedException('Invalid password');
      }

      // Generate JWT token
      const jwtToken = jwt.sign(
        {
          userId: userProfile.id,
          email: userProfile.email,
          username: userProfile.username,
          accountType: userProfile.account_type_informal,
        },
        JWT_SECRET,
        { expiresIn: '8h' },
      );

      this.logger.logWithContext(
        'log',
        'Email/password authentication successful',
        'AuthenticationService.authenticateUserByEmailAndPassword',
        undefined,
        { userId: userProfile.id, email },
      );

      return {
        success: true,
        userId: userProfile.id,
        jwtToken,
        sessionId: `session-${userProfile.id}-${Date.now()}`,
      };
    } catch (error) {
      this.logger.error(
        'AuthenticationService.authenticateUserByEmailAndPassword',
        'Email/password authentication failed',
        error as Error,
        logContext,
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Authenticates a user using JWT token.
   */
  public async authenticateUser(
    userId: string,
    jwtToken: string,
  ): Promise<AuthenticationResult> {
    const logContext = { userId, hasToken: !!jwtToken };

    this.logger.logWithContext(
      'log',
      'JWT authentication attempt started',
      'AuthenticationService.authenticateUser',
      undefined,
      logContext,
    );

    try {
      // Validate input parameters
      if (!userId || !jwtToken) {
        throw new AuthenticationFailedException('Missing userId or JWT token');
      }

      // Verify JWT token
      const decoded = jwt.verify(jwtToken, JWT_SECRET) as JWTPayload;

      // Check if the token belongs to the specified user
      if (decoded.userId !== userId) {
        throw new AuthenticationFailedException(
          'JWT token does not match user ID',
        );
      }

      // Check if user exists using UserProfileService
      const userProfile =
        await this.userProfileService.getUserProfileById(userId);
      if (!userProfile) {
        throw new AuthenticationFailedException('User not found');
      }

      this.logger.logWithContext(
        'log',
        'JWT authentication successful',
        'AuthenticationService.authenticateUser',
        undefined,
        { userId, email: decoded.email },
      );

      return {
        success: true,
        userId,
        jwtToken,
        sessionId: `session-${userId}-${Date.now()}`,
      };
    } catch (error) {
      this.logger.error(
        'AuthenticationService.authenticateUser',
        'JWT authentication failed',
        error as Error,
        logContext,
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Checks if a user is authenticated using JWT token.
   */
  public async isUserAuthenticated(
    userId: string,
    jwtToken: string,
  ): Promise<boolean> {
    try {
      const result = await this.authenticateUser(userId, jwtToken);
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets user permissions using AuthorizationPermissionsService.
   */
  public async getUserPermissionSet(userId: string): Promise<string[]> {
    try {
      return await this.authPermissionsService.getUserPermissions(userId);
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
   * Gets user profile by ID using UserProfileService.
   */
  public async getUserProfileById(userId: string): Promise<any | null> {
    try {
      return await this.userProfileService.getUserProfileById(userId);
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
