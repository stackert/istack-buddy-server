import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugService } from './dev-debug.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DevDebugController],
  providers: [DevDebugService],
})
export class DevDebugModule {}
