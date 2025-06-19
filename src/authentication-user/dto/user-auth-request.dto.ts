import { ApiProperty } from '@nestjs/swagger';

export class UserAuthRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'all-permissions@example.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'any-password',
    minLength: 1,
  })
  password: string;
}
