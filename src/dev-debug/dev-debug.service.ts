import { Injectable } from '@nestjs/common';
import { AuthDto, AuthResponseDto } from './dto/auth.dto';
import { UserDetailsDto } from './dto/user-details.dto';

@Injectable()
export class DevDebugService {
  /**
   * Debug authentication endpoint
   * Returns simple success response for development/debugging
   */
  async authenticate(authData: AuthDto): Promise<AuthResponseDto> {
    // For now, just return success
    // Later we'll implement actual authentication logic
    return {
      success: true,
      message: 'Authentication successful (dev-debug mode)',
    };
  }

  /**
   * Get user details by user ID
   * Returns empty object for now, will be fleshed out later
   */
  async getUserDetails(userId: string): Promise<UserDetailsDto> {
    // For now, just return empty object
    // Later we'll implement actual user lookup
    return {};
  }

  /**
   * Get all users list
   * Returns mock user data for development/debugging
   */
  async getAllUsers(): Promise<any[]> {
    // Mock user data for development/debugging
    return [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'john_doe',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        accountType: 'student',
        status: 'active',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        username: 'jane_smith',
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        accountType: 'instructor',
        status: 'active',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        username: 'admin_user',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        accountType: 'administrator',
        status: 'active',
      },
    ];
  }
}
