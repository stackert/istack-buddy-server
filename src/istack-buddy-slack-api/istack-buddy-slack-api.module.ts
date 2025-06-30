import { Module } from '@nestjs/common';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { ConversationListServiceModule } from '../ConversationLists';

@Module({
  imports: [ConversationListServiceModule],
  controllers: [IstackBuddySlackApiController],
  providers: [IstackBuddySlackApiService],
})
export class IstackBuddySlackApiModule {}
