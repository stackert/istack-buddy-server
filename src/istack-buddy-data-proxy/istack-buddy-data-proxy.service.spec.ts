import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddyDataProxyService } from './istack-buddy-data-proxy.service';

describe('IstackBuddyDataProxyService', () => {
  let service: IstackBuddyDataProxyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IstackBuddyDataProxyService],
    }).compile();

    service = module.get<IstackBuddyDataProxyService>(IstackBuddyDataProxyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
