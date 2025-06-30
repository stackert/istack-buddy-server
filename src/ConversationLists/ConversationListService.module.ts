import { Module } from '@nestjs/common';
import {
  ConversationListService,
  ConversationListSlackAppService,
} from './ConversationListService';

@Module({
  providers: [ConversationListSlackAppService],
  exports: [ConversationListSlackAppService],
})
export class ConversationListServiceModule {}
