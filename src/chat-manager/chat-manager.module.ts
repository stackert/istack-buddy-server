import { Module } from '@nestjs/common';
import { ChatManagerService } from './chat-manager.service';
import { ChatManagerGateway } from './chat-manager.gateway';
import { ChatManagerController } from './chat-manager.controller';
import { RobotProcessorService } from './robot-processor.service';
import { RobotModule } from '../robots/robot.module';
import { ConversationListServiceModule } from '../ConversationLists/ConversationListService.module';

@Module({
  imports: [RobotModule, ConversationListServiceModule],
  controllers: [ChatManagerController],
  providers: [ChatManagerGateway, ChatManagerService, RobotProcessorService],
  exports: [ChatManagerService, RobotProcessorService],
})
export class ChatManagerModule {}
