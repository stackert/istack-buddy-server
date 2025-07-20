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
import { AuthenticationService } from './authentication.service';
import { UserAuthRequestDto } from './dto/user-auth-request.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';

@ApiTags('authentication')
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

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
          email: 'user@example.com',
          password: 'password123',
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
  })
  @ApiBadRequestResponse({
    description: 'Validation error - missing or invalid request data',
  })
  public async authenticateUser(
    @Body() authRequest: UserAuthRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserAuthResponseDto> {
    const result =
      await this.authenticationService.authenticateUserByEmailAndPassword(
        authRequest.email,
        authRequest.password,
      );

    // Set authentication cookie with the JWT token
    response.cookie('auth-token', result.jwtToken, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours (matching session timeout)
    });

    return {
      success: result.success,
      userId: result.userId!,
      email: authRequest.email,
      jwtToken: result.jwtToken!,
      permissions: result.permissions || [],
      message: result.message || 'Authentication successful',
    };
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
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - no valid auth token provided',
  })
  public async getMyProfile(@Req() request: Request): Promise<any> {
    const authToken = request.cookies?.['auth-token'];

    if (!authToken) {
      throw new UnauthorizedException('No authentication token provided');
    }

    const sessionInfo =
      await this.authenticationService.getSessionByToken(authToken);

    if (!sessionInfo) {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    const isValidSession = await this.authenticationService.isUserAuthenticated(
      sessionInfo.userId,
      authToken,
    );

    if (!isValidSession) {
      throw new UnauthorizedException('Authentication token has expired');
    }

    const userProfile = await this.authenticationService.getUserProfileById(
      sessionInfo.userId,
    );

    if (!userProfile) {
      throw new UnauthorizedException('User profile not found');
    }

    const permissions = await this.authenticationService.getUserPermissionSet(
      sessionInfo.userId,
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
      lastLogin: null,
      emailVerified: userProfile.is_email_verified,
    };
  }
}
