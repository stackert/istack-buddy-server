import { Module } from '@nestjs/common';
import { PublicInterfaceController } from './public-interface.controller';
import { FormMarvSessionService } from './form-marv-session.service';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { UserProfileModule } from '../user-profile/user-profile.module';
import { LoggerModule } from '../common/logger/logger.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';

@Module({
  imports: [
    GuardsModule,
    AuthenticationModule,
    AuthorizationPermissionsModule,
    UserProfileModule,
    LoggerModule,
    ChatManagerModule,
  ],
  controllers: [PublicInterfaceController],
  providers: [FormMarvSessionService],
})
export class PublicInterfaceModule {}
