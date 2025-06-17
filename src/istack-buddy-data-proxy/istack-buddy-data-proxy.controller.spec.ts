import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddyDataProxyController } from './istack-buddy-data-proxy.controller';
import { IstackBuddyDataProxyService } from './istack-buddy-data-proxy.service';

describe('IstackBuddyDataProxyController', () => {
  let controller: IstackBuddyDataProxyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IstackBuddyDataProxyController],
      providers: [IstackBuddyDataProxyService],
    }).compile();

    controller = module.get<IstackBuddyDataProxyController>(IstackBuddyDataProxyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
