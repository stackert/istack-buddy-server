import { Test, TestingModule } from '@nestjs/testing';
import { ChatManagerGateway } from './chat-manager.gateway';
import { ChatManagerService } from './chat-manager.service';
import { ConversationListSlackAppService } from '../ConversationLists/ConversationListService';

describe('ChatManagerGateway', () => {
  let gateway: ChatManagerGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatManagerGateway,
        ChatManagerService,
        ConversationListSlackAppService,
      ],
    }).compile();

    gateway = module.get<ChatManagerGateway>(ChatManagerGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
