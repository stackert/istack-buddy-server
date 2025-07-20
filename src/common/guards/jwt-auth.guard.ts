import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { CustomLoggerService } from '../logger/custom-logger.service';

// Extend Request interface to include user property
interface RequestWithUser extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
    accountType: string;
  };
}

const JWT_SECRET = 'istack-buddy-secret-key-2024';

interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  accountType: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly logger: CustomLoggerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      this.logger.auditLog(
        'AUTH_GUARD_FAILED',
        'failure',
        'JwtAuthGuard.canActivate',
        undefined,
        { reason: 'No token provided', path: request.path },
      );
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

      // Add user info to request for use in controllers
      request['user'] = {
        userId: payload.userId,
        email: payload.email,
        username: payload.username,
        accountType: payload.accountType,
      };

      this.logger.auditLog(
        'AUTH_GUARD_SUCCESS',
        'success',
        'JwtAuthGuard.canActivate',
        undefined,
        {
          userId: payload.userId,
          path: request.path,
          accountType: payload.accountType,
        },
      );

      return true;
    } catch (error) {
      this.logger.auditLog(
        'AUTH_GUARD_FAILED',
        'failure',
        'JwtAuthGuard.canActivate',
        undefined,
        {
          reason: 'Invalid token',
          error: error instanceof Error ? error.message : 'Unknown error',
          path: request.path,
        },
      );
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
  }

  private extractTokenFromRequest(request: RequestWithUser): string | null {
    // Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookie
    const cookieToken = request.cookies?.['auth-token'];
    if (cookieToken) {
      return cookieToken;
    }

    // Check query parameter
    const queryToken = request.query.jwtToken as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }
}
