import { Test, TestingModule } from '@nestjs/testing';
import { ChatConversationListService } from './ChatConversationListService';
import { ChatConversationList } from './ChatConversationList';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';
import { mockConversationMessages } from '../../test-data/mocks/conversation-messages';

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

  describe('getConversationById', () => {
    it('should return undefined for non-existent conversation', () => {
      const result = service.getConversationById('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('should return conversation when it exists', () => {
      const conversationId = 'test-conversation';
      const conversation = service.getConversationOrCreate(conversationId);

      const result = service.getConversationById(conversationId);
      expect(result).toBe(conversation);
    });
  });

  describe('getConversationOrCreate', () => {
    it('should return existing conversation', () => {
      const conversationId = 'test-conversation';
      const conversation1 = service.getConversationOrCreate(conversationId);
      const conversation2 = service.getConversationOrCreate(conversationId);

      expect(conversation1).toBe(conversation2);
    });

    it('should create new conversation when it does not exist', () => {
      const conversationId = 'new-conversation';
      const conversation = service.getConversationOrCreate(conversationId);

      expect(conversation).toBeInstanceOf(ChatConversationList);
      expect(service.getConversationById(conversationId)).toBe(conversation);
    });
  });

  describe('hasConversation', () => {
    it('should return false for non-existent conversation', () => {
      const result = service.hasConversation('non-existent-id');
      expect(result).toBe(false);
    });

    it('should return true for existing conversation', () => {
      const conversationId = 'test-conversation';
      service.getConversationOrCreate(conversationId);

      const result = service.hasConversation(conversationId);
      expect(result).toBe(true);
    });
  });

  describe('removeConversation', () => {
    it('should return false when conversation does not exist', () => {
      const result = service.removeConversation('non-existent-id');
      expect(result).toBe(false);
    });

    it('should remove existing conversation and return true', () => {
      const conversationId = 'test-conversation';
      service.getConversationOrCreate(conversationId);

      expect(service.hasConversation(conversationId)).toBe(true);

      const result = service.removeConversation(conversationId);
      expect(result).toBe(true);
      expect(service.hasConversation(conversationId)).toBe(false);
    });
  });

  describe('getAllConversationIds', () => {
    it('should return empty array when no conversations exist', () => {
      const result = service.getAllConversationIds();
      expect(result).toEqual([]);
    });

    it('should return all conversation IDs', () => {
      const conversationId1 = 'conversation-1';
      const conversationId2 = 'conversation-2';

      service.getConversationOrCreate(conversationId1);
      service.getConversationOrCreate(conversationId2);

      const result = service.getAllConversationIds();
      expect(result).toContain(conversationId1);
      expect(result).toContain(conversationId2);
      expect(result).toHaveLength(2);
    });
  });

  describe('getAllConversations', () => {
    it('should return empty array when no conversations exist', () => {
      const result = service.getAllConversations();
      expect(result).toEqual([]);
    });

    it('should return all conversation instances', () => {
      const conversationId1 = 'conversation-1';
      const conversationId2 = 'conversation-2';

      const conversation1 = service.getConversationOrCreate(conversationId1);
      const conversation2 = service.getConversationOrCreate(conversationId2);

      const result = service.getAllConversations();
      expect(result).toContain(conversation1);
      expect(result).toContain(conversation2);
      expect(result).toHaveLength(2);
    });
  });

  describe('getConversationCount', () => {
    it('should return 0 when no conversations exist', () => {
      const result = service.getConversationCount();
      expect(result).toBe(0);
    });

    it('should return correct count of conversations', () => {
      service.getConversationOrCreate('conversation-1');
      service.getConversationOrCreate('conversation-2');
      service.getConversationOrCreate('conversation-3');

      const result = service.getConversationCount();
      expect(result).toBe(3);
    });
  });

  describe('clearAllConversations', () => {
    it('should remove all conversations', () => {
      service.getConversationOrCreate('conversation-1');
      service.getConversationOrCreate('conversation-2');

      expect(service.getConversationCount()).toBe(2);

      service.clearAllConversations();

      expect(service.getConversationCount()).toBe(0);
      expect(service.getAllConversationIds()).toEqual([]);
    });
  });

  describe('addMessageToConversation', () => {
    it('should add message to existing conversation', () => {
      const conversationId = 'test-conversation';
      const message = mockConversationMessages.customerMessage('Hello');

      service.getConversationOrCreate(conversationId);
      const messageId = service.addMessageToConversation(
        conversationId,
        message,
      );

      expect(messageId).toBe(message.id);

      const conversation = service.getConversationById(conversationId);
      const messages = conversation!.getAllChatMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe(message);
    });

    it('should create conversation and add message if conversation does not exist', () => {
      const conversationId = 'new-conversation';
      const message = mockConversationMessages.customerMessage('Hello');

      const messageId = service.addMessageToConversation(
        conversationId,
        message,
      );

      expect(messageId).toBe(message.id);
      expect(service.hasConversation(conversationId)).toBe(true);

      const conversation = service.getConversationById(conversationId);
      const messages = conversation!.getAllChatMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe(message);
    });
  });

  describe('getFilteredMessages', () => {
    it('should return empty array for non-existent conversation', () => {
      const result = service.getFilteredMessages('non-existent', {});
      expect(result).toEqual([]);
    });

    it('should return filtered messages for existing conversation', () => {
      const conversationId = 'test-conversation';
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      message1.authorUserId = 'user1';
      message2.authorUserId = 'user2';

      service.addMessageToConversation(conversationId, message1);
      service.addMessageToConversation(conversationId, message2);

      const result = service.getFilteredMessages(conversationId, {
        authorUserId: 'user1',
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(message1);
    });
  });

  describe('getFilteredRobotMessages', () => {
    it('should return empty array for non-existent conversation', () => {
      const result = service.getFilteredRobotMessages('non-existent');
      expect(result).toEqual([]);
    });

    it('should return robot messages for existing conversation', () => {
      const conversationId = 'test-conversation';
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');
      robotMessage.fromRole = UserRole.ROBOT;

      service.addMessageToConversation(conversationId, customerMessage);
      service.addMessageToConversation(conversationId, robotMessage);

      const result = service.getFilteredRobotMessages(conversationId);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(robotMessage);
    });
  });

  describe('getMessagesVisibleToRole', () => {
    it('should return empty array for non-existent conversation', () => {
      const result = service.getMessagesVisibleToRole(
        'non-existent',
        UserRole.CUSTOMER,
      );
      expect(result).toEqual([]);
    });

    it('should return messages visible to customer role', () => {
      const conversationId = 'test-conversation';
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const agentMessage = mockConversationMessages.agentMessage('Response');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');

      service.addMessageToConversation(conversationId, customerMessage);
      service.addMessageToConversation(conversationId, agentMessage);
      service.addMessageToConversation(conversationId, robotMessage);

      const result = service.getMessagesVisibleToRole(
        conversationId,
        UserRole.CUSTOMER,
      );
      expect(result).toHaveLength(2);
      expect(result).toContain(customerMessage);
      expect(result).toContain(agentMessage);
      expect(result).not.toContain(robotMessage);
    });

    it('should return all messages for agent role', () => {
      const conversationId = 'test-conversation';
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const agentMessage = mockConversationMessages.agentMessage('Response');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');

      service.addMessageToConversation(conversationId, customerMessage);
      service.addMessageToConversation(conversationId, agentMessage);
      service.addMessageToConversation(conversationId, robotMessage);

      const result = service.getMessagesVisibleToRole(
        conversationId,
        UserRole.AGENT,
      );
      expect(result).toHaveLength(3);
      expect(result).toContain(customerMessage);
      expect(result).toContain(agentMessage);
      expect(result).toContain(robotMessage);
    });
  });

  describe('getMessagesForRobotProcessing', () => {
    it('should return empty array for non-existent conversation', () => {
      const result = service.getMessagesForRobotProcessing('non-existent');
      expect(result).toEqual([]);
    });

    it('should return messages suitable for robot processing', () => {
      const conversationId = 'test-conversation';
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const agentMessage = mockConversationMessages.agentMessage('Response');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');
      agentMessage.fromRole = UserRole.AGENT;
      robotMessage.messageType = MessageType.ROBOT;

      service.addMessageToConversation(conversationId, customerMessage);
      service.addMessageToConversation(conversationId, agentMessage);
      service.addMessageToConversation(conversationId, robotMessage);

      const result = service.getMessagesForRobotProcessing(conversationId);
      expect(result).toHaveLength(2);
      expect(result).toContain(agentMessage);
      expect(result).toContain(robotMessage);
      expect(result).not.toContain(customerMessage);
    });
  });

  describe('getRecentMessagesWithinTokenLimit', () => {
    it('should return empty array for non-existent conversation', () => {
      const estimateTokens = (content: string) => content.length;
      const result = service.getRecentMessagesWithinTokenLimit(
        'non-existent',
        100,
        estimateTokens,
      );
      expect(result).toEqual([]);
    });

    it('should return messages within token limit', () => {
      const conversationId = 'test-conversation';
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');

      service.addMessageToConversation(conversationId, message1);
      service.addMessageToConversation(conversationId, message2);

      const estimateTokens = (content: string) => content.length;
      const result = service.getRecentMessagesWithinTokenLimit(
        conversationId,
        20,
        estimateTokens,
      );

      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getMessagesByUser', () => {
    it('should return empty array for non-existent conversation', () => {
      const result = service.getMessagesByUser('non-existent', 'user1');
      expect(result).toEqual([]);
    });

    it('should return messages from specific user', () => {
      const conversationId = 'test-conversation';
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      message1.authorUserId = 'user1';
      message2.authorUserId = 'user2';

      service.addMessageToConversation(conversationId, message1);
      service.addMessageToConversation(conversationId, message2);

      const result = service.getMessagesByUser(conversationId, 'user1');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(message1);
    });
  });

  describe('getMessagesByType', () => {
    it('should return empty array for non-existent conversation', () => {
      const result = service.getMessagesByType(
        'non-existent',
        MessageType.TEXT,
      );
      expect(result).toEqual([]);
    });

    it('should return messages of specific type', () => {
      const conversationId = 'test-conversation';
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.robotMessage('Robot response');
      message1.messageType = MessageType.TEXT;
      message2.messageType = MessageType.ROBOT;

      service.addMessageToConversation(conversationId, message1);
      service.addMessageToConversation(conversationId, message2);

      const result = service.getMessagesByType(
        conversationId,
        MessageType.ROBOT,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(message2);
    });
  });

  describe('getLatestMessage', () => {
    it('should return undefined for non-existent conversation', () => {
      const result = service.getLatestMessage('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return the most recent message', () => {
      const conversationId = 'test-conversation';
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      message1.createdAt = new Date('2024-01-01T10:00:00Z');
      message2.createdAt = new Date('2024-01-01T11:00:00Z');

      service.addMessageToConversation(conversationId, message1);
      service.addMessageToConversation(conversationId, message2);

      const result = service.getLatestMessage(conversationId);
      expect(result).toBe(message2);
    });
  });

  describe('getMessageCountsByType', () => {
    it('should return zero counts for non-existent conversation', () => {
      const result = service.getMessageCountsByType('non-existent');
      expect(result[MessageType.TEXT]).toBe(0);
      expect(result[MessageType.ROBOT]).toBe(0);
      expect(result[MessageType.SYSTEM]).toBe(0);
    });

    it('should return correct counts for existing conversation', () => {
      const conversationId = 'test-conversation';
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.robotMessage('Robot response');
      const message3 = mockConversationMessages.agentMessage('System message');
      message1.messageType = MessageType.TEXT;
      message2.messageType = MessageType.ROBOT;
      message3.messageType = MessageType.SYSTEM;

      service.addMessageToConversation(conversationId, message1);
      service.addMessageToConversation(conversationId, message2);
      service.addMessageToConversation(conversationId, message3);

      const result = service.getMessageCountsByType(conversationId);
      expect(result[MessageType.TEXT]).toBe(1);
      expect(result[MessageType.ROBOT]).toBe(1);
      expect(result[MessageType.SYSTEM]).toBe(1);
    });
  });

  describe('getMessageCount', () => {
    it('should return 0 for non-existent conversation', () => {
      const result = service.getMessageCount('non-existent');
      expect(result).toBe(0);
    });

    it('should return correct message count for existing conversation', () => {
      const conversationId = 'test-conversation';
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');

      expect(service.getMessageCount(conversationId)).toBe(0);

      service.addMessageToConversation(conversationId, message1);
      service.addMessageToConversation(conversationId, message2);

      const result = service.getMessageCount(conversationId);
      expect(result).toBe(2);
    });
  });
});
