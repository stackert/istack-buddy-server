import { Module, forwardRef } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UserProfileController } from './user-profile.controller';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { AuthenticationModule } from '../authentication/authentication.module';

// Import JSON file using require for compatibility
const userProfilesData = require('./user-profiles.json');

@Module({
  imports: [
    GuardsModule,
    AuthorizationPermissionsModule,
    forwardRef(() => AuthenticationModule),
  ],
  controllers: [UserProfileController],
  providers: [
    UserProfileService,
    AuthPermissionGuard,
    {
      provide: 'UserProfilesData',
      useValue: userProfilesData,
    },
  ],
  exports: [UserProfileService],
})
export class UserProfileModule {}
