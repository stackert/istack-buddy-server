import { Module } from '@nestjs/common';
import { AuthorizationPermissionsService } from './authorization-permissions.service';
import { LoggerModule } from '../common/logger/logger.module';
import {
  evaluatePermission,
  getUserEffectivePermissionChain,
} from './permission-evaluator.helper';

// TEMPORARY SOLUTION: Using require() for JSON files
//
// WHY require() instead of ES6 import:
// - ES6 imports (import x from './file.json') fail during NestJS build/runtime
// - The compiled application cannot find JSON files when using import statements
// - This causes "Cannot find module './user-permissions.json'" errors
//
// FUTURE SOLUTION:
// - Move to external database or configuration service
// - Implement proper asset copying in build pipeline
// - Use environment-based configuration instead of static JSON files
//
// DO NOT CHANGE TO IMPORT - BUILD WILL FAIL
let userPermissionsData: any;
let groupPermissionsData: any;
let userGroupMembershipsData: any;

try {
  userPermissionsData = require('./user-permissions.json');
} catch (error) {
  // Provide default empty data if import fails (e.g., in test environments)
  userPermissionsData = { user_permissions: {} };
}

try {
  groupPermissionsData = require('./group-permissions.json');
} catch (error) {
  // Provide default empty data if import fails (e.g., in test environments)
  groupPermissionsData = { group_permissions: {} };
}

try {
  userGroupMembershipsData = require('./user-group-memberships.json');
} catch (error) {
  // Provide default empty data if import fails (e.g., in test environments)
  userGroupMembershipsData = { user_group_memberships: {} };
}

@Module({
  imports: [LoggerModule],
  providers: [
    AuthorizationPermissionsService,
    {
      provide: 'PermissionEvaluator',
      useValue: {
        evaluatePermission,
        getUserEffectivePermissionChain,
      },
    },
    {
      provide: 'UserPermissionsData',
      useValue: userPermissionsData,
    },
    {
      provide: 'GroupPermissionsData',
      useValue: groupPermissionsData,
    },
    {
      provide: 'UserGroupMembershipsData',
      useValue: userGroupMembershipsData,
    },
  ],
  exports: [AuthorizationPermissionsService],
})
export class AuthorizationPermissionsModule {}
