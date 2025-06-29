import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IstackBuddyDataProxyModule } from './istack-buddy-data-proxy/istack-buddy-data-proxy.module';
import { DevDebugModule } from './dev-debug/dev-debug.module';
import { AuthModule } from './auth/auth.module';
import { AuthenticationUserModule } from './authentication-user/authentication-user.module';
import { LoggerModule } from './common/logger/logger.module';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { ChatManagerModule } from './chat-manager/chat-manager.module';
// import { IstackBuddySlackApiModule } from './istack-buddy-slack-api/istack-buddy-slack-api.module';
// import { IstackBuddySlackApiModule } from './istack-buddy-slack-api/istack-buddy-slack-api.module';

@Module({
  imports: [
    LoggerModule,
    AuthModule,
    AuthenticationUserModule,
    IstackBuddyDataProxyModule,
    DevDebugModule,
    ChatManagerModule,
    //    IstackBuddySlackApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global interceptors (order matters - correlation first)
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global exception filters (order matters - most specific first)
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
