import { Module } from '@nestjs/common';
import { AuthorizationPermissionsService } from './authorization-permissions.service';
import { LoggerModule } from '../common/logger/logger.module';
import {
  evaluatePermission,
  getUserEffectivePermissionChain,
} from './permission-evaluator.helper';

// Import JSON files for production use - provide defaults if imports fail
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
