import { Test, TestingModule } from '@nestjs/testing';
import { ConversationListServiceModule } from './ConversationListService.module';
import { ConversationListSlackAppService } from './ConversationListService';

describe('ConversationListServiceModule', () => {
  let module: TestingModule;
  let service: ConversationListSlackAppService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConversationListServiceModule],
    }).compile();

    service = module.get<ConversationListSlackAppService>(
      ConversationListSlackAppService,
    );
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide ConversationListSlackAppService', () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ConversationListSlackAppService);
  });

  it('should export ConversationListSlackAppService', () => {
    // Test that the service can be resolved from the module
    expect(service).toBeDefined();

    // Test basic functionality
    const conversationId = 'module-test-conversation';
    const conversation = service.getConversationOrCreate(conversationId);

    expect(conversation.id).toBe(conversationId);
  });

  it('should maintain singleton behavior within module', () => {
    const service1 = module.get<ConversationListSlackAppService>(
      ConversationListSlackAppService,
    );
    const service2 = module.get<ConversationListSlackAppService>(
      ConversationListSlackAppService,
    );

    expect(service1).toBe(service2); // Should be the same instance

    // Test that conversations are shared between service references
    const conversationId = 'singleton-module-test';
    const conversation1 = service1.getConversationOrCreate(conversationId);
    const conversation2 = service2.getConversationById(conversationId);

    expect(conversation2).toBe(conversation1);
  });
});
