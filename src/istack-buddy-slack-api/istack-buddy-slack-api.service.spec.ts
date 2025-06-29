import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';

describe('IstackBuddySlackApiService', () => {
  let service: IstackBuddySlackApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IstackBuddySlackApiService],
    }).compile();

    service = module.get<IstackBuddySlackApiService>(IstackBuddySlackApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
