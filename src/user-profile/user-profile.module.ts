import { Module, forwardRef } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UserProfileController } from './user-profile.controller';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { AuthenticationModule } from '../authentication/authentication.module';

@Module({
  imports: [
    GuardsModule,
    AuthorizationPermissionsModule,
    forwardRef(() => AuthenticationModule),
  ],
  controllers: [UserProfileController],
  providers: [UserProfileService, AuthPermissionGuard],
  exports: [UserProfileService],
})
export class UserProfileModule {}
