import {
  Controller,
  Get,
  HttpStatus,
  HttpCode,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

// Extend Request interface to include user property
interface RequestWithUser {
  user?: {
    userId: string;
    email: string;
    username: string;
    accountType: string;
  };
}

@ApiTags('user-profile')
@Controller('user-profiles')
export class UserProfileController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly authenticationService: AuthenticationService,
  ) {}

  @Get('me')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('user:profile:me:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Retrieves the authenticated user profile information. Requires valid JWT token.',
  })
  @ApiBearerAuth()
  @ApiCookieAuth('auth-token')
  @ApiQuery({
    name: 'jwtToken',
    required: false,
    description:
      'JWT token for authentication (alternative to cookie or Bearer token)',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required - no valid auth token provided',
  })
  public async getMyProfile(@Req() request: RequestWithUser): Promise<any> {
    // User is already authenticated by the guard, get user info from request
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('User information not found');
    }

    // Get user profile
    const userProfile =
      await this.userProfileService.getUserProfileById(userId);

    if (!userProfile) {
      throw new UnauthorizedException('User profile not found');
    }

    // Get user permissions
    const permissions =
      await this.authenticationService.getUserPermissionSet(userId);

    return {
      success: true,
      userId,
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
}
