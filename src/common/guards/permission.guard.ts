import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { AuthenticationService } from '../../authentication/authentication.service';
import { Request } from 'express';

// Extend Request interface to include user property
interface RequestWithUser extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
    accountType: string;
  };
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: CustomLoggerService,
    private readonly authenticationService: AuthenticationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      this.logger.auditLog(
        'PERMISSION_GUARD_FAILED',
        'failure',
        'PermissionGuard.canActivate',
        undefined,
        { reason: 'No user found in request', path: request.path },
      );
      throw new ForbiddenException('User not authenticated');
    }

    try {
      // Get user's permissions
      const userPermissions =
        await this.authenticationService.getUserPermissionSet(user.userId);

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAllPermissions) {
        this.logger.auditLog(
          'PERMISSION_GUARD_FAILED',
          'failure',
          'PermissionGuard.canActivate',
          undefined,
          {
            userId: user.userId,
            requiredPermissions,
            userPermissions,
            path: request.path,
            reason: 'Insufficient permissions',
          },
        );
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${requiredPermissions.join(
            ', ',
          )}`,
        );
      }

      this.logger.auditLog(
        'PERMISSION_GUARD_SUCCESS',
        'success',
        'PermissionGuard.canActivate',
        undefined,
        {
          userId: user.userId,
          requiredPermissions,
          path: request.path,
        },
      );

      return true;
    } catch (error) {
      this.logger.auditLog(
        'PERMISSION_GUARD_FAILED',
        'failure',
        'PermissionGuard.canActivate',
        undefined,
        {
          userId: user.userId,
          requiredPermissions,
          path: request.path,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Permission check failed');
    }
  }
}
