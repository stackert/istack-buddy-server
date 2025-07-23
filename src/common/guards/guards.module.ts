import { Module, forwardRef } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionGuard } from './permission.guard';
import { SlackSignatureGuard } from './slack-signature.guard';
import { LoggerModule } from '../logger/logger.module';
import { AuthenticationModule } from '../../authentication/authentication.module';

@Module({
  imports: [LoggerModule, forwardRef(() => AuthenticationModule)],
  providers: [JwtAuthGuard, PermissionGuard, SlackSignatureGuard],
  exports: [JwtAuthGuard, PermissionGuard, SlackSignatureGuard],
})
export class GuardsModule {}
