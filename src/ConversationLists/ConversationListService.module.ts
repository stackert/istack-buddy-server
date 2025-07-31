import { Module } from '@nestjs/common';
import { ConversationListSlackAppService } from './ConversationListSlackAppService';

@Module({
  providers: [ConversationListSlackAppService],
  exports: [ConversationListSlackAppService],
})
export class ConversationListServiceModule {}
