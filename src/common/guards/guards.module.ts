import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionGuard } from './permission.guard';
import { AuthPermissionGuard } from './auth-permission.guard';
import { LoggerModule } from '../logger/logger.module';
import { AuthenticationModule } from '../../authentication/authentication.module';

@Module({
  imports: [LoggerModule, AuthenticationModule],
  providers: [JwtAuthGuard, PermissionGuard, AuthPermissionGuard],
  exports: [JwtAuthGuard, PermissionGuard, AuthPermissionGuard],
})
export class GuardsModule {}
