import { Module } from '@nestjs/common';
import { AuthorizationPermissionsService } from './authorization-permissions.service';
import { LoggerModule } from '../common/logger/logger.module';
import {
  evaluatePermission,
  getUserEffectivePermissionChain,
} from './permission-evaluator.helper';

// Import JSON files using require for compatibility
const userPermissionsData = require('./user-permissions.json');
const groupPermissionsData = require('./group-permissions.json');
const userGroupMembershipsData = require('./user-group-memberships.json');

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
