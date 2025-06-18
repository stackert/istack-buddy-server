import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IstackBuddyDataProxyModule } from './istack-buddy-data-proxy/istack-buddy-data-proxy.module';
import { DevDebugModule } from './dev-debug/dev-debug.module';

@Module({
  imports: [IstackBuddyDataProxyModule, DevDebugModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
