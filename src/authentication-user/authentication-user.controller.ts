import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
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
  ): Promise<UserAuthResponseDto> {
    return this.authenticationUserService.authenticateUser(authRequest);
  }
}
