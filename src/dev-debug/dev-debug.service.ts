import { Injectable } from '@nestjs/common';
import { AuthDto, AuthResponseDto } from './dto/auth.dto';
import { UserDetailsDto } from './dto/user-details.dto';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import {
  FileManagerService,
  STORAGE_CLASS,
} from '../file-manager/file-manager.service';
import { IntentRouterService } from '../common/services/intent-router.service';
import { IntentParsingResponse } from '../common/types/intent-parsing.types';

@Injectable()
export class DevDebugService {
  constructor(
    private readonly logger: CustomLoggerService,
    private readonly authService: AuthenticationService,
    private readonly iStackInfoService: IStackInfoService,
    private readonly fileManagerService: FileManagerService,
    private readonly intentRouterService: IntentRouterService,
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
        message: authResult.success
          ? 'Authentication successful (via AuthService)'
          : authResult.error || 'Authentication failed (via AuthService)',
        sessionId: authResult.sessionId,
        permissions: [], // Permissions are now handled separately via getUserPermissionSet
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

  /**
   * Test intent router with Sumo report intent
   */
  async runSumoReport(): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
    error?: string;
  }> {
    this.logger.logWithContext(
      'log',
      'Starting Sumo report workflow',
      'DevDebugService.runSumoReport',
    );

    try {
      // Create intent data for Sumo report
      const intentResult: IntentParsingResponse = {
        robotName: 'SumoReportJobExecutor',
        intent: 'generateSumoReport',
        intentData: {
          originalUserPrompt:
            'Generate Sumo report for form 6276978 from Sept 1-4',
          subIntents: ['searchSumoLogSubmissionErrors'],
          subjects: {
            formId: ['6276978'],
            startDate: ['2025-09-01'],
            endDate: ['2025-09-04'],
          },
        },
      };

      // NoOp callbacks
      const noOpCallbacks = {
        onStreamChunkReceived: () => {},
        onStreamStart: () => {},
        onStreamFinished: () => {},
        onFullMessageReceived: () => {},
        onError: (error: any) => {
          this.logger.logWithContext(
            'error',
            'Intent router error',
            'DevDebugService.runSumoReport',
            undefined,
            { error: error.message },
          );
        },
      };

      this.logger.logWithContext(
        'log',
        'Testing intent router with Sumo report intent',
        'DevDebugService.runSumoReport',
        undefined,
        { intent: intentResult.intent },
      );

      // Route through intent router (should call SumoReportJobExecutor)
      await this.intentRouterService.routeIntent(intentResult, noOpCallbacks);

      return {
        success: true,
        message: 'Sumo report intent routed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.logWithContext(
        'error',
        'Sumo report workflow failed',
        'DevDebugService.runSumoReport',
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' },
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Sumo report workflow failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
