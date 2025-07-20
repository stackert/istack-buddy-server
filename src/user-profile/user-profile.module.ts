import { Module } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UserProfileController } from './user-profile.controller';
import { AuthenticationModule } from '../authentication/authentication.module';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';

@Module({
  imports: [AuthenticationModule, GuardsModule, AuthorizationPermissionsModule],
  controllers: [UserProfileController],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
