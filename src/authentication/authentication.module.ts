import { Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { AuthorizationPermissionsModule } from '../authorization-permissions/authorization-permissions.module';

@Module({
  imports: [AuthorizationPermissionsModule],
  controllers: [AuthenticationController],
  providers: [AuthenticationService],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
