import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { AuthenticationService } from '../../authentication/authentication.service';

const JWT_SECRET = 'istack-buddy-secret-key-2024';

interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  accountType: string;
  iat: number;
  exp: number;
}

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
export class AuthPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: CustomLoggerService,
    private readonly authenticationService: AuthenticationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Step 1: Extract and validate JWT token
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      this.logger.warn('No authentication token provided', {
        endpoint: request.url,
        method: request.method,
        correlationId: request.headers['x-correlation-id'] || 'unknown',
      });
      throw new UnauthorizedException('No authentication token provided');
    }

    // Step 2: Validate JWT token
    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      this.logger.warn('Invalid or expired authentication token', {
        endpoint: request.url,
        method: request.method,
        correlationId: request.headers['x-correlation-id'] || 'unknown',
        error: error.message,
      });
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    // Step 3: Set user information on request
    request.user = {
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
      accountType: payload.accountType,
    };

    // Step 4: If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.debug('No permissions required, access granted', {
        userId: payload.userId,
        endpoint: request.url,
        method: request.method,
        correlationId: request.headers['x-correlation-id'] || 'unknown',
      });
      return true;
    }

    // Step 5: Get user permissions and check if they have required permissions
    try {
      const userPermissions =
        await this.authenticationService.getUserPermissionSet(payload.userId);

      this.logger.debug('Checking user permissions', {
        userId: payload.userId,
        requiredPermissions,
        userPermissions,
        endpoint: request.url,
        method: request.method,
        correlationId: request.headers['x-correlation-id'] || 'unknown',
      });

      // Check if user has any of the required permissions
      const hasPermission = requiredPermissions.some((requiredPermission) =>
        userPermissions.includes(requiredPermission),
      );

      if (!hasPermission) {
        this.logger.warn('User does not have required permissions', {
          userId: payload.userId,
          requiredPermissions,
          userPermissions,
          endpoint: request.url,
          method: request.method,
          correlationId: request.headers['x-correlation-id'] || 'unknown',
        });
        throw new ForbiddenException(
          `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
        );
      }

      this.logger.debug('User has required permissions, access granted', {
        userId: payload.userId,
        requiredPermissions,
        endpoint: request.url,
        method: request.method,
        correlationId: request.headers['x-correlation-id'] || 'unknown',
      });

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('Error checking user permissions', {
        userId: payload.userId,
        error: error.message,
        endpoint: request.url,
        method: request.method,
        correlationId: request.headers['x-correlation-id'] || 'unknown',
      });
      throw new ForbiddenException('Error checking permissions');
    }
  }

  private extractTokenFromRequest(request: RequestWithUser): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookie
    const cookieToken = request.cookies?.['auth-token'];
    if (cookieToken) {
      return cookieToken;
    }

    // Check query parameter (for testing purposes)
    const queryToken = request.query.jwtToken as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }
}
