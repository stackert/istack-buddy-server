import { Test, TestingModule } from '@nestjs/testing';
import { ChatManagerService } from './chat-manager.service';
import { ConversationListSlackAppService } from '../ConversationLists/ConversationListService';
import { UserRole, MessageType } from './dto/create-message.dto';

describe('ChatManagerService', () => {
  let service: ChatManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatManagerService, ConversationListSlackAppService],
    }).compile();

    service = module.get<ChatManagerService>(ChatManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Message filtering', () => {
    it('should filter messages by fromUserId', async () => {
      const conversation = await service.startConversation({
        createdBy: 'user1',
        createdByRole: UserRole.CUSTOMER,
      });
      const conversationId = conversation.id;

      // Add some test messages
      await service.addMessage({
        content: 'Message from user1',
        conversationId,
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      await service.addMessage({
        content: 'Message from user2',
        conversationId,
        fromUserId: 'user2',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      // Filter by user1
      const filteredMessages = await service.getFilteredMessages(
        conversationId,
        {
          fromUserId: 'user1',
        },
      );

      expect(filteredMessages).toHaveLength(1);
      expect(filteredMessages[0].fromUserId).toBe('user1');
      expect(filteredMessages[0].content).toBe('Message from user1');
    });

    it('should filter messages by messageType', async () => {
      const conversation = await service.startConversation({
        createdBy: 'user1',
        createdByRole: UserRole.CUSTOMER,
      });
      const conversationId = conversation.id;

      // Add messages with different types
      await service.addMessage({
        content: 'Regular message',
        conversationId,
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      });

      await service.addMessage({
        content: 'Robot message',
        conversationId,
        fromUserId: 'robot1',
        fromRole: UserRole.ROBOT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.ROBOT,
      });

      // Filter by robot type
      const robotMessages = await service.getFilteredMessages(conversationId, {
        messageType: MessageType.ROBOT,
      });

      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0].messageType).toBe(MessageType.ROBOT);
      expect(robotMessages[0].content).toBe('Robot message');
    });

    it('should get robot messages using getFilteredRobotMessages', async () => {
      const conversation = await service.startConversation({
        createdBy: 'user1',
        createdByRole: UserRole.CUSTOMER,
      });
      const conversationId = conversation.id;

      // Add various messages
      await service.addMessage({
        content: 'User message',
        conversationId,
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      await service.addMessage({
        content: 'Robot role message',
        conversationId,
        fromUserId: 'robot1',
        fromRole: UserRole.ROBOT,
        toRole: UserRole.CUSTOMER,
      });

      await service.addMessage({
        content: 'Slack robot message',
        conversationId,
        fromUserId: 'cx-slack-robot',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      await service.addMessage({
        content: 'Robot type message',
        conversationId,
        fromUserId: 'user2',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.ROBOT,
      });

      const robotMessages =
        await service.getFilteredRobotMessages(conversationId);

      expect(robotMessages).toHaveLength(3);

      // Should include message with robot role
      expect(
        robotMessages.some((msg) => msg.content === 'Robot role message'),
      ).toBe(true);

      // Should include message from cx-slack-robot
      expect(
        robotMessages.some((msg) => msg.content === 'Slack robot message'),
      ).toBe(true);

      // Should include message with robot type
      expect(
        robotMessages.some((msg) => msg.content === 'Robot type message'),
      ).toBe(true);

      // Should not include regular user message
      expect(robotMessages.some((msg) => msg.content === 'User message')).toBe(
        false,
      );
    });

    it('should get messages from multiple conversations', async () => {
      const conversation1 = await service.startConversation({
        createdBy: 'user1',
        createdByRole: UserRole.CUSTOMER,
      });
      const conversationId1 = conversation1.id;

      const conversation2 = await service.startConversation({
        createdBy: 'user2',
        createdByRole: UserRole.CUSTOMER,
      });
      const conversationId2 = conversation2.id;

      // Add messages to first conversation
      await service.addMessage({
        content: 'Message in conversation 1',
        conversationId: conversationId1,
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      // Add messages to second conversation
      await service.addMessage({
        content: 'Message in conversation 2',
        conversationId: conversationId2,
        fromUserId: 'user2',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      const allMessages = await service.getFilteredConversationMessages([
        conversationId1,
        conversationId2,
      ]);

      expect(allMessages).toHaveLength(2);
      expect(
        allMessages.some((msg) => msg.content === 'Message in conversation 1'),
      ).toBe(true);
      expect(
        allMessages.some((msg) => msg.content === 'Message in conversation 2'),
      ).toBe(true);
      expect(
        allMessages.some((msg) => msg.conversationId === conversationId1),
      ).toBe(true);
      expect(
        allMessages.some((msg) => msg.conversationId === conversationId2),
      ).toBe(true);
    });

    it('should return empty array for non-existent conversation', async () => {
      const messages = await service.getFilteredMessages('non-existent', {
        fromUserId: 'user1',
      });

      expect(messages).toHaveLength(0);
    });

    it('should handle empty filter options', async () => {
      const conversation = await service.startConversation({
        createdBy: 'user1',
        createdByRole: UserRole.CUSTOMER,
      });
      const conversationId = conversation.id;

      await service.addMessage({
        content: 'Test message',
        conversationId,
        fromUserId: 'user1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      // Empty filter should return all messages
      const allMessages = await service.getFilteredMessages(conversationId, {});
      expect(allMessages).toHaveLength(1);
      expect(allMessages[0].content).toBe('Test message');
    });
  });
});
