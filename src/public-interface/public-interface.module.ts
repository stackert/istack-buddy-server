import { Module } from '@nestjs/common';
import { PublicInterfaceController } from './public-interface.controller';
import { SlackyChatController } from './slacky-chat.controller';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { UserProfileModule } from '../user-profile/user-profile.module';
import { LoggerModule } from '../common/logger/logger.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';
import { FileManagerModule } from '../file-manager/file-manager.module';

@Module({
  imports: [
    GuardsModule,
    AuthenticationModule,
    AuthorizationPermissionsModule,
    UserProfileModule,
    LoggerModule,
    ChatManagerModule,
    FileManagerModule,
  ],
  controllers: [PublicInterfaceController, SlackyChatController],
  providers: [],
  exports: [],
})
export class PublicInterfaceModule {}
