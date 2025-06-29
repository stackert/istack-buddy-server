import { Module } from '@nestjs/common';
import { ChatManagerService } from './chat-manager.service';
import { ChatManagerGateway } from './chat-manager.gateway';
import { ChatManagerController } from './chat-manager.controller';

@Module({
  controllers: [ChatManagerController],
  providers: [ChatManagerGateway, ChatManagerService],
  exports: [ChatManagerService],
})
export class ChatManagerModule {}
