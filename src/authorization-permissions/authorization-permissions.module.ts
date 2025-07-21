import { Module } from '@nestjs/common';
import { AuthorizationPermissionsService } from './authorization-permissions.service';
import { LoggerModule } from '../common/logger/logger.module';
import {
  evaluatePermission,
  getUserEffectivePermissionChain,
} from './permission-evaluator.helper';

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
  ],
  exports: [AuthorizationPermissionsService],
})
export class AuthorizationPermissionsModule {}
