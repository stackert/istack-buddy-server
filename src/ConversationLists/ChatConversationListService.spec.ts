import { Test, TestingModule } from '@nestjs/testing';
import { ChatConversationListService } from './ChatConversationListService';
import { ChatConversationList } from './ChatConversationList';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';

describe('ChatConversationListService', () => {
  let service: ChatConversationListService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatConversationListService],
    }).compile();

    service = module.get<ChatConversationListService>(
      ChatConversationListService,
    );
  });

  afterEach(() => {
    service.clearAllConversations();
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
      const conversation = service.getConversationOrCreate('test-conversation');
      const result = service.getConversationById('test-conversation');
      expect(result).toBe(conversation);
    });
  });

  describe('getConversationOrCreate', () => {
    it('should create new conversation when it does not exist', () => {
      const conversation = service.getConversationOrCreate('new-conversation');
      expect(conversation).toBeInstanceOf(ChatConversationList);
      expect(service.hasConversation('new-conversation')).toBe(true);
    });

    it('should return existing conversation when it exists', () => {
      const firstCall = service.getConversationOrCreate('test-conversation');
      const secondCall = service.getConversationOrCreate('test-conversation');
      expect(firstCall).toBe(secondCall);
    });
  });

  describe('hasConversation', () => {
    it('should return false for non-existent conversation', () => {
      expect(service.hasConversation('non-existent')).toBe(false);
    });

    it('should return true for existing conversation', () => {
      service.getConversationOrCreate('test-conversation');
      expect(service.hasConversation('test-conversation')).toBe(true);
    });
  });

  describe('removeConversation', () => {
    it('should return false when conversation does not exist', () => {
      const result = service.removeConversation('non-existent');
      expect(result).toBe(false);
    });

    it('should remove existing conversation and return true', () => {
      service.getConversationOrCreate('test-conversation');
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
      service.getConversationOrCreate('conv1');
      service.getConversationOrCreate('conv2');
      service.getConversationOrCreate('conv3');

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
      const conv1 = service.getConversationOrCreate('conv1');
      const conv2 = service.getConversationOrCreate('conv2');

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
      service.getConversationOrCreate('conv1');
      service.getConversationOrCreate('conv2');
      expect(service.getConversationCount()).toBe(2);
    });
  });

  describe('clearAllConversations', () => {
    it('should remove all conversations', () => {
      service.getConversationOrCreate('conv1');
      service.getConversationOrCreate('conv2');
      expect(service.getConversationCount()).toBe(2);

      service.clearAllConversations();
      expect(service.getConversationCount()).toBe(0);
      expect(service.getAllConversationIds()).toEqual([]);
    });
  });

  describe('addMessageToConversation', () => {
    it('should add message to existing conversation', () => {
      const message: IConversationMessage = {
        id: 'msg1',
        content: 'Test message',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const messageId = service.addMessageToConversation('conv1', message);
      expect(messageId).toBe('msg1');

      const conversation = service.getConversationById('conv1');
      expect(conversation).toBeDefined();
    });

    it('should create conversation and add message if conversation does not exist', () => {
      const message: IConversationMessage = {
        id: 'msg1',
        content: 'Test message',
        conversationId: 'new-conv',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const messageId = service.addMessageToConversation('new-conv', message);
      expect(messageId).toBe('msg1');
      expect(service.hasConversation('new-conv')).toBe(true);
    });
  });

  describe('getFilteredMessages', () => {
    it('should return empty array for non-existent conversation', () => {
      const messages = service.getFilteredMessages('non-existent', {});
      expect(messages).toEqual([]);
    });

    it('should return filtered messages from existing conversation', () => {
      const message1: IConversationMessage = {
        id: 'msg1',
        content: 'Message from user1',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message2: IConversationMessage = {
        id: 'msg2',
        content: 'Message from user2',
        conversationId: 'conv1',
        fromUserId: 'user2',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', message1);
      service.addMessageToConversation('conv1', message2);

      const filteredMessages = service.getFilteredMessages('conv1', {
        fromUserId: 'user1',
      });
      expect(filteredMessages).toHaveLength(1);
      expect(filteredMessages[0].fromUserId).toBe('user1');
    });
  });

  describe('getFilteredRobotMessages', () => {
    it('should return empty array for non-existent conversation', () => {
      const messages = service.getFilteredRobotMessages('non-existent');
      expect(messages).toEqual([]);
    });

    it('should return robot messages from existing conversation', () => {
      const message: IConversationMessage = {
        id: 'msg1',
        content: 'Robot message',
        conversationId: 'conv1',
        fromUserId: 'robot1',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', message);
      const robotMessages = service.getFilteredRobotMessages('conv1');
      expect(robotMessages).toHaveLength(1);
    });
  });

  describe('getMessagesVisibleToRole', () => {
    it('should return empty array for non-existent conversation', () => {
      const messages = service.getMessagesVisibleToRole(
        'non-existent',
        UserRole.CUSTOMER,
      );
      expect(messages).toEqual([]);
    });

    it('should return messages visible to specified role', () => {
      const message: IConversationMessage = {
        id: 'msg1',
        content: 'Test message',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', message);
      const visibleMessages = service.getMessagesVisibleToRole(
        'conv1',
        UserRole.CUSTOMER,
      );
      expect(visibleMessages).toHaveLength(1);
    });
  });

  describe('getMessagesForRobotProcessing', () => {
    it('should return empty array for non-existent conversation', () => {
      const messages = service.getMessagesForRobotProcessing('non-existent');
      expect(messages).toEqual([]);
    });

    it('should return messages for robot processing', () => {
      const message: IConversationMessage = {
        id: 'msg1',
        content: 'Message for robot',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
        messageType: MessageType.ROBOT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', message);
      const robotMessages = service.getMessagesForRobotProcessing('conv1');
      expect(robotMessages).toHaveLength(1);
    });
  });

  describe('getRecentMessagesWithinTokenLimit', () => {
    it('should return empty array for non-existent conversation', () => {
      const estimateTokens = jest.fn().mockReturnValue(10);
      const messages = service.getRecentMessagesWithinTokenLimit(
        'non-existent',
        100,
        estimateTokens,
      );
      expect(messages).toEqual([]);
    });

    it('should return messages within token limit', () => {
      const message: IConversationMessage = {
        id: 'msg1',
        content: 'Short message',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', message);
      const estimateTokens = jest.fn().mockReturnValue(10);
      const messages = service.getRecentMessagesWithinTokenLimit(
        'conv1',
        100,
        estimateTokens,
      );
      expect(messages).toHaveLength(1);
    });
  });

  describe('getMessagesByUser', () => {
    it('should return empty array for non-existent conversation', () => {
      const messages = service.getMessagesByUser('non-existent', 'user1');
      expect(messages).toEqual([]);
    });

    it('should return messages from specific user', () => {
      const message1: IConversationMessage = {
        id: 'msg1',
        content: 'Message from user1',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message2: IConversationMessage = {
        id: 'msg2',
        content: 'Message from user2',
        conversationId: 'conv1',
        fromUserId: 'user2',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', message1);
      service.addMessageToConversation('conv1', message2);

      const userMessages = service.getMessagesByUser('conv1', 'user1');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].fromUserId).toBe('user1');
    });
  });

  describe('getMessagesByType', () => {
    it('should return empty array for non-existent conversation', () => {
      const messages = service.getMessagesByType(
        'non-existent',
        MessageType.TEXT,
      );
      expect(messages).toEqual([]);
    });

    it('should return messages of specific type', () => {
      const message: IConversationMessage = {
        id: 'msg1',
        content: 'Text message',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', message);
      const textMessages = service.getMessagesByType('conv1', MessageType.TEXT);
      expect(textMessages).toHaveLength(1);
      expect(textMessages[0].messageType).toBe(MessageType.TEXT);
    });
  });

  describe('getLatestMessage', () => {
    it('should return undefined for non-existent conversation', () => {
      const message = service.getLatestMessage('non-existent');
      expect(message).toBeUndefined();
    });

    it('should return the latest message from conversation', () => {
      const message1: IConversationMessage = {
        id: 'msg1',
        content: 'First message',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T10:00:00Z'),
      };

      const message2: IConversationMessage = {
        id: 'msg2',
        content: 'Second message',
        conversationId: 'conv1',
        fromUserId: 'user2',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date('2023-01-01T11:00:00Z'),
        updatedAt: new Date('2023-01-01T11:00:00Z'),
      };

      service.addMessageToConversation('conv1', message1);
      service.addMessageToConversation('conv1', message2);

      const latestMessage = service.getLatestMessage('conv1');
      expect(latestMessage?.id).toBe('msg2');
    });
  });

  describe('getMessageCountsByType', () => {
    it('should return empty counts for non-existent conversation', () => {
      const counts = service.getMessageCountsByType('non-existent');
      expect(counts).toEqual({
        [MessageType.TEXT]: 0,
        [MessageType.SYSTEM]: 0,
        [MessageType.ROBOT]: 0,
      });
    });

    it('should return correct message counts by type', () => {
      const textMessage: IConversationMessage = {
        id: 'msg1',
        content: 'Text message',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const systemMessage: IConversationMessage = {
        id: 'msg2',
        content: 'System message',
        conversationId: 'conv1',
        fromUserId: 'system',
        fromRole: UserRole.SYSTEM_DEBUG,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.SYSTEM,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', textMessage);
      service.addMessageToConversation('conv1', systemMessage);

      const counts = service.getMessageCountsByType('conv1');
      expect(counts[MessageType.TEXT]).toBe(1);
      expect(counts[MessageType.SYSTEM]).toBe(1);
      expect(counts[MessageType.ROBOT]).toBe(0);
    });
  });

  describe('getMessageCount', () => {
    it('should return 0 for non-existent conversation', () => {
      const count = service.getMessageCount('non-existent');
      expect(count).toBe(0);
    });

    it('should return correct message count', () => {
      const message1: IConversationMessage = {
        id: 'msg1',
        content: 'First message',
        conversationId: 'conv1',
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message2: IConversationMessage = {
        id: 'msg2',
        content: 'Second message',
        conversationId: 'conv1',
        fromUserId: 'user2',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.addMessageToConversation('conv1', message1);
      service.addMessageToConversation('conv1', message2);

      const count = service.getMessageCount('conv1');
      expect(count).toBe(2);
    });
  });
});
