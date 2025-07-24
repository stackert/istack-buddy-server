import { Module, forwardRef } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UserProfileController } from './user-profile.controller';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { AuthenticationModule } from '../authentication/authentication.module';

// Import JSON files for production use - provide defaults if imports fail
let userProfilesData: any;

try {
  userProfilesData = require('./user-profiles.json');
} catch (error) {
  // Provide default empty data if import fails (e.g., in test environments)
  userProfilesData = { users: {} };
}

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
