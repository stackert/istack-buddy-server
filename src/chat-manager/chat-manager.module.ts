import { Module } from '@nestjs/common';
import { ChatManagerService } from './chat-manager.service';
import { ChatManagerGateway } from './chat-manager.gateway';
import { ChatManagerController } from './chat-manager.controller';
import { RobotModule } from '../robots/robot.module';
import { ConversationListServiceModule } from '../ConversationLists/ConversationListService.module';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import { AuthenticationModule } from '../authentication/authentication.module';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';

@Module({
  imports: [
    RobotModule,
    ConversationListServiceModule,
    AuthenticationModule,
    GuardsModule,
  ],
  controllers: [ChatManagerController],
  providers: [
    ChatManagerGateway,
    ChatManagerService,
    ChatConversationListService,
    AuthPermissionGuard,
  ],
  exports: [ChatManagerService, ChatConversationListService],
})
export class ChatManagerModule {}
