import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  Get,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthenticationUserService } from './authentication-user.service';
import { UserAuthRequestDto } from './dto/user-auth-request.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';

@ApiTags('authentication')
@Controller('auth')
export class AuthenticationUserController {
  constructor(
    private readonly authenticationUserService: AuthenticationUserService,
  ) {}

  /**
   * POST /auth/user
   * External API endpoint for user authentication
   * Returns 200 with user permissions on success, 401 on failure
   */
  @Post('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate user with email and password',
    description:
      'Authenticates a user with email/password credentials and returns JWT token with permissions. Sets an httpOnly authentication cookie.',
  })
  @ApiBody({
    type: UserAuthRequestDto,
    description: 'User authentication credentials',
    examples: {
      validUser: {
        summary: 'Valid user authentication',
        value: {
          email: 'all-permissions@example.com',
          password: 'any-password',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: UserAuthResponseDto,
    headers: {
      'Set-Cookie': {
        description: 'Authentication token set as httpOnly cookie',
        schema: {
          type: 'string',
          example:
            'auth-token=jwt-1234567890-abc123; HttpOnly; SameSite=Strict',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication failed - invalid credentials',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        timestamp: { type: 'string', example: '2025-06-18T10:09:10.655Z' },
        path: { type: 'string', example: '/auth/user' },
        method: { type: 'string', example: 'POST' },
        message: { type: 'string', example: 'Authentication failed' },
        correlationId: {
          type: 'string',
          example: 'b43cd554-3b18-454a-919e-cab26c0471aa',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error - missing or invalid request data',
  })
  public async authenticateUser(
    @Body() authRequest: UserAuthRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserAuthResponseDto> {
    const result =
      await this.authenticationUserService.authenticateUser(authRequest);

    // Set authentication cookie with the JWT token
    response.cookie('auth-token', result.jwtToken, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours (matching session timeout)
    });

    return result;
  }

  @Get('profile/me')
  @HttpCode(HttpStatus.OK)
  @ApiTags('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Retrieves the authenticated user profile information including permissions. Requires authentication cookie.',
  })
  @ApiCookieAuth('auth-token')
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        userId: {
          type: 'string',
          example: '4b99f90a-1fe8-452a-9ce1-e590324a78de',
        },
        email: { type: 'string', example: 'all-permissions@example.com' },
        username: { type: 'string', example: 'all-permissions' },
        firstName: { type: 'string', example: 'All' },
        lastName: { type: 'string', example: 'Permissions' },
        accountType: { type: 'string', example: 'STUDENT' },
        accountStatus: { type: 'string', example: 'ACTIVE' },
        permissions: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'user:profile:me:view',
            'user:profile:me:edit',
            'instructor:course:create',
          ],
        },
        lastLogin: { type: 'string', nullable: true, example: null },
        emailVerified: { type: 'boolean', example: true },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - no valid auth token provided',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        timestamp: { type: 'string', example: '2025-06-18T16:17:33.570Z' },
        path: { type: 'string', example: '/auth/profile/me' },
        method: { type: 'string', example: 'GET' },
        message: {
          type: 'string',
          example: 'No authentication token provided',
        },
        correlationId: {
          type: 'string',
          example: '81238b77-106e-4377-af21-a2ba8e7fd89d',
        },
      },
    },
  })
  public async getMyProfile(@Req() request: Request): Promise<any> {
    const authToken = request.cookies['auth-token'];

    if (!authToken) {
      throw new UnauthorizedException('No authentication token provided');
    }

    return this.authenticationUserService.getUserProfile(authToken);
  }
}
