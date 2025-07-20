import { Injectable } from '@nestjs/common';
import { AuthDto, AuthResponseDto } from './dto/auth.dto';
import { UserDetailsDto } from './dto/user-details.dto';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthenticationService } from '../authentication/authentication.service';

@Injectable()
export class DevDebugService {
  constructor(
    private readonly logger: CustomLoggerService,
    private readonly authService: AuthenticationService,
  ) {}
  /**
   * Debug authentication endpoint
   * Now integrated with actual AuthService for testing
   */
  async authenticate(authData: AuthDto): Promise<AuthResponseDto> {
    this.logger.logWithContext(
      'log',
      'Dev-debug authentication attempt - using real AuthService',
      'DevDebugService.authenticate',
      undefined,
      { hasCredentials: !!authData },
    );

    try {
      // Use the real AuthService for authentication
      const authResult = await this.authService.authenticateUser(
        authData.userId || 'dev-debug-user',
        authData.token || 'dev-debug-token-placeholder-12345',
      );

      const result = {
        success: authResult.success,
        message: `${authResult.message} (via AuthService)`,
        sessionId: authResult.sessionId,
        permissions: authResult.permissions,
      };

      this.logger.auditLog(
        'DEV_DEBUG_AUTH',
        'success',
        'DevDebugService.authenticate',
        undefined,
        { result, authServiceUsed: true },
      );

      return result;
    } catch (error) {
      const result = {
        success: false,
        message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };

      this.logger.auditLog(
        'DEV_DEBUG_AUTH',
        'failure',
        'DevDebugService.authenticate',
        undefined,
        {
          result,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      return result;
    }
  }

  /**
   * Get user details by user ID
   * Now includes authentication status and permissions
   */
  async getUserDetails(userId: string): Promise<UserDetailsDto> {
    this.logger.logWithContext(
      'debug',
      `Getting user details for userId: ${userId}`,
      'DevDebugService.getUserDetails',
      undefined,
      { userId },
    );

    try {
      // Test getUserPermissionSet method
      const permissions = await this.authService.getUserPermissionSet(userId);

      return {
        userId,
        permissions,
        permissionCount: permissions.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'DevDebugService.getUserDetails',
        'Failed to get user details',
        error as Error,
        { userId },
      );

      return {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test authentication status endpoint
   * Tests the isUserAuthenticated method
   */
  async testAuthenticationStatus(userId: string, token: string): Promise<any> {
    this.logger.logWithContext(
      'debug',
      'Testing authentication status',
      'DevDebugService.testAuthenticationStatus',
      undefined,
      { userId, tokenLength: token.length },
    );

    try {
      const isAuthenticated = await this.authService.isUserAuthenticated(
        userId,
        token,
      );

      return {
        userId,
        token: token.substring(0, 10) + '...',
        isAuthenticated,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'DevDebugService.testAuthenticationStatus',
        'Failed to test authentication status',
        error as Error,
        { userId },
      );

      return {
        userId,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get all users list
   * Returns mock user data for development/debugging
   */
  async getAllUsers(): Promise<any[]> {
    this.logger.logWithContext(
      'debug',
      'Getting all users list (mock data)',
      'DevDebugService.getAllUsers',
    );

    // Mock user data for development/debugging
    return [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'john_doe',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        accountType: 'student',
        status: 'active',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        username: 'jane_smith',
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        accountType: 'instructor',
        status: 'active',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        username: 'admin_user',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        accountType: 'administrator',
        status: 'active',
      },
    ];
  }
}
