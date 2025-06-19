import { ApiProperty } from '@nestjs/swagger';

export class UserAuthResponseDto {
  @ApiProperty({
    description: 'Whether authentication was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Unique user identifier',
    example: '4b99f90a-1fe8-452a-9ce1-e590324a78de',
    format: 'uuid',
  })
  userId: string;

  @ApiProperty({
    description: 'User email address',
    example: 'all-permissions@example.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'JWT authentication token (also set as httpOnly cookie)',
    example: 'jwt-1234567890-abc123',
  })
  jwtToken: string;

  @ApiProperty({
    description: 'Array of user permissions',
    type: [String],
    example: [
      'user:profile:me:view',
      'user:profile:me:edit',
      'instructor:course:create',
      'instructor:course:edit',
      'instructor:course:delete',
    ],
  })
  permissions: string[];

  @ApiProperty({
    description: 'Optional authentication message',
    example: 'Authentication successful',
    required: false,
  })
  message?: string;
}
