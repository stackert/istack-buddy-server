import { Module, forwardRef } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UserProfileController } from './user-profile.controller';
import { GuardsModule } from '../common/guards/guards.module';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { AuthenticationModule } from '../authentication/authentication.module';

// TEMPORARY SOLUTION: Using require() for JSON files
//
// WHY require() instead of ES6 import:
// - ES6 imports (import x from './file.json') fail during NestJS build/runtime
// - The compiled application cannot find JSON files when using import statements
// - This causes "Cannot find module './user-profiles.json'" errors
//
// FUTURE SOLUTION:
// - Move to external database or configuration service
// - Implement proper asset copying in build pipeline
// - Use environment-based configuration instead of static JSON files
//
// DO NOT CHANGE TO IMPORT - BUILD WILL FAIL
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
