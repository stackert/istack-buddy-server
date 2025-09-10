import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugChatClientController } from './dev-debug-chat-client.controller';
import { DevDebugChatManagerController } from './dev-debug-chat-manager.controller';
import { DevDebugService } from './dev-debug.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { IStackInfoModule } from '../istack-buddy-slack-api/istack-info.module';
import { FileManagerModule } from '../file-manager/file-manager.module';
import { RobotModule } from '../robots/robot.module';
import { IntentHandlersModule } from '../intent-handlers/intent-handlers.module';
import { IntentRouterService } from '../common/services/intent-router.service';
import { IntentHandlerRegistryService } from '../common/services/intent-handler-registry.service';
import { IntentParsingService } from '../common/services/intent-parsing.service';

@Module({
  imports: [
    AuthenticationModule,
    ChatManagerModule,
    AuthorizationPermissionsModule,
    IStackInfoModule,
    FileManagerModule,
    RobotModule,
    IntentHandlersModule,
  ],
  controllers: [
    DevDebugController,
    DevDebugChatClientController,
    DevDebugChatManagerController,
  ],
  providers: [
    DevDebugService,
    IntentRouterService,
    IntentHandlerRegistryService,
    IntentParsingService,
  ],
})
export class DevDebugModule {}
