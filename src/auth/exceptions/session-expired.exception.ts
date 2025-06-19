import { HttpException, HttpStatus } from '@nestjs/common';

export class SessionExpiredException extends HttpException {
  constructor(message?: string, sessionId?: string) {
    super(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: message || 'Session has expired',
        error: 'SessionExpired',
        sessionId: sessionId || null,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
