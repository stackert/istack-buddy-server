import { Module } from '@nestjs/common';
import { AuthorizationPermissionsService } from './authorization-permissions.service';

@Module({
  providers: [AuthorizationPermissionsService],
  exports: [AuthorizationPermissionsService],
})
export class AuthorizationPermissionsModule {}
