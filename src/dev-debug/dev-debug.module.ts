import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugService } from './dev-debug.service';

@Module({
  controllers: [DevDebugController],
  providers: [DevDebugService]
})
export class DevDebugModule {}
