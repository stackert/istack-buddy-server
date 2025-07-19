import { Test, TestingModule } from '@nestjs/testing';
import { ConversationListService } from './ConversationListService';
import { AbstractConversationMessageList } from './AbstractConversationMessageList';

// Mock implementation for testing
class MockConversationList extends AbstractConversationMessageList<any> {
  constructor(
    public id: string,
    public name: string,
    public description: string,
  ) {
    super();
  }

  addMessage(message: any): string {
    return message.id || 'mock-message-id';
  }

  getMessages(): any[] {
    return [];
  }

  getFilteredMessages(filterOptions: any): any[] {
    return [];
  }

  getMessageCount(): number {
    return 0;
  }

  getLatestMessage(): any {
    return undefined;
  }

  getMessageCountsByType(): Record<string, number> {
    return {};
  }
}

describe('ConversationListService', () => {
  let service: ConversationListService<MockConversationList>;
  let mockFactory: jest.MockedFunction<
    (id: string, name: string, description: string) => MockConversationList
  >;

  beforeEach(async () => {
    mockFactory = jest
      .fn()
      .mockImplementation((id: string, name: string, description: string) => {
        return new MockConversationList(id, name, description);
      });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConversationListService,
          useFactory: () =>
            new ConversationListService<MockConversationList>(mockFactory),
        },
      ],
    }).compile();

    service = module.get<ConversationListService<MockConversationList>>(
      ConversationListService,
    );
  });

  afterEach(() => {
    service.clearAllConversations();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConversationById', () => {
    it('should return undefined for non-existent conversation', () => {
      const result = service.getConversationById('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return conversation when it exists', () => {
      const conversation = service.getConversationOrCreate(
        'test-conversation',
        'Test',
        'Test Description',
      );
      const result = service.getConversationById('test-conversation');
      expect(result).toBe(conversation);
    });
  });

  describe('getConversationOrCreate', () => {
    it('should create new conversation when it does not exist', () => {
      const conversation = service.getConversationOrCreate(
        'new-conversation',
        'New Conv',
        'New Description',
      );
      expect(conversation).toBeInstanceOf(MockConversationList);
      expect(conversation.id).toBe('new-conversation');
      expect(conversation.name).toBe('New Conv');
      expect(conversation.description).toBe('New Description');
      expect(service.hasConversation('new-conversation')).toBe(true);
      expect(mockFactory).toHaveBeenCalledWith(
        'new-conversation',
        'New Conv',
        'New Description',
      );
    });

    it('should return existing conversation when it exists', () => {
      const firstCall = service.getConversationOrCreate(
        'test-conversation',
        'Test',
        'Test Description',
      );
      const secondCall = service.getConversationOrCreate(
        'test-conversation',
        'Different',
        'Different Description',
      );
      expect(firstCall).toBe(secondCall);
      expect(mockFactory).toHaveBeenCalledTimes(1); // Should only be called once
    });

    it('should use default name and description when not provided', () => {
      const conversation = service.getConversationOrCreate('default-conv');
      expect(conversation.name).toBe('Conversation default-conv');
      expect(conversation.description).toBe(
        'Auto-created conversation for default-conv',
      );
      expect(mockFactory).toHaveBeenCalledWith(
        'default-conv',
        'Conversation default-conv',
        'Auto-created conversation for default-conv',
      );
    });

    it('should handle acceptKey parameter without validation', () => {
      const conversation = service.getConversationOrCreate(
        'key-conv',
        'Key Conv',
        'Key Description',
        'some-key',
      );
      expect(conversation).toBeInstanceOf(MockConversationList);
      expect(service.hasConversation('key-conv')).toBe(true);
    });
  });

  describe('hasConversation', () => {
    it('should return false for non-existent conversation', () => {
      expect(service.hasConversation('non-existent')).toBe(false);
    });

    it('should return true for existing conversation', () => {
      service.getConversationOrCreate(
        'test-conversation',
        'Test',
        'Test Description',
      );
      expect(service.hasConversation('test-conversation')).toBe(true);
    });
  });

  describe('removeConversation', () => {
    it('should return false when conversation does not exist', () => {
      const result = service.removeConversation('non-existent');
      expect(result).toBe(false);
    });

    it('should remove existing conversation and return true', () => {
      service.getConversationOrCreate(
        'test-conversation',
        'Test',
        'Test Description',
      );
      expect(service.hasConversation('test-conversation')).toBe(true);

      const result = service.removeConversation('test-conversation');
      expect(result).toBe(true);
      expect(service.hasConversation('test-conversation')).toBe(false);
    });
  });

  describe('getAllConversationIds', () => {
    it('should return empty array when no conversations exist', () => {
      const ids = service.getAllConversationIds();
      expect(ids).toEqual([]);
    });

    it('should return all conversation IDs', () => {
      service.getConversationOrCreate('conv1', 'Conv1', 'Description1');
      service.getConversationOrCreate('conv2', 'Conv2', 'Description2');
      service.getConversationOrCreate('conv3', 'Conv3', 'Description3');

      const ids = service.getAllConversationIds();
      expect(ids).toContain('conv1');
      expect(ids).toContain('conv2');
      expect(ids).toContain('conv3');
      expect(ids).toHaveLength(3);
    });
  });

  describe('getAllConversations', () => {
    it('should return empty array when no conversations exist', () => {
      const conversations = service.getAllConversations();
      expect(conversations).toEqual([]);
    });

    it('should return all conversation instances', () => {
      const conv1 = service.getConversationOrCreate(
        'conv1',
        'Conv1',
        'Description1',
      );
      const conv2 = service.getConversationOrCreate(
        'conv2',
        'Conv2',
        'Description2',
      );

      const conversations = service.getAllConversations();
      expect(conversations).toContain(conv1);
      expect(conversations).toContain(conv2);
      expect(conversations).toHaveLength(2);
    });
  });

  describe('getConversationCount', () => {
    it('should return 0 when no conversations exist', () => {
      expect(service.getConversationCount()).toBe(0);
    });

    it('should return correct count of conversations', () => {
      service.getConversationOrCreate('conv1', 'Conv1', 'Description1');
      service.getConversationOrCreate('conv2', 'Conv2', 'Description2');
      expect(service.getConversationCount()).toBe(2);
    });
  });

  describe('clearAllConversations', () => {
    it('should remove all conversations', () => {
      service.getConversationOrCreate('conv1', 'Conv1', 'Description1');
      service.getConversationOrCreate('conv2', 'Conv2', 'Description2');
      expect(service.getConversationCount()).toBe(2);

      service.clearAllConversations();
      expect(service.getConversationCount()).toBe(0);
      expect(service.getAllConversationIds()).toEqual([]);
    });
  });

  describe('conversationFactory', () => {
    it('should use the provided factory function', () => {
      const customFactory = jest
        .fn()
        .mockReturnValue(
          new MockConversationList('custom', 'Custom', 'Custom Desc'),
        );
      const customService = new ConversationListService<MockConversationList>(
        customFactory,
      );

      customService.getConversationOrCreate('test', 'Test', 'Test Desc');
      expect(customFactory).toHaveBeenCalledWith('test', 'Test', 'Test Desc');
    });
  });
});
