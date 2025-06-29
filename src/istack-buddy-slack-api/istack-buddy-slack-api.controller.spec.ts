import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';

describe('IstackBuddySlackApiController', () => {
  let controller: IstackBuddySlackApiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IstackBuddySlackApiController],
      providers: [IstackBuddySlackApiService],
    }).compile();

    controller = module.get<IstackBuddySlackApiController>(IstackBuddySlackApiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
