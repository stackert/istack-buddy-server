import { Module } from '@nestjs/common';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';

@Module({
  imports: [ChatManagerModule],
  controllers: [IstackBuddySlackApiController],
  providers: [IstackBuddySlackApiService],
  exports: [IstackBuddySlackApiService],
})
export class IstackBuddySlackApiModule {}
