import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IstackBuddyDataProxyModule } from './istack-buddy-data-proxy/istack-buddy-data-proxy.module';

@Module({
  imports: [IstackBuddyDataProxyModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
