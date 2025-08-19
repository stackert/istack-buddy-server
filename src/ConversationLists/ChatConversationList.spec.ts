import { ChatConversationList } from './ChatConversationList';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';
import { mockConversationMessages } from '../../test-data/mocks/conversation-messages';

describe('ChatConversationList', () => {
  let conversationList: ChatConversationList;

  beforeEach(() => {
    conversationList = new ChatConversationList();
  });

  describe('addChatMessage', () => {
    it('should add a message and return the message ID', () => {
      const message = mockConversationMessages.customerMessage('Hello');
      const messageId = conversationList.addChatMessage(message);

      expect(messageId).toBe(message.id);
      expect(conversationList.getAllChatMessages()).toHaveLength(1);
      expect(conversationList.getAllChatMessages()[0]).toBe(message);
    });

    it('should add multiple messages in order', () => {
      const message1 =
        mockConversationMessages.customerMessage('First message');
      const message2 = mockConversationMessages.agentMessage('Second message');

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const messages = conversationList.getAllChatMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0]).toBe(message1);
      expect(messages[1]).toBe(message2);
    });
  });

  describe('getAllChatMessages', () => {
    it('should return empty array when no messages exist', () => {
      const messages = conversationList.getAllChatMessages();
      expect(messages).toEqual([]);
    });

    it('should return messages in chronological order', () => {
      const message1 =
        mockConversationMessages.customerMessage('First message');
      const message2 = mockConversationMessages.agentMessage('Second message');
      const message3 = mockConversationMessages.robotMessage('Third message');

      // Add messages out of order
      message1.createdAt = new Date('2024-01-01T10:00:00Z');
      message2.createdAt = new Date('2024-01-01T10:01:00Z');
      message3.createdAt = new Date('2024-01-01T10:02:00Z');

      conversationList.addChatMessage(message2);
      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message3);

      const messages = conversationList.getAllChatMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0]).toBe(message1);
      expect(messages[1]).toBe(message2);
      expect(messages[2]).toBe(message3);
    });
  });

  describe('getFilteredRobotMessages', () => {
    it('should return messages with robot role', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');
      robotMessage.fromRole = UserRole.ROBOT;

      conversationList.addChatMessage(customerMessage);
      conversationList.addChatMessage(robotMessage);

      const robotMessages = conversationList.getFilteredRobotMessages();
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0]).toBe(robotMessage);
    });

    it('should return messages with robot message type', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');
      robotMessage.messageType = MessageType.ROBOT;

      conversationList.addChatMessage(customerMessage);
      conversationList.addChatMessage(robotMessage);

      const robotMessages = conversationList.getFilteredRobotMessages();
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0]).toBe(robotMessage);
    });

    it('should return messages with robot user ID', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');
      robotMessage.authorUserId = 'robot-123';

      conversationList.addChatMessage(customerMessage);
      conversationList.addChatMessage(robotMessage);

      const robotMessages = conversationList.getFilteredRobotMessages();
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0]).toBe(robotMessage);
    });

    it('should return messages with cx-slack-robot user ID', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');
      robotMessage.authorUserId = 'cx-slack-robot';

      conversationList.addChatMessage(customerMessage);
      conversationList.addChatMessage(robotMessage);

      const robotMessages = conversationList.getFilteredRobotMessages();
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0]).toBe(robotMessage);
    });

    it('should return empty array when no robot messages exist', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const agentMessage =
        mockConversationMessages.agentMessage('Agent response');

      conversationList.addChatMessage(customerMessage);
      conversationList.addChatMessage(agentMessage);

      const robotMessages = conversationList.getFilteredRobotMessages();
      expect(robotMessages).toEqual([]);
    });
  });

  describe('getFilteredMessages', () => {
    it('should filter messages by authorUserId', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      message1.authorUserId = 'user1';
      message2.authorUserId = 'user2';

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const filtered = conversationList.getFilteredMessages({
        authorUserId: 'user1',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(message1);
    });

    it('should filter messages by messageType', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.robotMessage('Robot response');
      message1.messageType = MessageType.TEXT;
      message2.messageType = MessageType.ROBOT;

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const filtered = conversationList.getFilteredMessages({
        messageType: MessageType.ROBOT,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(message2);
    });

    it('should filter messages by multiple criteria', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      message1.authorUserId = 'user1';
      message1.fromRole = UserRole.CUSTOMER;
      message2.authorUserId = 'user1';
      message2.fromRole = UserRole.AGENT;

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const filtered = conversationList.getFilteredMessages({
        authorUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(message1);
    });

    it('should ignore undefined filter values', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const filtered = conversationList.getFilteredMessages({
        authorUserId: undefined,
      });
      expect(filtered).toHaveLength(2);
    });
  });

  describe('getMessagesVisibleToRole', () => {
    it('should return customer messages for CUSTOMER role', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const agentMessage = mockConversationMessages.agentMessage('Response');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');

      conversationList.addChatMessage(customerMessage);
      conversationList.addChatMessage(agentMessage);
      conversationList.addChatMessage(robotMessage);

      const visible = conversationList.getMessagesVisibleToRole(
        UserRole.CUSTOMER,
      );
      expect(visible).toHaveLength(2);
      expect(visible).toContain(customerMessage);
      expect(visible).toContain(agentMessage);
      expect(visible).not.toContain(robotMessage);
    });

    it('should return all messages for AGENT role', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const agentMessage = mockConversationMessages.agentMessage('Response');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');

      conversationList.addChatMessage(customerMessage);
      conversationList.addChatMessage(agentMessage);
      conversationList.addChatMessage(robotMessage);

      const visible = conversationList.getMessagesVisibleToRole(UserRole.AGENT);
      expect(visible).toHaveLength(3);
      expect(visible).toContain(customerMessage);
      expect(visible).toContain(agentMessage);
      expect(visible).toContain(robotMessage);
    });

    it('should return all messages for SUPERVISOR role', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      const agentMessage = mockConversationMessages.agentMessage('Response');
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');

      conversationList.addChatMessage(customerMessage);
      conversationList.addChatMessage(agentMessage);
      conversationList.addChatMessage(robotMessage);

      const visible = conversationList.getMessagesVisibleToRole(
        UserRole.SUPERVISOR,
      );
      expect(visible).toHaveLength(3);
      expect(visible).toContain(customerMessage);
      expect(visible).toContain(agentMessage);
      expect(visible).toContain(robotMessage);
    });

    it('should return empty array for unknown role', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      conversationList.addChatMessage(customerMessage);

      const visible = conversationList.getMessagesVisibleToRole(
        'UNKNOWN' as UserRole,
      );
      expect(visible).toEqual([]);
    });
  });

  describe('getMessagesForRobotProcessing', () => {
    it('should return robot messages', () => {
      const robotMessage =
        mockConversationMessages.robotMessage('Robot response');
      robotMessage.messageType = MessageType.ROBOT;

      conversationList.addChatMessage(robotMessage);

      const robotMessages = conversationList.getMessagesForRobotProcessing();
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0]).toBe(robotMessage);
    });

    it('should return agent messages', () => {
      const agentMessage =
        mockConversationMessages.agentMessage('Agent response');
      agentMessage.fromRole = UserRole.AGENT;

      conversationList.addChatMessage(agentMessage);

      const robotMessages = conversationList.getMessagesForRobotProcessing();
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0]).toBe(agentMessage);
    });

    it('should return supervisor messages', () => {
      const supervisorMessage = mockConversationMessages.agentMessage(
        'Supervisor response',
      );
      supervisorMessage.fromRole = UserRole.SUPERVISOR;

      conversationList.addChatMessage(supervisorMessage);

      const robotMessages = conversationList.getMessagesForRobotProcessing();
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0]).toBe(supervisorMessage);
    });

    it('should not return customer messages', () => {
      const customerMessage = mockConversationMessages.customerMessage('Hello');
      conversationList.addChatMessage(customerMessage);

      const robotMessages = conversationList.getMessagesForRobotProcessing();
      expect(robotMessages).toEqual([]);
    });
  });

  describe('getRecentMessagesWithinTokenLimit', () => {
    it('should return messages within token limit', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      const message3 = mockConversationMessages.robotMessage('Robot response');

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);
      conversationList.addChatMessage(message3);

      const estimateTokens = (content: string) => content.length;

      const recent = conversationList.getRecentMessagesWithinTokenLimit(
        10,
        estimateTokens,
      );
      expect(recent.length).toBeLessThanOrEqual(3);
    });

    it('should return messages in chronological order', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const estimateTokens = (content: string) => content.length;

      const recent = conversationList.getRecentMessagesWithinTokenLimit(
        20,
        estimateTokens,
      );
      expect(recent[0]).toBe(message1);
      expect(recent[1]).toBe(message2);
    });

    it('should handle string content payload', () => {
      const message = mockConversationMessages.customerMessage('Hello');
      (message.content as any).payload = 'Hello world';

      conversationList.addChatMessage(message);

      const estimateTokens = (content: string) => content.length;

      const recent = conversationList.getRecentMessagesWithinTokenLimit(
        20,
        estimateTokens,
      );
      expect(recent).toHaveLength(1);
    });

    it('should handle non-string content payload', () => {
      const message = mockConversationMessages.customerMessage('Hello');
      (message.content as any).payload = 123;

      conversationList.addChatMessage(message);

      const estimateTokens = (content: string) => content.length;

      const recent = conversationList.getRecentMessagesWithinTokenLimit(
        20,
        estimateTokens,
      );
      expect(recent).toHaveLength(1);
    });

    it('should handle exact token limit', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('World');

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const estimateTokens = (content: string) => content.length;

      const recent = conversationList.getRecentMessagesWithinTokenLimit(
        10, // "Hello" + "World" = 10 characters
        estimateTokens,
      );
      expect(recent).toHaveLength(2);
    });
  });

  describe('getMessagesByUser', () => {
    it('should return messages from specific user', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      message1.authorUserId = 'user1';
      message2.authorUserId = 'user2';

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const userMessages = conversationList.getMessagesByUser('user1');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0]).toBe(message1);
    });

    it('should return empty array for non-existent user', () => {
      const message = mockConversationMessages.customerMessage('Hello');
      conversationList.addChatMessage(message);

      const userMessages = conversationList.getMessagesByUser('nonexistent');
      expect(userMessages).toEqual([]);
    });
  });

  describe('getMessagesByType', () => {
    it('should return messages of specific type', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.robotMessage('Robot response');
      message1.messageType = MessageType.TEXT;
      message2.messageType = MessageType.ROBOT;

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const robotMessages = conversationList.getMessagesByType(
        MessageType.ROBOT,
      );
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0]).toBe(message2);
    });
  });

  describe('getMessagesInDateRange', () => {
    it('should return messages within date range', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      message1.createdAt = new Date('2024-01-01T10:00:00Z');
      message2.createdAt = new Date('2024-01-01T11:00:00Z');

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const startDate = new Date('2024-01-01T09:30:00Z');
      const endDate = new Date('2024-01-01T10:30:00Z');

      const rangeMessages = conversationList.getMessagesInDateRange(
        startDate,
        endDate,
      );
      expect(rangeMessages).toHaveLength(1);
      expect(rangeMessages[0]).toBe(message1);
    });
  });

  describe('getLatestMessage', () => {
    it('should return the most recent message', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      message1.createdAt = new Date('2024-01-01T10:00:00Z');
      message2.createdAt = new Date('2024-01-01T11:00:00Z');

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      const latest = conversationList.getLatestMessage();
      expect(latest).toBe(message2);
    });

    it('should return undefined when no messages exist', () => {
      const latest = conversationList.getLatestMessage();
      expect(latest).toBeUndefined();
    });
  });

  describe('getMessageCountsByType', () => {
    it('should return correct counts for each message type', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.robotMessage('Robot response');
      const message3 = mockConversationMessages.agentMessage('System message');
      message1.messageType = MessageType.TEXT;
      message2.messageType = MessageType.ROBOT;
      message3.messageType = MessageType.SYSTEM;

      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);
      conversationList.addChatMessage(message3);

      const counts = conversationList.getMessageCountsByType();
      expect(counts[MessageType.TEXT]).toBe(1);
      expect(counts[MessageType.ROBOT]).toBe(1);
      expect(counts[MessageType.SYSTEM]).toBe(1);
    });

    it('should return zero counts when no messages exist', () => {
      const counts = conversationList.getMessageCountsByType();
      expect(counts[MessageType.TEXT]).toBe(0);
      expect(counts[MessageType.ROBOT]).toBe(0);
      expect(counts[MessageType.SYSTEM]).toBe(0);
    });
  });

  describe('getMessageCount', () => {
    it('should return correct message count', () => {
      expect(conversationList.getMessageCount()).toBe(0);

      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      expect(conversationList.getMessageCount()).toBe(2);
    });
  });

  describe('clearAllMessages', () => {
    it('should remove all messages', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      expect(conversationList.getMessageCount()).toBe(2);

      conversationList.clearAllMessages();

      expect(conversationList.getMessageCount()).toBe(0);
      expect(conversationList.getAllChatMessages()).toEqual([]);
    });
  });

  describe('hasMessages', () => {
    it('should return false when no messages exist', () => {
      expect(conversationList.hasMessages()).toBe(false);
    });

    it('should return true when messages exist', () => {
      const message = mockConversationMessages.customerMessage('Hello');
      conversationList.addChatMessage(message);

      expect(conversationList.hasMessages()).toBe(true);
    });
  });

  describe('removeMessage', () => {
    it('should remove message by ID', () => {
      const message1 = mockConversationMessages.customerMessage('Hello');
      const message2 = mockConversationMessages.agentMessage('Response');
      conversationList.addChatMessage(message1);
      conversationList.addChatMessage(message2);

      expect(conversationList.getMessageCount()).toBe(2);

      const removed = conversationList.removeMessage(message1.id);
      expect(removed).toBe(true);
      expect(conversationList.getMessageCount()).toBe(1);
      expect(conversationList.getAllChatMessages()).not.toContain(message1);
      expect(conversationList.getAllChatMessages()).toContain(message2);
    });

    it('should return false when message ID does not exist', () => {
      const message = mockConversationMessages.customerMessage('Hello');
      conversationList.addChatMessage(message);

      const removed = conversationList.removeMessage('nonexistent-id');
      expect(removed).toBe(false);
      expect(conversationList.getMessageCount()).toBe(1);
    });
  });
});
