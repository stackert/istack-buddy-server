import { Module } from '@nestjs/common';
import { ChatManagerService } from './chat-manager.service';
import { ChatManagerGateway } from './chat-manager.gateway';
import { ChatManagerController } from './chat-manager.controller';
import { RobotModule } from '../robots/robot.module';

import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import { AuthenticationModule } from '../authentication/authentication.module';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { IntentParsingService } from '../common/services/intent-parsing.service';

@Module({
  imports: [RobotModule, AuthenticationModule, GuardsModule],
  controllers: [ChatManagerController],
  providers: [
    ChatManagerGateway,
    ChatManagerService,
    ChatConversationListService,
    AuthPermissionGuard,
    IntentParsingService,
  ],
  exports: [ChatManagerService, ChatConversationListService, IntentParsingService],
})
export class ChatManagerModule {}
