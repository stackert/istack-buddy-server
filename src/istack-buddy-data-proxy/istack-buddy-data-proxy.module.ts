import { Module } from '@nestjs/common';
import { IstackBuddyDataProxyService } from './istack-buddy-data-proxy.service';
import { IstackBuddyDataProxyController } from './istack-buddy-data-proxy.controller';

@Module({
  controllers: [IstackBuddyDataProxyController],
  providers: [IstackBuddyDataProxyService],
})
export class IstackBuddyDataProxyModule {}
