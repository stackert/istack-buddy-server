import { Test, TestingModule } from '@nestjs/testing';
import {
  ConversationListService,
  ConversationListSlackAppService,
} from './ConversationListService';
import {
  ConversationListSlackApp,
  ConversationMessageFactory,
} from './ConversationListSlackApp';
import { AbstractConversationListSlackApp } from './AbstractConversationListSlackApp';
import type { TConversationListItem } from './types';

// Mock conversation class for testing generic functionality
class MockConversation extends AbstractConversationListSlackApp<TConversationListItem> {
  constructor(id: string, name: string, description: string) {
    super(id, name, description, new Date(), new Date());
  }
}

describe('ConversationListService', () => {
  let service: ConversationListService<MockConversation>;
  let mockFactory: jest.Mock;

  beforeEach(() => {
    mockFactory = jest.fn((id: string, name: string, description: string) => {
      return new MockConversation(id, name, description);
    });
    service = new ConversationListService(mockFactory);
  });

  describe('getConversationById', () => {
    it('should return undefined when conversation does not exist', () => {
      const result = service.getConversationById('nonexistent-id');
      expect(result).toBeUndefined();
    });

    it('should return existing conversation when it exists', () => {
      const conversationId = 'test-conversation-1';
      const createdConversation =
        service.getConversationOrCreate(conversationId);

      const retrievedConversation = service.getConversationById(conversationId);

      expect(retrievedConversation).toBeDefined();
      expect(retrievedConversation).toBe(createdConversation);
      expect(retrievedConversation!.id).toBe(conversationId);
    });
  });

  describe('getConversationOrCreate', () => {
    it('should create a new conversation when it does not exist', () => {
      const conversationId = 'new-conversation';
      const name = 'Test Conversation';
      const description = 'Test Description';

      const conversation = service.getConversationOrCreate(
        conversationId,
        name,
        description,
      );

      expect(conversation).toBeDefined();
      expect(conversation.id).toBe(conversationId);
      expect(conversation.name).toBe(name);
      expect(conversation.description).toBe(description);
      expect(mockFactory).toHaveBeenCalledWith(
        conversationId,
        name,
        description,
      );
      expect(mockFactory).toHaveBeenCalledTimes(1);
    });

    it('should return existing conversation when it already exists', () => {
      const conversationId = 'existing-conversation';
      const firstConversation = service.getConversationOrCreate(
        conversationId,
        'First Name',
        'First Description',
      );

      const secondConversation = service.getConversationOrCreate(
        conversationId,
        'Second Name',
        'Second Description',
      );

      expect(secondConversation).toBe(firstConversation);
      expect(mockFactory).toHaveBeenCalledTimes(1); // Factory should only be called once
    });

    it('should use default values when name and description are not provided', () => {
      const conversationId = 'default-conversation';

      const conversation = service.getConversationOrCreate(conversationId);

      expect(conversation.name).toBe(`Conversation ${conversationId}`);
      expect(conversation.description).toBe(
        `Auto-created conversation for ${conversationId}`,
      );
    });

    it('should log warning when acceptKey is provided but not validated', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const conversationId = 'secure-conversation';
      const acceptKey = 'test-key';

      service.getConversationOrCreate(
        conversationId,
        'Test',
        'Test',
        acceptKey,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        `AcceptKey provided but validation not implemented: ${acceptKey}`,
      );
      consoleSpy.mockRestore();
    });
  });

  describe('hasConversation', () => {
    it('should return false when conversation does not exist', () => {
      expect(service.hasConversation('nonexistent-id')).toBe(false);
    });

    it('should return true when conversation exists', () => {
      const conversationId = 'existing-conversation';
      service.getConversationOrCreate(conversationId);

      expect(service.hasConversation(conversationId)).toBe(true);
    });
  });

  describe('removeConversation', () => {
    it('should return false when trying to remove nonexistent conversation', () => {
      const result = service.removeConversation('nonexistent-id');
      expect(result).toBe(false);
    });

    it('should return true and remove existing conversation', () => {
      const conversationId = 'conversation-to-remove';
      service.getConversationOrCreate(conversationId);

      expect(service.hasConversation(conversationId)).toBe(true);

      const result = service.removeConversation(conversationId);

      expect(result).toBe(true);
      expect(service.hasConversation(conversationId)).toBe(false);
    });
  });

  describe('getAllConversationIds', () => {
    it('should return empty array when no conversations exist', () => {
      const ids = service.getAllConversationIds();
      expect(ids).toEqual([]);
    });

    it('should return all conversation IDs', () => {
      const conversationIds = ['conv-1', 'conv-2', 'conv-3'];
      conversationIds.forEach((id) => service.getConversationOrCreate(id));

      const retrievedIds = service.getAllConversationIds();

      expect(retrievedIds).toHaveLength(3);
      expect(retrievedIds.sort()).toEqual(conversationIds.sort());
    });
  });

  describe('getAllConversations', () => {
    it('should return empty array when no conversations exist', () => {
      const conversations = service.getAllConversations();
      expect(conversations).toEqual([]);
    });

    it('should return all conversation instances', () => {
      const conversationIds = ['conv-1', 'conv-2'];
      const createdConversations = conversationIds.map((id) =>
        service.getConversationOrCreate(id),
      );

      const retrievedConversations = service.getAllConversations();

      expect(retrievedConversations).toHaveLength(2);
      expect(retrievedConversations).toEqual(
        expect.arrayContaining(createdConversations),
      );
    });
  });

  describe('getConversationCount', () => {
    it('should return 0 when no conversations exist', () => {
      expect(service.getConversationCount()).toBe(0);
    });

    it('should return correct count of conversations', () => {
      service.getConversationOrCreate('conv-1');
      expect(service.getConversationCount()).toBe(1);

      service.getConversationOrCreate('conv-2');
      expect(service.getConversationCount()).toBe(2);

      service.removeConversation('conv-1');
      expect(service.getConversationCount()).toBe(1);
    });
  });

  describe('clearAllConversations', () => {
    it('should remove all conversations', () => {
      service.getConversationOrCreate('conv-1');
      service.getConversationOrCreate('conv-2');
      service.getConversationOrCreate('conv-3');

      expect(service.getConversationCount()).toBe(3);

      service.clearAllConversations();

      expect(service.getConversationCount()).toBe(0);
      expect(service.getAllConversationIds()).toEqual([]);
    });
  });
});

describe('ConversationListSlackAppService', () => {
  let service: ConversationListSlackAppService;

  beforeEach(() => {
    service = new ConversationListSlackAppService();
  });

  describe('constructor', () => {
    it('should create service with ConversationListSlackApp factory', () => {
      const conversationId = 'test-slack-conversation';
      const conversation = service.getConversationOrCreate(conversationId);

      expect(conversation).toBeInstanceOf(ConversationListSlackApp);
      expect(conversation.id).toBe(conversationId);
    });
  });

  describe('getCustomerSupportConversationOrCreate', () => {
    it('should create conversation with customer support naming convention', () => {
      const conversationId = 'cs-conversation-1';
      const customerId = 'customer-123';

      const conversation = service.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
      );

      expect(conversation.id).toBe(conversationId);
      expect(conversation.name).toBe(`Customer Support - ${customerId}`);
      expect(conversation.description).toBe(
        `Customer support conversation for customer ${customerId}`,
      );
    });

    it('should return existing conversation if it already exists', () => {
      const conversationId = 'cs-conversation-2';
      const customerId = 'customer-456';

      const firstConversation = service.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
      );
      const secondConversation = service.getCustomerSupportConversationOrCreate(
        conversationId,
        'different-customer',
      );

      expect(secondConversation).toBe(firstConversation);
      expect(secondConversation.name).toBe(`Customer Support - ${customerId}`); // Should keep original name
    });

    it('should handle acceptKey parameter', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const conversationId = 'cs-secure-conversation';
      const customerId = 'customer-789';
      const acceptKey = 'secure-key';

      const conversation = service.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
        acceptKey,
      );

      expect(conversation).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        `AcceptKey provided but validation not implemented: ${acceptKey}`,
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getTeamConversationOrCreate', () => {
    it('should create conversation with team naming convention', () => {
      const conversationId = 'team-conversation-1';
      const teamName = 'Engineering Team';

      const conversation = service.getTeamConversationOrCreate(
        conversationId,
        teamName,
      );

      expect(conversation.id).toBe(conversationId);
      expect(conversation.name).toBe(`Team Chat - ${teamName}`);
      expect(conversation.description).toBe(
        `Team conversation for ${teamName}`,
      );
    });

    it('should return existing conversation if it already exists', () => {
      const conversationId = 'team-conversation-2';
      const teamName = 'Design Team';

      const firstConversation = service.getTeamConversationOrCreate(
        conversationId,
        teamName,
      );
      const secondConversation = service.getTeamConversationOrCreate(
        conversationId,
        'Different Team',
      );

      expect(secondConversation).toBe(firstConversation);
      expect(secondConversation.name).toBe(`Team Chat - ${teamName}`); // Should keep original name
    });

    it('should handle acceptKey parameter', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const conversationId = 'team-secure-conversation';
      const teamName = 'Security Team';
      const acceptKey = 'team-key';

      const conversation = service.getTeamConversationOrCreate(
        conversationId,
        teamName,
        acceptKey,
      );

      expect(conversation).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        `AcceptKey provided but validation not implemented: ${acceptKey}`,
      );
      consoleSpy.mockRestore();
    });
  });

  describe('integration with ConversationListSlackApp', () => {
    it('should allow adding messages to created conversations', () => {
      const conversationId = 'message-test-conversation';
      const conversation = service.getConversationOrCreate(conversationId);

      // Add a customer message
      const customerMessage = ConversationMessageFactory.createCustomerMessage(
        'msg-1',
        'customer-1',
        'Hello, I need help!',
      );
      const message = conversation.addMessage(customerMessage);

      expect(conversation.getMessageCount()).toBe(1);
      expect(message.content.payload).toBe('Hello, I need help!');
      expect(message.authorRole).toBe('cx-customer');
    });

    it('should maintain conversation state across service calls', () => {
      const conversationId = 'state-test-conversation';

      // Get conversation and add a message
      const conversation1 = service.getConversationOrCreate(conversationId);
      conversation1.addAgentMessage(
        'msg-1',
        'agent-1',
        'Hello! How can I help you?',
      );

      // Get the same conversation again
      const conversation2 = service.getConversationById(conversationId);

      expect(conversation2).toBe(conversation1);
      expect(conversation2!.getMessageCount()).toBe(1);
    });
  });
});

describe('ConversationListSlackAppService (NestJS DI)', () => {
  let service: ConversationListSlackAppService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [ConversationListSlackAppService],
    }).compile();

    service = module.get<ConversationListSlackAppService>(
      ConversationListSlackAppService,
    );
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create conversations through dependency injection', () => {
    const conversationId = 'di-test-conversation';
    const conversation = service.getConversationOrCreate(conversationId);

    expect(conversation).toBeInstanceOf(ConversationListSlackApp);
    expect(conversation.id).toBe(conversationId);
  });

  it('should maintain singleton behavior across injections', () => {
    const conversationId = 'singleton-test-conversation';

    // Create conversation through first service reference
    const conversation1 = service.getConversationOrCreate(conversationId);

    // Get the same service instance (singleton)
    const sameService = module.get<ConversationListSlackAppService>(
      ConversationListSlackAppService,
    );
    const conversation2 = sameService.getConversationById(conversationId);

    expect(conversation2).toBe(conversation1);
    expect(service).toBe(sameService); // Singleton behavior
  });

  it('should work with customer support conversation creation', () => {
    const conversationId = 'di-cs-conversation';
    const customerId = 'di-customer-123';

    const conversation = service.getCustomerSupportConversationOrCreate(
      conversationId,
      customerId,
    );

    expect(conversation.id).toBe(conversationId);
    expect(conversation.name).toBe(`Customer Support - ${customerId}`);
  });
});
