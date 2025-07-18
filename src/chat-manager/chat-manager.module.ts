import { Module } from '@nestjs/common';
import { ChatManagerService } from './chat-manager.service';
import { ChatManagerGateway } from './chat-manager.gateway';
import { ChatManagerController } from './chat-manager.controller';
import { RobotModule } from '../robots/robot.module';
import { ConversationListServiceModule } from '../ConversationLists/ConversationListService.module';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';

@Module({
  imports: [RobotModule, ConversationListServiceModule],
  controllers: [ChatManagerController],
  providers: [
    ChatManagerGateway,
    ChatManagerService,
    ChatConversationListService,
  ],
  exports: [ChatManagerService, ChatConversationListService],
})
export class ChatManagerModule {}
