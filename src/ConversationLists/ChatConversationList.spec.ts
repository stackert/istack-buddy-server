import { ChatConversationList } from './ChatConversationList';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';

describe('ChatConversationList', () => {
  let chatList: ChatConversationList;
  let mockMessages: IConversationMessage[];

  beforeEach(() => {
    chatList = new ChatConversationList();

    // Create mock messages for testing
    mockMessages = [
      {
        id: 'msg-1',
        content: 'Hello from customer',
        conversationId: 'conv-1',
        fromUserId: 'customer-1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T10:00:00Z'),
      },
      {
        id: 'msg-2',
        content: 'Agent response',
        conversationId: 'conv-1',
        fromUserId: 'agent-1',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date('2023-01-01T10:05:00Z'),
        updatedAt: new Date('2023-01-01T10:05:00Z'),
      },
      {
        id: 'msg-3',
        content: 'Robot analysis',
        conversationId: 'conv-1',
        fromUserId: 'cx-slack-robot',
        fromRole: UserRole.ROBOT,
        toRole: UserRole.AGENT,
        messageType: MessageType.ROBOT,
        createdAt: new Date('2023-01-01T10:10:00Z'),
        updatedAt: new Date('2023-01-01T10:10:00Z'),
      },
      {
        id: 'msg-4',
        content: 'Supervisor message',
        conversationId: 'conv-1',
        fromUserId: 'supervisor-1',
        fromRole: UserRole.SUPERVISOR,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date('2023-01-01T10:15:00Z'),
        updatedAt: new Date('2023-01-01T10:15:00Z'),
      },
      {
        id: 'msg-5',
        content: 'System message',
        conversationId: 'conv-1',
        fromUserId: null,
        fromRole: UserRole.SYSTEM_DEBUG,
        toRole: UserRole.AGENT,
        messageType: MessageType.SYSTEM,
        createdAt: new Date('2023-01-01T10:20:00Z'),
        updatedAt: new Date('2023-01-01T10:20:00Z'),
      },
    ];

    // Add messages to the chat list
    mockMessages.forEach((msg) => chatList.addChatMessage(msg));
  });

  describe('Constructor and Basic Operations', () => {
    it('should create an empty conversation list', () => {
      const newChatList = new ChatConversationList();
      expect(newChatList.getMessageCount()).toBe(0);
      expect(newChatList.hasMessages()).toBe(false);
    });

    it('should add messages and return message ID', () => {
      const newChatList = new ChatConversationList();
      const message = mockMessages[0];

      const messageId = newChatList.addChatMessage(message);

      expect(messageId).toBe(message.id);
      expect(newChatList.getMessageCount()).toBe(1);
      expect(newChatList.hasMessages()).toBe(true);
    });
  });

  describe('getAllChatMessages', () => {
    it('should return all messages in chronological order', () => {
      const messages = chatList.getAllChatMessages();

      expect(messages).toHaveLength(5);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[4].id).toBe('msg-5');

      // Verify chronological order
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].createdAt.getTime()).toBeGreaterThan(
          messages[i - 1].createdAt.getTime(),
        );
      }
    });

    it('should return a copy of messages array', () => {
      const messages1 = chatList.getAllChatMessages();
      const messages2 = chatList.getAllChatMessages();

      expect(messages1).not.toBe(messages2);
      expect(messages1).toEqual(messages2);
    });
  });

  describe('getFilteredRobotMessages', () => {
    it('should return messages from robot role', () => {
      const robotMessages = chatList.getFilteredRobotMessages();

      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0].id).toBe('msg-3');
      expect(robotMessages[0].fromRole).toBe(UserRole.ROBOT);
    });

    it('should return messages with robot message type', () => {
      // Add another message with robot type but different role
      const robotTypeMessage: IConversationMessage = {
        id: 'msg-robot-type',
        content: 'Another robot message',
        conversationId: 'conv-1',
        fromUserId: 'agent-1',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.ROBOT,
        createdAt: new Date('2023-01-01T10:25:00Z'),
        updatedAt: new Date('2023-01-01T10:25:00Z'),
      };

      chatList.addChatMessage(robotTypeMessage);
      const robotMessages = chatList.getFilteredRobotMessages();

      expect(robotMessages).toHaveLength(2);
      expect(
        robotMessages.find((msg) => msg.id === 'msg-robot-type'),
      ).toBeDefined();
    });

    it('should return messages from known robot user IDs', () => {
      // Add a message with robot in user ID
      const robotUserMessage: IConversationMessage = {
        id: 'msg-robot-user',
        content: 'Message from robot user',
        conversationId: 'conv-1',
        fromUserId: 'test-robot-user',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
        createdAt: new Date('2023-01-01T10:30:00Z'),
        updatedAt: new Date('2023-01-01T10:30:00Z'),
      };

      chatList.addChatMessage(robotUserMessage);
      const robotMessages = chatList.getFilteredRobotMessages();

      expect(robotMessages).toHaveLength(2);
      expect(
        robotMessages.find((msg) => msg.id === 'msg-robot-user'),
      ).toBeDefined();
    });
  });

  describe('getFilteredMessages', () => {
    it('should filter messages by fromRole', () => {
      const agentMessages = chatList.getFilteredMessages({
        fromRole: UserRole.AGENT,
      });

      expect(agentMessages).toHaveLength(1);
      expect(agentMessages[0].id).toBe('msg-2');
    });

    it('should filter messages by messageType', () => {
      const textMessages = chatList.getFilteredMessages({
        messageType: MessageType.TEXT,
      });

      expect(textMessages).toHaveLength(3);
      expect(textMessages.map((msg) => msg.id)).toEqual([
        'msg-1',
        'msg-2',
        'msg-4',
      ]);
    });

    it('should filter by multiple criteria', () => {
      const filtered = chatList.getFilteredMessages({
        fromRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('msg-2');
    });

    it('should handle undefined filter values', () => {
      const filtered = chatList.getFilteredMessages({
        fromRole: UserRole.AGENT,
        messageType: undefined,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('msg-2');
    });

    it('should return empty array when no matches', () => {
      const filtered = chatList.getFilteredMessages({
        fromRole: UserRole.CUSTOMER,
        messageType: MessageType.ROBOT,
      });

      expect(filtered).toHaveLength(0);
    });
  });

  describe('getMessagesVisibleToRole', () => {
    it('should return customer and agent messages for CUSTOMER role', () => {
      const visibleMessages = chatList.getMessagesVisibleToRole(
        UserRole.CUSTOMER,
      );

      expect(visibleMessages).toHaveLength(2);
      expect(visibleMessages.map((msg) => msg.id)).toEqual(['msg-1', 'msg-2']);
    });

    it('should exclude robot messages for CUSTOMER role', () => {
      const visibleMessages = chatList.getMessagesVisibleToRole(
        UserRole.CUSTOMER,
      );

      const robotMessage = visibleMessages.find(
        (msg) => msg.messageType === MessageType.ROBOT,
      );
      expect(robotMessage).toBeUndefined();
    });

    it('should return all messages for AGENT role', () => {
      const visibleMessages = chatList.getMessagesVisibleToRole(UserRole.AGENT);

      expect(visibleMessages).toHaveLength(5);
      expect(visibleMessages.map((msg) => msg.id)).toEqual([
        'msg-1',
        'msg-2',
        'msg-3',
        'msg-4',
        'msg-5',
      ]);
    });

    it('should return all messages for SUPERVISOR role', () => {
      const visibleMessages = chatList.getMessagesVisibleToRole(
        UserRole.SUPERVISOR,
      );

      expect(visibleMessages).toHaveLength(5);
      expect(visibleMessages.map((msg) => msg.id)).toEqual([
        'msg-1',
        'msg-2',
        'msg-3',
        'msg-4',
        'msg-5',
      ]);
    });

    it('should return empty array for unknown roles', () => {
      const visibleMessages = chatList.getMessagesVisibleToRole(
        'UNKNOWN_ROLE' as UserRole,
      );

      expect(visibleMessages).toHaveLength(0);
    });
  });

  describe('getMessagesForRobotProcessing', () => {
    it('should include robot messages for context', () => {
      const robotMessages = chatList.getMessagesForRobotProcessing();

      const robotMessage = robotMessages.find(
        (msg) => msg.messageType === MessageType.ROBOT,
      );
      expect(robotMessage).toBeDefined();
      expect(robotMessage?.id).toBe('msg-3');
    });

    it('should include agent and supervisor messages', () => {
      const robotMessages = chatList.getMessagesForRobotProcessing();

      expect(robotMessages).toHaveLength(3);
      expect(robotMessages.map((msg) => msg.id)).toEqual([
        'msg-2',
        'msg-3',
        'msg-4',
      ]);
    });

    it('should exclude customer and system messages', () => {
      const robotMessages = chatList.getMessagesForRobotProcessing();

      const customerMessage = robotMessages.find(
        (msg) => msg.fromRole === UserRole.CUSTOMER,
      );
      const systemMessage = robotMessages.find(
        (msg) => msg.fromRole === UserRole.SYSTEM_DEBUG,
      );

      expect(customerMessage).toBeUndefined();
      expect(systemMessage).toBeUndefined();
    });
  });

  describe('getRecentMessagesWithinTokenLimit', () => {
    const mockTokenEstimator = (content: string) => content.length;

    it('should return messages within token limit', () => {
      const messages = chatList.getRecentMessagesWithinTokenLimit(
        50,
        mockTokenEstimator,
      );

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.length).toBeLessThanOrEqual(5);

      // Verify total tokens don't exceed limit
      const totalTokens = messages.reduce(
        (sum, msg) => sum + mockTokenEstimator(msg.content),
        0,
      );
      expect(totalTokens).toBeLessThanOrEqual(50);
    });

    it('should return messages in chronological order', () => {
      const messages = chatList.getRecentMessagesWithinTokenLimit(
        100,
        mockTokenEstimator,
      );

      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].createdAt.getTime()).toBeGreaterThan(
          messages[i - 1].createdAt.getTime(),
        );
      }
    });

    it('should return empty array when token limit is too small', () => {
      const messages = chatList.getRecentMessagesWithinTokenLimit(
        1,
        mockTokenEstimator,
      );

      expect(messages).toHaveLength(0);
    });

    it('should return all messages when limit is very high', () => {
      const messages = chatList.getRecentMessagesWithinTokenLimit(
        10000,
        mockTokenEstimator,
      );

      expect(messages).toHaveLength(5);
    });
  });

  describe('getMessagesByUser', () => {
    it('should return messages from specific user', () => {
      const userMessages = chatList.getMessagesByUser('agent-1');

      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].id).toBe('msg-2');
    });

    it('should return empty array for non-existent user', () => {
      const userMessages = chatList.getMessagesByUser('non-existent-user');

      expect(userMessages).toHaveLength(0);
    });

    it('should handle null fromUserId', () => {
      const userMessages = chatList.getMessagesByUser('null');

      expect(userMessages).toHaveLength(0);
    });
  });

  describe('getMessagesByType', () => {
    it('should return messages of specific type', () => {
      const textMessages = chatList.getMessagesByType(MessageType.TEXT);

      expect(textMessages).toHaveLength(3);
      expect(textMessages.map((msg) => msg.id)).toEqual([
        'msg-1',
        'msg-2',
        'msg-4',
      ]);
    });

    it('should return robot messages', () => {
      const robotMessages = chatList.getMessagesByType(MessageType.ROBOT);

      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0].id).toBe('msg-3');
    });

    it('should return system messages', () => {
      const systemMessages = chatList.getMessagesByType(MessageType.SYSTEM);

      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].id).toBe('msg-5');
    });
  });

  describe('getMessagesInDateRange', () => {
    it('should return messages within date range', () => {
      const startDate = new Date('2023-01-01T10:05:00Z');
      const endDate = new Date('2023-01-01T10:15:00Z');

      const messages = chatList.getMessagesInDateRange(startDate, endDate);

      expect(messages).toHaveLength(3);
      expect(messages.map((msg) => msg.id)).toEqual([
        'msg-2',
        'msg-3',
        'msg-4',
      ]);
    });

    it('should return empty array when no messages in range', () => {
      const startDate = new Date('2023-02-01T00:00:00Z');
      const endDate = new Date('2023-02-02T00:00:00Z');

      const messages = chatList.getMessagesInDateRange(startDate, endDate);

      expect(messages).toHaveLength(0);
    });

    it('should include messages at exact boundary dates', () => {
      const startDate = new Date('2023-01-01T10:00:00Z');
      const endDate = new Date('2023-01-01T10:20:00Z');

      const messages = chatList.getMessagesInDateRange(startDate, endDate);

      expect(messages).toHaveLength(5);
    });
  });

  describe('getLatestMessage', () => {
    it('should return the most recent message', () => {
      const latestMessage = chatList.getLatestMessage();

      expect(latestMessage).toBeDefined();
      expect(latestMessage?.id).toBe('msg-5');
    });

    it('should return undefined for empty conversation', () => {
      const emptyChatList = new ChatConversationList();
      const latestMessage = emptyChatList.getLatestMessage();

      expect(latestMessage).toBeUndefined();
    });

    it('should return correct message when messages added out of chronological order', () => {
      const newChatList = new ChatConversationList();

      // Add messages in reverse order
      newChatList.addChatMessage(mockMessages[4]); // Latest timestamp
      newChatList.addChatMessage(mockMessages[0]); // Earliest timestamp

      const latestMessage = newChatList.getLatestMessage();
      expect(latestMessage?.id).toBe('msg-5');
    });
  });

  describe('getMessageCountsByType', () => {
    it('should return correct counts for each message type', () => {
      const counts = chatList.getMessageCountsByType();

      expect(counts[MessageType.TEXT]).toBe(3);
      expect(counts[MessageType.ROBOT]).toBe(1);
      expect(counts[MessageType.SYSTEM]).toBe(1);
    });

    it('should return zero counts for empty conversation', () => {
      const emptyChatList = new ChatConversationList();
      const counts = emptyChatList.getMessageCountsByType();

      expect(counts[MessageType.TEXT]).toBe(0);
      expect(counts[MessageType.ROBOT]).toBe(0);
      expect(counts[MessageType.SYSTEM]).toBe(0);
    });
  });

  describe('getMessageCount', () => {
    it('should return correct total count', () => {
      expect(chatList.getMessageCount()).toBe(5);
    });

    it('should return zero for empty conversation', () => {
      const emptyChatList = new ChatConversationList();
      expect(emptyChatList.getMessageCount()).toBe(0);
    });
  });

  describe('hasMessages', () => {
    it('should return true when messages exist', () => {
      expect(chatList.hasMessages()).toBe(true);
    });

    it('should return false for empty conversation', () => {
      const emptyChatList = new ChatConversationList();
      expect(emptyChatList.hasMessages()).toBe(false);
    });
  });

  describe('clearAllMessages', () => {
    it('should remove all messages', () => {
      expect(chatList.hasMessages()).toBe(true);

      chatList.clearAllMessages();

      expect(chatList.hasMessages()).toBe(false);
      expect(chatList.getMessageCount()).toBe(0);
      expect(chatList.getAllChatMessages()).toHaveLength(0);
    });
  });

  describe('removeMessage', () => {
    it('should remove message by ID and return true', () => {
      const initialCount = chatList.getMessageCount();
      const result = chatList.removeMessage('msg-1');

      expect(result).toBe(true);
      expect(chatList.getMessageCount()).toBe(initialCount - 1);

      const messages = chatList.getAllChatMessages();
      expect(messages.find((msg) => msg.id === 'msg-1')).toBeUndefined();
    });

    it('should return false when message ID not found', () => {
      const initialCount = chatList.getMessageCount();
      const result = chatList.removeMessage('non-existent-id');

      expect(result).toBe(false);
      expect(chatList.getMessageCount()).toBe(initialCount);
    });

    it('should remove only the specified message', () => {
      chatList.removeMessage('msg-2');

      const remainingMessages = chatList.getAllChatMessages();
      expect(remainingMessages).toHaveLength(4);
      expect(remainingMessages.map((msg) => msg.id)).toEqual([
        'msg-1',
        'msg-3',
        'msg-4',
        'msg-5',
      ]);
    });
  });
});
