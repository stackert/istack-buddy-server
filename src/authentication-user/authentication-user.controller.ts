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
import { Request, Response } from 'express';
import { AuthenticationUserService } from './authentication-user.service';
import { UserAuthRequestDto } from './dto/user-auth-request.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';

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
  async authenticateUser(
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
  async getMyProfile(@Req() request: Request): Promise<any> {
    const authToken = request.cookies['auth-token'];

    if (!authToken) {
      throw new UnauthorizedException('No authentication token provided');
    }

    return this.authenticationUserService.getUserProfile(authToken);
  }
}
