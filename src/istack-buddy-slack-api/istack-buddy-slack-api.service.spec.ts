import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotService } from '../robots/robot.service';
import { ConversationListSlackAppService } from '../ConversationLists/ConversationListSlackAppService';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
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
    // Clear all timers and mock setInterval to prevent hanging tests
    jest.clearAllTimers();
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval').mockImplementation(
      () =>
        ({
          unref: jest.fn(),
          ref: jest.fn(),
          hasRef: jest.fn().mockReturnValue(false),
          refresh: jest.fn(),
          [Symbol.toPrimitive]: jest.fn(),
          [Symbol.dispose]: jest.fn(),
        }) as any,
    );

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
        ChatConversationListService, // Required by ChatManagerService
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
    // Clear all timers and restore original functions
    jest.clearAllTimers();
    jest.useRealTimers();
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

      // Verify messages were actually stored (3 user messages + 3 robot responses = 6 total)
      const messages = await chatManagerService.getMessages(
        conversation.id,
        {},
      );
      expect(messages).toHaveLength(6);

      // Filter user and robot messages
      const userMessages = messages.filter(
        (msg) => msg.fromRole === UserRole.CUSTOMER,
      );
      const robotMessages = messages.filter(
        (msg) => msg.fromRole === UserRole.ROBOT,
      );

      expect(userMessages).toHaveLength(3);
      expect(robotMessages).toHaveLength(3);

      // Verify user message content in order
      expect(userMessages[0].content).toBe(
        '<@U092RRN555X> test message 1 - channel mention',
      );
      expect(userMessages[0].fromUserId).toBe('cx-slack-robot'); // Generic Slack robot user
      expect(userMessages[0].fromRole).toBe(UserRole.CUSTOMER);

      expect(userMessages[1].content).toBe(
        '<@U092RRN555X> test message 2 - thread reply 1',
      );
      expect(userMessages[1].fromUserId).toBe('cx-slack-robot'); // Generic Slack robot user

      expect(userMessages[2].content).toBe(
        '<@U092RRN555X> test message 3 - thread reply 2',
      );
      expect(userMessages[2].fromUserId).toBe('cx-slack-robot'); // Generic Slack robot user

      // Verify robot responses
      robotMessages.forEach((robotMsg) => {
        expect(robotMsg.content).toBe('Mock robot response from callback');
        expect(robotMsg.messageType).toBe(MessageType.ROBOT);
        expect(robotMsg.fromRole).toBe(UserRole.ROBOT);
      });

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

      // Each conversation should have 6 messages (3 user + 3 robot responses)
      expect(conv1Messages.length + conv2Messages.length).toBe(12);
      expect(conv1Messages).toHaveLength(6);
      expect(conv2Messages).toHaveLength(6);

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

    it('should invoke robot callback which calls sendSlackMessage and adds message to conversation', async () => {
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

      // NEW: Verify robot response was added to conversation history
      const conversations = await chatManagerService.getConversations();
      expect(conversations).toHaveLength(1);

      const conversation = conversations[0];
      const messages = await chatManagerService.getMessages(
        conversation.id,
        {},
      );

      // Should have 2 messages: user input + robot response
      expect(messages).toHaveLength(2);

      // Verify robot response message
      const robotMessage = messages.find(
        (msg) => msg.fromRole === UserRole.ROBOT,
      );
      expect(robotMessage).toBeDefined();
      expect(robotMessage!.content).toBe('Mock robot response from callback');
      expect(robotMessage!.messageType).toBe(MessageType.ROBOT);
      expect(robotMessage!.fromUserId).toBe('cx-slack-robot');
      expect(robotMessage!.toRole).toBe(UserRole.CUSTOMER);
    });
  });

  describe('createMessageEnvelopeWithHistory', () => {
    let testConversationId: string;

    beforeEach(async () => {
      // Create a test conversation for each test
      const conversation = await chatManagerService.startConversation({
        createdBy: 'test-user',
        createdByRole: UserRole.CUSTOMER,
      });
      testConversationId = conversation.id;
    });

    it('should create envelope with history containing robot messages', async () => {
      // Arrange - Add various message types to conversation history
      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'user1',
        content: 'User message 1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'robot-assistant',
        content: 'Robot response 1',
        fromRole: UserRole.ROBOT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.ROBOT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'cx-slack-robot',
        content: 'Slack robot message',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'user2',
        content: 'User message 2',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      });

      // Act - Create message envelope with history
      const envelope = await (service as any).createMessageEnvelopeWithHistory({
        conversationId: testConversationId,
        fromUserId: 'test-user',
        content: 'New test message',
      });

      // Assert - Verify envelope structure
      expect(envelope).toBeDefined();
      expect(envelope.messageId).toBeDefined();
      expect(envelope.requestOrResponse).toBe('request');
      expect(envelope.envelopePayload.author_role).toBe('test-user');
      expect(envelope.envelopePayload.content.payload).toBe('New test message');
      expect(envelope.envelopePayload.content.type).toBe('text/plain');

      // Verify history was retrieved (should contain all 4 messages)
      const history = await chatManagerService.getLastMessages(
        testConversationId,
        20,
      );
      expect(history).toHaveLength(4);

      // Verify robot messages are properly identified in history
      const robotMessages =
        await chatManagerService.getFilteredRobotMessages(testConversationId);
      expect(robotMessages).toHaveLength(2); // Robot assistant + Slack robot

      const robotMessageContents = robotMessages.map((msg) => msg.content);
      expect(robotMessageContents).toContain('Robot response 1');
      expect(robotMessageContents).toContain('Slack robot message');
    });

    it('should create envelope with history containing no robot messages', async () => {
      // Arrange - Add only user messages to conversation history
      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'user1',
        content: 'User message 1',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'user2',
        content: 'User message 2',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'agent1',
        content: 'Agent response',
        fromRole: UserRole.AGENT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.TEXT,
      });

      // Act - Create message envelope with history
      const envelope = await (service as any).createMessageEnvelopeWithHistory({
        conversationId: testConversationId,
        fromUserId: 'test-user',
        content: 'New test message with no robot history',
      });

      // Assert - Verify envelope structure
      expect(envelope).toBeDefined();
      expect(envelope.messageId).toBeDefined();
      expect(envelope.requestOrResponse).toBe('request');
      expect(envelope.envelopePayload.author_role).toBe('test-user');
      expect(envelope.envelopePayload.content.payload).toBe(
        'New test message with no robot history',
      );

      // Verify history was retrieved (should contain all 3 messages)
      const history = await chatManagerService.getLastMessages(
        testConversationId,
        20,
      );
      expect(history).toHaveLength(3);

      // Verify no robot messages exist in history
      const robotMessages =
        await chatManagerService.getFilteredRobotMessages(testConversationId);
      expect(robotMessages).toHaveLength(0);

      // Verify all messages are user/agent messages
      const userMessages = await chatManagerService.getFilteredMessages(
        testConversationId,
        {
          fromRole: UserRole.CUSTOMER,
        },
      );
      const agentMessages = await chatManagerService.getFilteredMessages(
        testConversationId,
        {
          fromRole: UserRole.AGENT,
        },
      );
      expect(userMessages.length + agentMessages.length).toBe(3);
    });

    it('should create envelope with mixed robot roles (to and from)', async () => {
      // Arrange - Add messages with robots as both sender and receiver
      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'user1',
        content: 'User asks question',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT, // User talking TO robot
        messageType: MessageType.TEXT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'robot-assistant',
        content: 'Robot answers question',
        fromRole: UserRole.ROBOT, // Robot talking FROM robot role
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.ROBOT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'supervisor1',
        content: 'Supervisor message to robot',
        fromRole: UserRole.SUPERVISOR,
        toRole: UserRole.ROBOT, // Supervisor talking TO robot
        messageType: MessageType.TEXT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'robot-escalation',
        content: 'Robot escalation response',
        fromRole: UserRole.ROBOT, // Robot talking FROM robot role
        toRole: UserRole.SUPERVISOR,
        messageType: MessageType.ROBOT,
      });

      // Act - Create message envelope with history
      const envelope = await (service as any).createMessageEnvelopeWithHistory({
        conversationId: testConversationId,
        fromUserId: 'test-user',
        content: 'New message in robot conversation',
      });

      // Assert - Verify envelope structure
      expect(envelope).toBeDefined();
      expect(envelope.envelopePayload.content.payload).toBe(
        'New message in robot conversation',
      );

      // Verify history contains all messages
      const history = await chatManagerService.getLastMessages(
        testConversationId,
        20,
      );
      expect(history).toHaveLength(4);

      // Verify robot messages are properly identified (should include TO and FROM robot)
      const robotMessages =
        await chatManagerService.getFilteredRobotMessages(testConversationId);
      expect(robotMessages).toHaveLength(4); // All messages involve robots either as to or from

      // Verify specific robot message types
      const robotFromMessages = await chatManagerService.getFilteredMessages(
        testConversationId,
        {
          fromRole: UserRole.ROBOT,
        },
      );
      expect(robotFromMessages).toHaveLength(2); // Messages FROM robots

      const robotToMessages = await chatManagerService.getFilteredMessages(
        testConversationId,
        {
          toRole: UserRole.ROBOT,
        },
      );
      expect(robotToMessages).toHaveLength(2); // Messages TO robots
    });

    it('should handle empty conversation history gracefully', async () => {
      // Act - Create envelope for conversation with no history (just the initial conversation)
      const envelope = await (service as any).createMessageEnvelopeWithHistory({
        conversationId: testConversationId,
        fromUserId: 'first-user',
        content: 'First message in conversation',
      });

      // Assert - Verify envelope is created correctly
      expect(envelope).toBeDefined();
      expect(envelope.messageId).toBeDefined();
      expect(envelope.requestOrResponse).toBe('request');
      expect(envelope.envelopePayload.author_role).toBe('first-user');
      expect(envelope.envelopePayload.content.payload).toBe(
        'First message in conversation',
      );

      // Verify history is empty (no messages added yet)
      const history = await chatManagerService.getLastMessages(
        testConversationId,
        20,
      );
      expect(history).toHaveLength(0);

      // Verify no robot messages
      const robotMessages =
        await chatManagerService.getFilteredRobotMessages(testConversationId);
      expect(robotMessages).toHaveLength(0);
    });

    it('should handle large conversation history (20+ messages)', async () => {
      // Arrange - Add more than 20 messages to test history limit
      for (let i = 1; i <= 25; i++) {
        const isRobot = i % 3 === 0; // Every 3rd message is from robot
        await chatManagerService.addMessage({
          conversationId: testConversationId,
          fromUserId: isRobot ? `robot-${i}` : `user-${i}`,
          content: `Message ${i}`,
          fromRole: isRobot ? UserRole.ROBOT : UserRole.CUSTOMER,
          toRole: isRobot ? UserRole.CUSTOMER : UserRole.AGENT,
          messageType: isRobot ? MessageType.ROBOT : MessageType.TEXT,
        });
      }

      // Act - Create message envelope with history
      const envelope = await (service as any).createMessageEnvelopeWithHistory({
        conversationId: testConversationId,
        fromUserId: 'test-user',
        content: 'New message with large history',
      });

      // Assert - Verify envelope structure
      expect(envelope).toBeDefined();
      expect(envelope.envelopePayload.content.payload).toBe(
        'New message with large history',
      );

      // Verify history limit (should retrieve last 20 messages, not all 25)
      const history = await chatManagerService.getLastMessages(
        testConversationId,
        20,
      );
      expect(history).toHaveLength(20);

      // Verify robot messages in the retrieved history
      const robotMessages =
        await chatManagerService.getFilteredRobotMessages(testConversationId);
      expect(robotMessages.length).toBeGreaterThan(0); // Should have some robot messages

      // Robot messages should be every 3rd message, so in 25 messages: 3,6,9,12,15,18,21,24 = 8 robot messages
      const allMessages = await chatManagerService.getMessages(
        testConversationId,
        { limit: 100 },
      );
      expect(allMessages).toHaveLength(25);

      const allRobotMessages =
        await chatManagerService.getFilteredRobotMessages(testConversationId);
      expect(allRobotMessages).toHaveLength(8); // Every 3rd of 25 messages
    });

    it('should send correct envelope structure to robot acceptMessageMultiPartResponse', async () => {
      // Arrange - Add some conversation history to make it realistic
      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'user1',
        content: 'Previous user message',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      });

      await chatManagerService.addMessage({
        conversationId: testConversationId,
        fromUserId: 'robot-assistant',
        content: 'Previous robot response',
        fromRole: UserRole.ROBOT,
        toRole: UserRole.CUSTOMER,
        messageType: MessageType.ROBOT,
      });

      // Capture what gets sent to the robot
      let capturedEnvelope: any = null;
      let capturedCallback: any = null;

      // Mock the robot to capture the arguments
      const mockRobot = {
        acceptMessageMultiPartResponse: jest
          .fn()
          .mockImplementation(async (envelope, callback) => {
            capturedEnvelope = envelope;
            capturedCallback = callback;

            // Return a mock response
            return {
              envelopePayload: {
                content: {
                  payload: 'Mock robot response for inspection',
                },
              },
            };
          }),
      };

      // Replace the robot service mock for this test
      const originalGetRobotByName = (service as any).robotService
        .getRobotByName;
      (service as any).robotService.getRobotByName = jest
        .fn()
        .mockReturnValue(mockRobot);

      // Act - Trigger the actual robot call through handleAppMention
      const channelEvent = createChannelMentionEvent({
        ts: '1752568742.999999',
        event_ts: '1752568742.999999',
        text: '<@U092RRN555X> What is the current status?',
        user: 'U091Y5UF14P',
        channel: 'C091Y5UNA1M',
      });

      await (service as any).handleAppMention(channelEvent);

      // Assert - Inspect the envelope sent to the robot
      expect(capturedEnvelope).toBeDefined();
      expect(capturedCallback).toBeDefined();
      expect(typeof capturedCallback).toBe('function');

      // Verify envelope structure
      console.log('📋 ENVELOPE SENT TO ROBOT:');
      console.log('messageId:', capturedEnvelope.messageId);
      console.log('requestOrResponse:', capturedEnvelope.requestOrResponse);
      console.log(
        'envelopePayload:',
        JSON.stringify(capturedEnvelope.envelopePayload, null, 2),
      );

      // Test envelope properties
      expect(capturedEnvelope.messageId).toBeDefined();
      expect(typeof capturedEnvelope.messageId).toBe('string');
      expect(capturedEnvelope.requestOrResponse).toBe('request');

      // Test payload properties
      const payload = capturedEnvelope.envelopePayload;
      expect(payload.messageId).toBeDefined();
      expect(payload.author_role).toBe('U091Y5UF14P'); // The user who sent the message
      expect(payload.content.type).toBe('text/plain');
      expect(payload.content.payload).toBe(
        '<@U092RRN555X> What is the current status?',
      );
      expect(payload.created_at).toBeDefined();
      expect(new Date(payload.created_at)).toBeInstanceOf(Date);
      expect(payload.estimated_token_count).toBe(-1); // As per implementation

      // Verify the robot method was called exactly once
      expect(mockRobot.acceptMessageMultiPartResponse).toHaveBeenCalledTimes(1);
      expect(mockRobot.acceptMessageMultiPartResponse).toHaveBeenCalledWith(
        capturedEnvelope,
        capturedCallback,
      );

      // Restore original mock
      (service as any).robotService.getRobotByName = originalGetRobotByName;
    });
  });

  describe('handleSlackEvent', () => {
    it('should handle URL verification challenge', async () => {
      const mockReq = {
        body: {
          challenge: 'test-challenge-string',
          event: { ts: '1752568742.663279', text: 'test' }, // Add event to prevent undefined error
        },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await service.handleSlackEvent(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        challenge: 'test-challenge-string',
      });
    });

    it('should handle duplicate events', async () => {
      const mockEvent = {
        ts: '1752568742.663279',
        text: 'test message',
      };
      const mockReq = {
        body: {
          event: mockEvent,
          event_id: 'test-event-id',
        },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // First call should process the event
      await service.handleSlackEvent(mockReq as any, mockRes as any);

      // Second call with same event should be treated as duplicate
      await service.handleSlackEvent(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('should handle non-app_mention events', async () => {
      const mockReq = {
        body: {
          event: {
            type: 'message',
            ts: '1752568742.663279',
            text: 'regular message',
          },
        },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await service.handleSlackEvent(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('should handle app_mention events', async () => {
      const mockReq = {
        body: {
          event: {
            type: 'app_mention',
            user: 'U091Y5UF14P',
            ts: '1752568742.663279',
            text: '<@U092RRN555X> test mention',
            channel: 'C091Y5UNA1M',
          },
        },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await service.handleSlackEvent(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('should handle errors during event processing', async () => {
      const mockReq = {
        body: {
          event: {
            type: 'app_mention',
            user: 'U091Y5UF14P',
            ts: '1752568742.663279',
            text: '<@U092RRN555X> test mention',
            channel: 'C091Y5UNA1M',
          },
        },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Mock chatManagerService to throw an error
      jest
        .spyOn(chatManagerService, 'startConversation')
        .mockRejectedValue(new Error('Test error'));

      await service.handleSlackEvent(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
    });
  });

  describe('makeSimplifiedEvent', () => {
    it('should create conversation_start event for channel mention', () => {
      const event = {
        ts: '1752568742.663279',
        text: 'test message',
      };

      const result = (service as any).makeSimplifiedEvent(event);

      expect(result).toEqual({
        eventType: 'conversation_start',
        conversationId: '1752568742.663279',
        message: 'test message',
        eventTs: '1752568742.663279',
      });
    });

    it('should create thread_reply event for thread message', () => {
      const event = {
        ts: '1752568827.543239',
        thread_ts: '1752568742.663279',
        text: 'thread reply',
      };

      const result = (service as any).makeSimplifiedEvent(event);

      expect(result).toEqual({
        eventType: 'thread_reply',
        conversationId: '1752568742.663279',
        message: 'thread reply',
        eventTs: '1752568827.543239',
      });
    });
  });

  describe('handleAppMention error handling', () => {
    it('should handle errors and send error message to Slack', async () => {
      const event = {
        user: 'U091Y5UF14P',
        type: 'app_mention',
        ts: '1752568742.663279',
        text: '<@U092RRN555X> test mention',
        channel: 'C091Y5UNA1M',
      };

      // Mock chatManagerService to throw an error
      jest
        .spyOn(chatManagerService, 'startConversation')
        .mockRejectedValue(new Error('Test error'));

      // Mock sendSlackMessage to verify it's called
      const sendSlackMessageSpy = jest
        .spyOn(service as any, 'sendSlackMessage')
        .mockResolvedValue(undefined);

      await expect((service as any).handleAppMention(event)).rejects.toThrow(
        'Test error',
      );

      expect(sendSlackMessageSpy).toHaveBeenCalledWith(
        'Sorry, I encountered an error processing your request: Test error',
        'C091Y5UNA1M',
        '1752568742.663279',
      );
    });

    it('should handle sendSlackMessage errors gracefully', async () => {
      const event = {
        user: 'U091Y5UF14P',
        type: 'app_mention',
        ts: '1752568742.663279',
        text: '<@U092RRN555X> test mention',
        channel: 'C091Y5UNA1M',
      };

      // Mock chatManagerService to throw an error
      jest
        .spyOn(chatManagerService, 'startConversation')
        .mockRejectedValue(new Error('Test error'));

      // Mock sendSlackMessage to throw an error
      jest
        .spyOn(service as any, 'sendSlackMessage')
        .mockRejectedValue(new Error('Slack API error'));

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect((service as any).handleAppMention(event)).rejects.toThrow(
        'Test error',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to send error message to Slack:',
        expect.any(Error),
      );
    });

    it('should handle thread reply with missing conversation mapping', async () => {
      const event = {
        user: 'U091Y5UF14P',
        type: 'app_mention',
        ts: '1752568827.543239',
        thread_ts: '1752568742.663279', // Thread timestamp
        text: '<@U092RRN555X> thread reply',
        channel: 'C091Y5UNA1M',
      };

      // Clear the conversation mapping
      (service as any).slackThreadToConversationMap = {};

      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      await (service as any).handleAppMention(event);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Ignoring event - thread_ts: 1752568742.663279, no mapping found or unrecognized pattern',
      );
    });
  });

  describe('sendSlackMessage', () => {
    beforeEach(() => {
      // Restore the original sendSlackMessage method
      jest.restoreAllMocks();
    });

    it('should successfully send message to Slack', async () => {
      const mockResponse = {
        ok: true,
        channel: 'C091Y5UNA1M',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      await (service as any).sendSlackMessage(
        'Test message',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: 'C091Y5UNA1M',
            text: 'Test message',
            thread_ts: '1752568742.663279',
          }),
        },
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Message sent to Slack channel C091Y5UNA1M',
      );
    });

    it('should handle Slack API errors', async () => {
      const mockResponse = {
        ok: false,
        error: 'channel_not_found',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await (service as any).sendSlackMessage(
        'Test message',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Slack API error: channel_not_found',
      );
    });

    it('should handle HTTP errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await (service as any).sendSlackMessage(
        'Test message',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'HTTP error: 500 Internal Server Error',
      );
    });

    it('should handle fetch errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await (service as any).sendSlackMessage(
        'Test message',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Error sending message to Slack:',
        expect.any(Error),
      );
    });
  });

  describe('addSlackReaction', () => {
    beforeEach(() => {
      // Restore the original addSlackReaction method
      jest.restoreAllMocks();
    });

    it('should successfully add reaction to Slack message', async () => {
      const mockResponse = {
        ok: true,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      await (service as any).addSlackReaction(
        'thinking_face',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/reactions.add',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: 'C091Y5UNA1M',
            name: 'thinking_face',
            timestamp: '1752568742.663279',
          }),
        },
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Adding reaction :thinking_face: to message 1752568742.663279 in channel C091Y5UNA1M',
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Added reaction :thinking_face: to message in channel C091Y5UNA1M',
      );
    });

    it('should handle reaction API errors', async () => {
      const mockResponse = {
        ok: false,
        error: 'message_not_found',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await (service as any).addSlackReaction(
        'thinking_face',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to add reaction: message_not_found',
      );
      expect(loggerSpy).toHaveBeenCalledWith('Response status: 200');
      expect(loggerSpy).toHaveBeenCalledWith('Response data:', mockResponse);
    });

    it('should handle HTTP errors in reaction API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: jest
          .fn()
          .mockResolvedValue({ ok: false, error: 'Unknown error' }),
      });

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await (service as any).addSlackReaction(
        'thinking_face',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to add reaction: Unknown error',
      );
      expect(loggerSpy).toHaveBeenCalledWith('Response status: 404');
    });

    it('should handle fetch errors in reaction API', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await (service as any).addSlackReaction(
        'thinking_face',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Error adding reaction:',
        expect.any(Error),
      );
    });
  });

  describe('testReaction', () => {
    it('should successfully test reaction functionality', async () => {
      const addReactionSpy = jest
        .spyOn(service as any, 'addSlackReaction')
        .mockResolvedValue(undefined);

      const result = await service.testReaction(
        'C091Y5UNA1M',
        '1752568742.663279',
        'thinking_face',
      );

      expect(addReactionSpy).toHaveBeenCalledWith(
        'thinking_face',
        'C091Y5UNA1M',
        '1752568742.663279',
      );

      expect(result).toEqual({
        success: true,
        message:
          'Attempted to add :thinking_face: reaction. Check server logs for details.',
      });
    });

    it('should handle errors in test reaction', async () => {
      jest
        .spyOn(service as any, 'addSlackReaction')
        .mockRejectedValue(new Error('Test error'));

      const result = await service.testReaction(
        'C091Y5UNA1M',
        '1752568742.663279',
        'thinking_face',
      );

      expect(result).toEqual({
        success: false,
        error: 'Test error',
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should cleanup interval on module destroy', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      service.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Cleaned up garbage collection interval',
      );
    });

    it('should handle cleanup when interval is null', () => {
      // Set interval to null
      (service as any).cleanupIntervalId = null;

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      service.onModuleDestroy();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
      // When interval is null, the logger should not be called
      expect(loggerSpy).not.toHaveBeenCalled();
    });
  });

  describe('routineGarbageCollection', () => {
    it('should clean up old events during garbage collection', () => {
      // Add some old events to the uniqueEventList
      const oldTimestamp = (Date.now() / 1000 - 25 * 60 * 60).toString(); // 25 hours ago
      const recentTimestamp = (Date.now() / 1000 - 1 * 60 * 60).toString(); // 1 hour ago

      (service as any).uniqueEventList = {
        [oldTimestamp]: { event_id: 'old-event' },
        [recentTimestamp]: { event_id: 'recent-event' },
      };

      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      (service as any).routineGarbageCollection();

      // Old event should be removed, recent event should remain
      expect((service as any).uniqueEventList[oldTimestamp]).toBeUndefined();
      expect((service as any).uniqueEventList[recentTimestamp]).toBeDefined();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Garbage collection completed. Cleaned up old events.',
      );
    });

    it('should log completion message during garbage collection', () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      (service as any).routineGarbageCollection();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Garbage collection completed. Cleaned up old events.',
      );
    });
  });
});
