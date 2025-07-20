import { UnauthorizedException } from '@nestjs/common';

export class AuthenticationFailedException extends UnauthorizedException {
  constructor(
    message: string,
    public readonly userId?: string,
  ) {
    super(message);
  }
}
