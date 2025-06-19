import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthService } from '../auth/auth.service';
import { UserAuthRequestDto } from './dto/user-auth-request.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';
import { DatabaseError } from 'pg';

@Injectable()
export class AuthenticationUserService {
  constructor(
    private readonly logger: CustomLoggerService,
    private readonly authService: AuthService,
  ) {}

  /**
   * External API endpoint for user authentication
   * Validates user credentials and returns permissions or throws 401
   * @param authRequest - User authentication request containing userId and jwtToken
   * @returns User permissions on success, throws UnauthorizedException on failure
   */
  public async authenticateUser(
    authRequest: UserAuthRequestDto,
  ): Promise<UserAuthResponseDto> {
    const { email, password } = authRequest;
    const logContext = { email, hasPassword: !!password };

    this.logger.logWithContext(
      'log',
      'External user authentication request received',
      'AuthenticationUserService.authenticateUser',
      undefined,
      logContext,
    );

    try {
      // Validate input parameters
      if (!email || !password) {
        this.logger.logWithContext(
          'warn',
          'Authentication request missing required parameters',
          'AuthenticationUserService.authenticateUser',
          undefined,
          { hasEmail: !!email, hasPassword: !!password },
        );
        throw new UnauthorizedException('Missing email or password');
      }

      // Use AuthService to authenticate by email/password
      const authResult =
        await this.authService.authenticateUserByEmailAndPassword(
          email,
          password,
        );

      if (!authResult.success) {
        this.logger.auditLog(
          'EXTERNAL_AUTH_FAILED',
          'failure',
          'AuthenticationUserService.authenticateUser',
          undefined,
          { email, reason: 'auth_service_failed' },
        );
        throw new UnauthorizedException('Authentication failed');
      }

      // Log successful external authentication
      this.logger.auditLog(
        'EXTERNAL_AUTH_SUCCESS',
        'success',
        'AuthenticationUserService.authenticateUser',
        undefined,
        {
          email,
          userId: authResult.userId,
          sessionId: authResult.sessionId,
          permissionCount: authResult.permissions?.length || 0,
        },
      );

      return {
        success: true,
        userId: authResult.userId!,
        email,
        jwtToken: authResult.jwtToken!,
        permissions: authResult.permissions || [],
        message: authResult.message || 'Authentication successful',
      };
    } catch (error) {
      // Log failed authentication attempt
      this.logger.auditLog(
        'EXTERNAL_AUTH_FAILED',
        'failure',
        'AuthenticationUserService.authenticateUser',
        undefined,
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error.constructor.name,
        },
      );

      // Re-throw UnauthorizedException as-is
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Check if this is a database-related error that should be fatal
      if (error instanceof DatabaseError) {
        this.logger.error(
          'AuthenticationUserService.authenticateUser',
          'FATAL: Database error during external authentication - re-throwing',
          error,
          { email, fatal: true },
        );
        // Re-throw database errors - these should be fatal and shutdown the app
        throw error;
      }

      // For any other non-auth errors, return 401 without exposing internal details
      throw new UnauthorizedException('Authentication failed');
    }
  }

  public async getUserProfile(jwtToken: string): Promise<any> {
    this.logger.logWithContext(
      'log',
      'User profile request received',
      'AuthenticationUserService.getUserProfile',
      undefined,
      { tokenLength: jwtToken.length },
    );

    try {
      // Extract user ID from the JWT token by querying the sessions table
      // In a real JWT implementation, you would decode the JWT to get the user ID
      const sessionInfo = await this.authService.getSessionByToken(jwtToken);

      if (!sessionInfo) {
        this.logger.logWithContext(
          'warn',
          'Invalid or expired authentication token',
          'AuthenticationUserService.getUserProfile',
          undefined,
          { tokenLength: jwtToken.length },
        );
        throw new UnauthorizedException(
          'Invalid or expired authentication token',
        );
      }

      // Check if the session is still valid (not expired)
      const isValidSession = await this.authService.isUserAuthenticated(
        sessionInfo.userId,
        jwtToken,
      );

      if (!isValidSession) {
        this.logger.logWithContext(
          'warn',
          'Authentication token has expired',
          'AuthenticationUserService.getUserProfile',
          undefined,
          { userId: sessionInfo.userId, tokenLength: jwtToken.length },
        );
        throw new UnauthorizedException('Authentication token has expired');
      }

      // Get user profile information
      const userProfile = await this.authService.getUserProfileById(
        sessionInfo.userId,
      );

      if (!userProfile) {
        this.logger.logWithContext(
          'warn',
          'User profile not found',
          'AuthenticationUserService.getUserProfile',
          undefined,
          { userId: sessionInfo.userId },
        );
        throw new UnauthorizedException('User profile not found');
      }

      // Get current permissions
      const permissions = await this.authService.getUserPermissionSet(
        sessionInfo.userId,
      );

      this.logger.logWithContext(
        'log',
        'User profile retrieved successfully',
        'AuthenticationUserService.getUserProfile',
        undefined,
        {
          userId: sessionInfo.userId,
          email: userProfile.email,
          permissionCount: permissions.length,
        },
      );

      return {
        success: true,
        userId: sessionInfo.userId,
        email: userProfile.email,
        username: userProfile.username,
        firstName: userProfile.first_name,
        lastName: userProfile.last_name,
        accountType: userProfile.account_type_informal,
        accountStatus: userProfile.current_account_status,
        permissions,
        lastLogin: userProfile.last_login_at,
        emailVerified: userProfile.is_email_verified,
      };
    } catch (error) {
      this.logger.auditLog(
        'PROFILE_ACCESS_FAILED',
        'failure',
        'AuthenticationUserService.getUserProfile',
        undefined,
        {
          tokenLength: jwtToken.length,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error.constructor.name,
        },
      );

      // Re-throw UnauthorizedException as-is
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // For any other errors, return 401 without exposing internal details
      throw new UnauthorizedException('Failed to retrieve user profile');
    }
  }
}
