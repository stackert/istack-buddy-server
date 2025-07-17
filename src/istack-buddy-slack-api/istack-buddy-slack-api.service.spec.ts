import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotService } from '../robots/robot.service';
import { ConversationListSlackAppService } from '../ConversationLists/ConversationListService';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

describe('IstackBuddySlackApiService', () => {
  let service: IstackBuddySlackApiService;
  let chatManagerService: ChatManagerService;

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

    const mockRobot = {
      acceptMessageMultiPartResponse: jest
        .fn()
        .mockImplementation(async (messageEnvelope, callback) => {
          // Simulate the robot calling the callback with a response
          const mockDelayedResponse = {
            envelopePayload: {
              content: {
                payload: 'Mock robot response from callback',
              },
            },
          };

          // Actually invoke the callback to test the sendSlackMessage path
          await callback(mockDelayedResponse);

          return mockDelayedResponse;
        }),
      acceptMessageImmediateResponse: jest.fn().mockResolvedValue({
        envelopePayload: {
          content: {
            payload: 'Mock robot response',
          },
        },
      }),
    };

    const mockRobotService = {
      getRobotByName: jest.fn().mockReturnValue(mockRobot),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IstackBuddySlackApiService,
        ChatManagerService, // Real ChatManagerService
        ConversationListSlackAppService, // Real ConversationListSlackAppService
        {
          provide: RobotService,
          useValue: mockRobotService,
        },
      ],
    }).compile();

    service = module.get<IstackBuddySlackApiService>(
      IstackBuddySlackApiService,
    );
    chatManagerService = module.get<ChatManagerService>(ChatManagerService);

    // Mock the gateway to avoid WebSocket concerns
    const mockGateway = {
      broadcastToConversation: jest.fn(),
      broadcastToDashboard: jest.fn(),
    };
    chatManagerService.setGateway(mockGateway);

    // Spy on sendSlackMessage to verify callback behavior
    jest.spyOn(service as any, 'sendSlackMessage').mockResolvedValue(undefined);

    // Mock addSlackReaction to prevent real Slack API calls during tests
    jest.spyOn(service as any, 'addSlackReaction').mockResolvedValue(undefined);
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

    it('should handle 3 events creating 1 conversation with 3 messages', async () => {
      // Arrange - Create 3 events: 1 channel mention + 2 thread replies
      const channelEvent = createChannelMentionEvent({
        ts: '1752568742.663279',
        event_ts: '1752568742.663279',
        text: '<@U092RRN555X> test message 1 - channel mention',
      });

      const threadEvent1 = createThreadReplyEvent('1752568742.663279', {
        ts: '1752568827.543239',
        event_ts: '1752568827.543239',
        text: '<@U092RRN555X> test message 2 - thread reply 1',
      });

      const threadEvent2 = createThreadReplyEvent('1752568742.663279', {
        ts: '1752568838.279079',
        event_ts: '1752568838.279079',
        text: '<@U092RRN555X> test message 3 - thread reply 2',
      });

      // Act - Process each event
      await (service as any).handleAppMention(channelEvent);
      await (service as any).handleAppMention(threadEvent1);
      await (service as any).handleAppMention(threadEvent2);

      // Assert - Verify actual data stored
      const conversations = await chatManagerService.getConversations();
      expect(conversations).toHaveLength(1);

      const conversation = conversations[0];
      expect(conversation.participantIds).toContain('U091Y5UF14P');
      expect(conversation.isActive).toBe(true);

      // Verify messages were actually stored
      const messages = await chatManagerService.getMessages(
        conversation.id,
        {},
      );
      expect(messages).toHaveLength(3);

      // Verify message content in order
      expect(messages[0].content).toBe(
        '<@U092RRN555X> test message 1 - channel mention',
      );
      expect(messages[0].fromUserId).toBe('cx-slack-robot'); // Generic Slack robot user
      expect(messages[0].fromRole).toBe(UserRole.CUSTOMER);

      expect(messages[1].content).toBe(
        '<@U092RRN555X> test message 2 - thread reply 1',
      );
      expect(messages[1].fromUserId).toBe('cx-slack-robot'); // Generic Slack robot user

      expect(messages[2].content).toBe(
        '<@U092RRN555X> test message 3 - thread reply 2',
      );
      expect(messages[2].fromUserId).toBe('cx-slack-robot'); // Generic Slack robot user

      // Verify conversation mapping
      const mapping = (service as any).slackThreadToConversationMap;
      expect(mapping['1752568742.663279'].internalConversationId).toBe(
        conversation.id,
      );
      expect(mapping['1752568742.663279'].slackConversationId).toBe(
        '1752568742.663279',
      );
      expect(
        typeof mapping['1752568742.663279'].sendConversationResponseToSlack,
      ).toBe('function');
      expect(Object.keys(mapping)).toHaveLength(1);

      // Verify that sendSlackMessage callback was called 3 times (once per event)
      const sendSlackMessageSpy = jest.spyOn(
        service as any,
        'sendSlackMessage',
      );
      expect(sendSlackMessageSpy).toHaveBeenCalledTimes(3);

      // Verify callback was called with correct channel and thread info
      expect(sendSlackMessageSpy).toHaveBeenCalledWith(
        'Mock robot response from callback',
        'C091Y5UNA1M', // channel
        '1752568742.663279', // thread timestamp for channel event
      );

      expect(sendSlackMessageSpy).toHaveBeenCalledWith(
        'Mock robot response from callback',
        'C091Y5UNA1M', // channel
        '1752568742.663279', // thread timestamp for thread replies
      );
    });

    it('should handle 2 conversations with multiple messages each', async () => {
      // Arrange - Create 2 separate conversation threads
      // Conversation 1: channel + 2 thread replies
      const conv1ChannelEvent = createChannelMentionEvent({
        ts: '1752568742.111111',
        event_ts: '1752568742.111111',
        text: '<@U092RRN555X> conv1 test message 1 - channel mention',
      });

      const conv1ThreadEvent1 = createThreadReplyEvent('1752568742.111111', {
        ts: '1752568827.111111',
        event_ts: '1752568827.111111',
        text: '<@U092RRN555X> conv1 test message 2 - thread reply 1',
      });

      const conv1ThreadEvent2 = createThreadReplyEvent('1752568742.111111', {
        ts: '1752568838.111111',
        event_ts: '1752568838.111111',
        text: '<@U092RRN555X> conv1 test message 3 - thread reply 2',
      });

      // Conversation 2: channel + 2 thread replies
      const conv2ChannelEvent = createChannelMentionEvent({
        ts: '1752568742.222222',
        event_ts: '1752568742.222222',
        text: '<@U092RRN555X> conv2 test message 1 - channel mention',
      });

      const conv2ThreadEvent1 = createThreadReplyEvent('1752568742.222222', {
        ts: '1752568827.222222',
        event_ts: '1752568827.222222',
        text: '<@U092RRN555X> conv2 test message 2 - thread reply 1',
      });

      const conv2ThreadEvent2 = createThreadReplyEvent('1752568742.222222', {
        ts: '1752568838.222222',
        event_ts: '1752568838.222222',
        text: '<@U092RRN555X> conv2 test message 3 - thread reply 2',
      });

      // Act - Process all events
      await (service as any).handleAppMention(conv1ChannelEvent);
      await (service as any).handleAppMention(conv1ThreadEvent1);
      await (service as any).handleAppMention(conv1ThreadEvent2);

      await (service as any).handleAppMention(conv2ChannelEvent);
      await (service as any).handleAppMention(conv2ThreadEvent1);
      await (service as any).handleAppMention(conv2ThreadEvent2);

      // Assert - Verify actual data stored
      const conversations = await chatManagerService.getConversations();
      expect(conversations).toHaveLength(2);

      // Find conversations by checking their messages
      const conv1 = conversations.find(async (c) => {
        const messages = await chatManagerService.getMessages(c.id, {});
        return messages.some((m) => m.content.includes('conv1'));
      });
      const conv2 = conversations.find(async (c) => {
        const messages = await chatManagerService.getMessages(c.id, {});
        return messages.some((m) => m.content.includes('conv2'));
      });

      // Verify conversation 1 messages
      const conv1Messages = await chatManagerService.getMessages(
        conversations[0].id,
        {},
      );
      const conv2Messages = await chatManagerService.getMessages(
        conversations[1].id,
        {},
      );

      // One conversation should have 3 messages, the other should have 3 messages
      expect(conv1Messages.length + conv2Messages.length).toBe(6);
      expect(conv1Messages).toHaveLength(3);
      expect(conv2Messages).toHaveLength(3);

      // Verify conversations are mapped correctly
      const mapping = (service as any).slackThreadToConversationMap;
      expect(Object.keys(mapping)).toHaveLength(2);
      expect(mapping['1752568742.111111']).toBeDefined();
      expect(mapping['1752568742.222222']).toBeDefined();
      expect(mapping['1752568742.111111'].internalConversationId).not.toBe(
        mapping['1752568742.222222'].internalConversationId,
      );
      expect(
        typeof mapping['1752568742.111111'].sendConversationResponseToSlack,
      ).toBe('function');
      expect(
        typeof mapping['1752568742.222222'].sendConversationResponseToSlack,
      ).toBe('function');
    });

    it('should invoke robot callback which calls sendSlackMessage', async () => {
      // Arrange - Create a single channel mention event
      const channelEvent = createChannelMentionEvent({
        ts: '1752568742.663279',
        event_ts: '1752568742.663279',
        text: '<@U092RRN555X> test callback behavior',
        channel: 'C091Y5UNA1M',
      });

      // Spy on sendSlackMessage before the test
      const sendSlackMessageSpy = jest.spyOn(
        service as any,
        'sendSlackMessage',
      );

      // Act - Process the channel mention event
      await (service as any).handleAppMention(channelEvent);

      // Assert - Verify callback behavior
      expect(sendSlackMessageSpy).toHaveBeenCalledTimes(1);
      expect(sendSlackMessageSpy).toHaveBeenCalledWith(
        'Mock robot response from callback',
        'C091Y5UNA1M', // correct channel
        '1752568742.663279', // correct thread timestamp
      );

      // Verify the robot method was called with the callback
      const mockRobotService = jest.mocked(
        (service as any).robotService.getRobotByName(),
      );
      expect(
        mockRobotService.acceptMessageMultiPartResponse,
      ).toHaveBeenCalledTimes(1);

      // Verify the callback parameter was a function
      const callArgs =
        mockRobotService.acceptMessageMultiPartResponse.mock.calls[0];
      expect(typeof callArgs[1]).toBe('function'); // Second argument should be the callback function
    });
  });
});
