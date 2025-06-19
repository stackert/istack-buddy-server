import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
