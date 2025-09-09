import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugService } from './dev-debug.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { IStackInfoModule } from '../istack-buddy-slack-api/istack-info.module';
import { FileManagerModule } from '../file-manager/file-manager.module';

@Module({
  imports: [AuthenticationModule, IStackInfoModule, FileManagerModule],
  controllers: [DevDebugController],
  providers: [DevDebugService],
})
export class DevDebugModule {}
