import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { DevDebugService } from './dev-debug.service';
import { AuthDto } from './dto/auth.dto';

@Controller('dev-debug')
export class DevDebugController {
  constructor(private readonly devDebugService: DevDebugService) {}

  /**
   * POST /dev-debug/auth
   * Debug authentication endpoint
   */
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  async authenticate(@Body() authData: AuthDto) {
    return this.devDebugService.authenticate(authData);
  }

  /**
   * GET /dev-debug/user-details/:userId
   * Get user details by user ID
   */
  @Get('user-details/:userId')
  async getUserDetails(@Param('userId') userId: string) {
    return this.devDebugService.getUserDetails(userId);
  }

  /**
   * GET /dev-debug/users
   * Get all users list
   */
  @Get('users')
  async getAllUsers() {
    return this.devDebugService.getAllUsers();
  }

  /**
   * GET /dev-debug/auth-status/:userId?token=...
   * Test authentication status
   */
  @Get('auth-status/:userId')
  async testAuthenticationStatus(
    @Param('userId') userId: string,
    @Query('token') token: string = 'default-test-token-12345',
  ) {
    return this.devDebugService.testAuthenticationStatus(userId, token);
  }
}
