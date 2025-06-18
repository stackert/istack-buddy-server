import { HttpException, HttpStatus } from '@nestjs/common';

export class AuthenticationFailedException extends HttpException {
  constructor(message?: string, userId?: string) {
    super(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: message || 'Authentication failed',
        error: 'Unauthorized',
        userId: userId || null,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
