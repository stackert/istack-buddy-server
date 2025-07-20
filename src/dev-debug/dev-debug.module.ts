import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugService } from './dev-debug.service';
import { AuthenticationModule } from '../authentication/authentication.module';

@Module({
  imports: [AuthenticationModule],
  controllers: [DevDebugController],
  providers: [DevDebugService],
})
export class DevDebugModule {}
