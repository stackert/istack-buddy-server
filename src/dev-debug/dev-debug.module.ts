import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugService } from './dev-debug.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { IStackInfoModule } from '../istack-buddy-slack-api/istack-info.module';

@Module({
  imports: [AuthenticationModule, IStackInfoModule],
  controllers: [DevDebugController],
  providers: [DevDebugService],
})
export class DevDebugModule {}
