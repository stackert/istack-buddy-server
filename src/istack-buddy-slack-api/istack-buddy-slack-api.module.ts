import { Module } from '@nestjs/common';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { LoggerModule } from '../common/logger/logger.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { UserProfileModule } from '../user-profile/user-profile.module';

@Module({
  imports: [
    ChatManagerModule,
    AuthenticationModule,
    LoggerModule,
    AuthorizationPermissionsModule,
    UserProfileModule,
  ],
  controllers: [IstackBuddySlackApiController],
  providers: [IstackBuddySlackApiService],
  exports: [IstackBuddySlackApiService],
})
export class IstackBuddySlackApiModule {}
