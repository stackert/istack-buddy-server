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
  async authenticateUser(
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
}
