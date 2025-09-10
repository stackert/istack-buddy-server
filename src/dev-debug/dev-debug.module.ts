import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugService } from './dev-debug.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { IStackInfoModule } from '../istack-buddy-slack-api/istack-info.module';
import { FileManagerModule } from '../file-manager/file-manager.module';
import { RobotModule } from '../robots/robot.module';
import { IntentHandlersModule } from '../intent-handlers/intent-handlers.module';
import { IntentRouterService } from '../common/services/intent-router.service';
import { IntentHandlerRegistryService } from '../common/services/intent-handler-registry.service';

@Module({
  imports: [
    AuthenticationModule,
    IStackInfoModule,
    FileManagerModule,
    RobotModule,
    IntentHandlersModule,
  ],
  controllers: [DevDebugController],
  providers: [
    DevDebugService,
    IntentRouterService,
    IntentHandlerRegistryService,
  ],
})
export class DevDebugModule {}
