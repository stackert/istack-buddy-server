import {
  Controller,
  Get,
  Param,
  Put,
  Body,
  HttpStatus,
  HttpCode,
  Req,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserProfileService } from './user-profile.service';
import { AuthenticationService } from '../authentication/authentication.service';

@ApiTags('user-profile')
@Controller('user-profiles')
export class UserProfileController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly authenticationService: AuthenticationService,
  ) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Retrieves the authenticated user profile information. Accepts JWT token from cookie or query parameter.',
  })
  @ApiCookieAuth('auth-token')
  @ApiQuery({
    name: 'jwtToken',
    required: false,
    description: 'JWT token for authentication (alternative to cookie)',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required - no valid auth token provided',
  })
  public async getMyProfile(
    @Req() request: Request,
    @Query('jwtToken') queryToken?: string,
  ): Promise<any> {
    // Get token from cookie or query parameter
    const authToken = request.cookies?.['auth-token'] || queryToken;

    if (!authToken) {
      throw new UnauthorizedException('No authentication token provided');
    }

    // Get session info from token
    const sessionInfo =
      await this.authenticationService.getSessionByToken(authToken);

    if (!sessionInfo) {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    // Validate session
    const isValidSession = await this.authenticationService.isUserAuthenticated(
      sessionInfo.userId,
      authToken,
    );

    if (!isValidSession) {
      throw new UnauthorizedException('Authentication token has expired');
    }

    // Get user profile
    const userProfile = await this.userProfileService.getUserProfileById(
      sessionInfo.userId,
    );

    if (!userProfile) {
      throw new UnauthorizedException('User profile not found');
    }

    // Get user permissions
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
      lastLogin: userProfile.last_login,
      emailVerified: userProfile.is_email_verified,
      createdAt: userProfile.created_at,
    };
  }

  @Get(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user profile by ID',
    description: 'Retrieves user profile information by user ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  public async getUserProfile(@Param('userId') userId: string): Promise<any> {
    const profile = await this.userProfileService.getUserProfileById(userId);

    if (!profile) {
      return { success: false, message: 'User profile not found' };
    }

    return {
      success: true,
      userId,
      profile,
    };
  }

  @Put(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Updates user profile information.',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  public async updateUserProfile(
    @Param('userId') userId: string,
    @Body() profileData: any,
  ): Promise<any> {
    const success = await this.userProfileService.updateUserProfile(
      userId,
      profileData,
    );

    return {
      success,
      message: success
        ? 'Profile updated successfully'
        : 'Failed to update profile',
    };
  }
}
