import { Injectable } from '@nestjs/common';
import { AuthDto, AuthResponseDto } from './dto/auth.dto';
import { UserDetailsDto } from './dto/user-details.dto';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';

@Injectable()
export class DevDebugService {
  constructor(
    private readonly logger: CustomLoggerService,
    private readonly authService: AuthenticationService,
    private readonly iStackInfoService: IStackInfoService,
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
   * Run complete Sumo report workflow - submit, poll, get results
   */
  async runSumoReport(): Promise<{
    success: boolean;
    jobId?: string;
    status?: string;
    recordCount?: number;
    fileId?: string;
    results?: unknown;
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
      // Step 1: Submit the query
      const submissionRequest = {
        queryName: 'submissionCreatedForForm',
        subject: {
          formId: '6276978',
          startDate: '2025-09-01',
          endDate: '2025-09-04',
        },
      };

      this.logger.logWithContext(
        'log',
        'Submitting Sumo query',
        'DevDebugService.runSumoReport',
        undefined,
        { request: submissionRequest },
      );

      const submissionResponse =
        await this.iStackInfoService.sumoReport.submitQuery(submissionRequest);
      const jobId = submissionResponse.jobId;

      this.logger.logWithContext(
        'log',
        `Job submitted with ID: ${jobId}`,
        'DevDebugService.runSumoReport',
        undefined,
        { jobId, status: submissionResponse.status },
      );

      // Step 2: Poll until done
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max (10 second intervals)

      while (
        status !== 'completed' &&
        status !== 'failed' &&
        attempts < maxAttempts
      ) {
        await this.sleep(10000); // Wait 10 seconds
        attempts++;

        const statusResponse =
          await this.iStackInfoService.sumoReport.jobs.getStatus(jobId);
        status = statusResponse.status;

        this.logger.logWithContext(
          'log',
          `Job status check ${attempts}/${maxAttempts}: ${status}`,
          'DevDebugService.runSumoReport',
          undefined,
          { jobId, status, attempt: attempts },
        );

        if (status === 'failed') {
          throw new Error(
            `Job failed: ${statusResponse.error || 'Unknown error'}`,
          );
        }
      }

      if (status !== 'completed') {
        throw new Error(`Job timed out after ${maxAttempts} attempts`);
      }

      // Step 3: Get results
      this.logger.logWithContext(
        'log',
        'Job completed, fetching results',
        'DevDebugService.runSumoReport',
        undefined,
        { jobId },
      );

      const resultsResponse =
        await this.iStackInfoService.sumoReport.jobs.getResults(jobId);

      // Step 4: Submit intent 'debugPrintToLog'
      this.logger.logWithContext(
        'log',
        'Sumo report results received - debugPrintToLog intent',
        'DevDebugService.runSumoReport',
        undefined,
        {
          jobId,
          recordCount: resultsResponse.recordCount || 0,
          fileId: resultsResponse.fileId,
          results: resultsResponse.results,
        },
      );

      return {
        success: true,
        jobId,
        status: 'completed',
        recordCount: resultsResponse.recordCount || 0,
        fileId: resultsResponse.fileId,
        results: resultsResponse.results,
        message: 'Sumo report workflow completed successfully',
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
