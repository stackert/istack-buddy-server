import { Module } from '@nestjs/common';
import { AuthenticationUserController } from './authentication-user.controller';
import { AuthenticationUserService } from './authentication-user.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AuthenticationUserController],
  providers: [AuthenticationUserService],
})
export class AuthenticationUserModule {}
