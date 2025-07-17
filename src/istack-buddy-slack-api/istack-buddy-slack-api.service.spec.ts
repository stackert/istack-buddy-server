import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotService } from '../robots/robot.service';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

describe('IstackBuddySlackApiService', () => {
  let service: IstackBuddySlackApiService;
  let chatManagerService: jest.Mocked<ChatManagerService>;

  const mockConversation = {
    id: 'test-conversation-id',
    participantIds: ['test-user'],
    participantRoles: [UserRole.CUSTOMER],
    messageCount: 0,
    lastMessageAt: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Mock setInterval to prevent hanging tests
    jest.spyOn(global, 'setInterval').mockImplementation(() => ({}) as any);

    const mockChatManagerService = {
      startConversation: jest.fn(),
      getConversationById: jest.fn(),
      addMessage: jest.fn(),
    };

    const mockRobotService = {
      getRobotByName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IstackBuddySlackApiService,
        {
          provide: ChatManagerService,
          useValue: mockChatManagerService,
        },
        {
          provide: RobotService,
          useValue: mockRobotService,
        },
      ],
    }).compile();

    service = module.get<IstackBuddySlackApiService>(
      IstackBuddySlackApiService,
    );
    chatManagerService = module.get(ChatManagerService);
  });

  afterEach(() => {
    // Restore setInterval
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Event factories based on test-data/slack-events/single-conversation
  const createChannelMentionEvent = (overrides: any = {}) => ({
    user: 'U091Y5UF14P',
    type: 'app_mention',
    ts: '1752568742.663279',
    text: '<@U092RRN555X> in channel',
    channel: 'C091Y5UNA1M',
    event_ts: '1752568742.663279',
    ...overrides,
  });

  const createThreadReplyEvent = (threadTs: string, overrides: any = {}) => ({
    user: 'U091Y5UF14P',
    type: 'app_mention',
    ts: `${Date.now()}.123456`,
    text: '<@U092RRN555X> in thread reply',
    channel: 'C091Y5UNA1M',
    thread_ts: threadTs,
    event_ts: `${Date.now()}.123456`,
    ...overrides,
  });

  describe('Slack event handling', () => {
    beforeEach(() => {
      // Clear internal state
      (service as any).slackThreadToConversationMap = {};
    });

    it('should handle 3 events creating 1 conversation with 2 messages', async () => {
      // Arrange - Create 3 events: 1 channel mention + 2 thread replies
      const channelEvent = createChannelMentionEvent({
        ts: '1752568742.663279',
        event_ts: '1752568742.663279',
        text: '<@U092RRN555X> in channel III',
      });

      const threadEvent1 = createThreadReplyEvent('1752568742.663279', {
        ts: '1752568827.543239',
        event_ts: '1752568827.543239',
        text: '<@U092RRN555X> Channel III, In thread I',
      });

      const threadEvent2 = createThreadReplyEvent('1752568742.663279', {
        ts: '1752568838.279079',
        event_ts: '1752568838.279079',
        text: '<@U092RRN555X> Channel III, In thread II',
      });

      const mockConversation = {
        id: 'conv-1',
        participantIds: ['U091Y5UF14P'],
        participantRoles: [UserRole.CUSTOMER],
        messageCount: 0,
        lastMessageAt: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMessage = {
        id: 'msg-1',
        content: '',
        conversationId: 'conv-1',
        fromUserId: 'U091Y5UF14P',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: 'TEXT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      chatManagerService.startConversation.mockResolvedValue(mockConversation);
      chatManagerService.addMessage.mockResolvedValue({
        ...mockMessage,
        messageType: MessageType.TEXT,
      });

      // Act & Assert - Process each event
      await (service as any).handleAppMention(channelEvent);
      expect(chatManagerService.startConversation).toHaveBeenCalledTimes(1);
      expect(chatManagerService.addMessage).toHaveBeenCalledTimes(1); // Channel message adds message

      await (service as any).handleAppMention(threadEvent1);
      expect(chatManagerService.addMessage).toHaveBeenCalledTimes(2); // Thread reply adds message

      await (service as any).handleAppMention(threadEvent2);
      expect(chatManagerService.addMessage).toHaveBeenCalledTimes(3); // Another thread reply adds message

      // Verify conversation mapping
      const mapping = (service as any).slackThreadToConversationMap;
      expect(mapping['1752568742.663279']).toBe('conv-1');
      expect(Object.keys(mapping)).toHaveLength(1);
    });

    it('should handle 2 conversations with multiple messages each', async () => {
      // Arrange - Create 2 separate conversation threads
      // Conversation 1: channel + 2 thread replies
      const conv1ChannelEvent = createChannelMentionEvent({
        ts: '1752568742.111111',
        event_ts: '1752568742.111111',
        text: '<@U092RRN555X> conversation 1 start',
      });

      const conv1ThreadEvent1 = createThreadReplyEvent('1752568742.111111', {
        ts: '1752568827.111111',
        event_ts: '1752568827.111111',
        text: '<@U092RRN555X> conv 1 thread message 1',
      });

      const conv1ThreadEvent2 = createThreadReplyEvent('1752568742.111111', {
        ts: '1752568838.111111',
        event_ts: '1752568838.111111',
        text: '<@U092RRN555X> conv 1 thread message 2',
      });

      // Conversation 2: channel + 2 thread replies
      const conv2ChannelEvent = createChannelMentionEvent({
        ts: '1752568742.222222',
        event_ts: '1752568742.222222',
        text: '<@U092RRN555X> conversation 2 start',
      });

      const conv2ThreadEvent1 = createThreadReplyEvent('1752568742.222222', {
        ts: '1752568827.222222',
        event_ts: '1752568827.222222',
        text: '<@U092RRN555X> conv 2 thread message 1',
      });

      const conv2ThreadEvent2 = createThreadReplyEvent('1752568742.222222', {
        ts: '1752568838.222222',
        event_ts: '1752568838.222222',
        text: '<@U092RRN555X> conv 2 thread message 2',
      });

      const mockConversation1 = { ...mockConversation, id: 'conv-1' };
      const mockConversation2 = { ...mockConversation, id: 'conv-2' };
      const mockMessage = {
        id: 'msg-1',
        content: '',
        conversationId: 'conv-1',
        fromUserId: 'U091Y5UF14P',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: 'TEXT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      chatManagerService.startConversation
        .mockResolvedValueOnce(mockConversation1)
        .mockResolvedValueOnce(mockConversation2);
      chatManagerService.addMessage.mockResolvedValue({
        ...mockMessage,
        messageType: MessageType.TEXT,
      });

      // Act - Process all events
      await (service as any).handleAppMention(conv1ChannelEvent);
      await (service as any).handleAppMention(conv1ThreadEvent1);
      await (service as any).handleAppMention(conv1ThreadEvent2);

      await (service as any).handleAppMention(conv2ChannelEvent);
      await (service as any).handleAppMention(conv2ThreadEvent1);
      await (service as any).handleAppMention(conv2ThreadEvent2);

      // Assert
      expect(chatManagerService.startConversation).toHaveBeenCalledTimes(2);
      expect(chatManagerService.addMessage).toHaveBeenCalledTimes(6); // 1 + 2 + 1 + 2 = 6 messages

      // Verify both conversations are mapped
      const mapping = (service as any).slackThreadToConversationMap;
      expect(mapping['1752568742.111111']).toBe('conv-1');
      expect(mapping['1752568742.222222']).toBe('conv-2');
      expect(Object.keys(mapping)).toHaveLength(2);
    });
  });
});
