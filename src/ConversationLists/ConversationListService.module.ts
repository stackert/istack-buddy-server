import { Module } from '@nestjs/common';
import { ConversationListService } from './ConversationListService';
import { ConversationListSlackAppService } from './ConversationListSlackAppService';

@Module({
  providers: [ConversationListSlackAppService],
  exports: [ConversationListSlackAppService],
})
export class ConversationListServiceModule {}
