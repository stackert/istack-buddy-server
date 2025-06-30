import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ConversationListServiceModule } from '../ConversationLists';

describe('IstackBuddySlackApiController', () => {
  let controller: IstackBuddySlackApiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConversationListServiceModule],
      controllers: [IstackBuddySlackApiController],
      providers: [IstackBuddySlackApiService],
    }).compile();

    controller = module.get<IstackBuddySlackApiController>(
      IstackBuddySlackApiController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
