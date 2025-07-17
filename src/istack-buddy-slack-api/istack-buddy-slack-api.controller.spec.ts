import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ConversationListServiceModule } from '../ConversationLists';
import { RobotModule } from '../robots/robot.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';

describe('IstackBuddySlackApiController', () => {
  let controller: IstackBuddySlackApiController;

  beforeEach(async () => {
    // Clear all timers and mock setInterval to prevent hanging tests
    jest.clearAllTimers();
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval').mockImplementation(
      () =>
        ({
          unref: jest.fn(),
          ref: jest.fn(),
          hasRef: jest.fn().mockReturnValue(false),
          refresh: jest.fn(),
          [Symbol.toPrimitive]: jest.fn(),
          [Symbol.dispose]: jest.fn(),
        }) as any,
    );

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConversationListServiceModule, RobotModule, ChatManagerModule],
      controllers: [IstackBuddySlackApiController],
      providers: [IstackBuddySlackApiService],
    }).compile();

    controller = module.get<IstackBuddySlackApiController>(
      IstackBuddySlackApiController,
    );
  });

  afterEach(() => {
    // Clear all timers and restore original functions
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
