import { Module } from '@nestjs/common';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugKnobbyController } from './dev-debug-knobby.controller';
import { DevDebugKnobbySumoController } from './dev-debug-knobby-sumo.controller';
import { DevDebugChatManagerController } from './dev-debug-chat-manager.controller';
import { DevDebugService } from './dev-debug.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';

@Module({
  imports: [AuthenticationModule, ChatManagerModule],
  controllers: [DevDebugController, DevDebugKnobbyController, DevDebugKnobbySumoController, DevDebugChatManagerController],
  providers: [DevDebugService],
})
export class DevDebugModule {}
