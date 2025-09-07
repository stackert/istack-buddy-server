import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugKnobbyController } from './dev-debug-knobby.controller';
import { DevDebugKnobbySumoController } from './dev-debug-knobby-sumo.controller';
import { DevDebugChatManagerController } from './dev-debug-chat-manager.controller';
import { DevDebugChatClientController } from './dev-debug-chat-client.controller';
import { DevDebugService } from './dev-debug.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';

@Module({
  imports: [AuthenticationModule, ChatManagerModule, AuthorizationPermissionsModule],
  controllers: [DevDebugController, DevDebugKnobbyController, DevDebugKnobbySumoController, DevDebugChatManagerController, DevDebugChatClientController],
  providers: [DevDebugService],
})
export class DevDebugModule {}
