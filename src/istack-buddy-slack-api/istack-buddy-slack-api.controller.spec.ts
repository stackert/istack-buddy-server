import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ConversationListServiceModule } from '../ConversationLists';
import { RobotModule } from '../robots/robot.module';

describe('IstackBuddySlackApiController', () => {
  let controller: IstackBuddySlackApiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConversationListServiceModule, RobotModule],
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
