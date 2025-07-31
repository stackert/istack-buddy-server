import { Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { UserProfileModule } from '../user-profile/user-profile.module';

@Module({
  imports: [AuthorizationPermissionsModule, UserProfileModule],
  controllers: [AuthenticationController],
  providers: [AuthenticationService],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
