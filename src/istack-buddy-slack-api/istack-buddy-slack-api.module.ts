import { Module } from '@nestjs/common';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { ConversationListServiceModule } from '../ConversationLists';
import { RobotModule } from '../robots/robot.module';

@Module({
  imports: [ConversationListServiceModule, RobotModule],
  controllers: [IstackBuddySlackApiController],
  providers: [IstackBuddySlackApiService],
})
export class IstackBuddySlackApiModule {}
