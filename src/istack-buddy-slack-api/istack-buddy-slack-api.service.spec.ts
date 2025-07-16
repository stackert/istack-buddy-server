import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotProcessorService } from '../chat-manager/robot-processor.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';

describe('IstackBuddySlackApiService', () => {
  let service: IstackBuddySlackApiService;
  let chatManagerService: jest.Mocked<ChatManagerService>;
  let robotProcessorService: jest.Mocked<RobotProcessorService>;

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

    const mockRobotProcessorService = {
      processSlackMention: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IstackBuddySlackApiService,
        {
          provide: ChatManagerService,
          useValue: mockChatManagerService,
        },
        {
          provide: RobotProcessorService,
          useValue: mockRobotProcessorService,
        },
      ],
    }).compile();

    service = module.get<IstackBuddySlackApiService>(
      IstackBuddySlackApiService,
    );
    chatManagerService = module.get(ChatManagerService);
    robotProcessorService = module.get(RobotProcessorService);
  });

  afterEach(() => {
    // Restore setInterval
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateConversationForContext', () => {
    beforeEach(() => {
      // Clear the internal mapping before each test
      (service as any).slackThreadToConversationMap = {};
    });

    describe('new conversation detection', () => {
      it('should create new conversation when no thread_ts and event_ts equals ts', async () => {
        // Arrange
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Hello @istackbuddy',
          // No thread_ts property
        };

        chatManagerService.startConversation.mockResolvedValue(
          mockConversation,
        );

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toEqual(mockConversation);
        expect(chatManagerService.startConversation).toHaveBeenCalledWith({
          createdBy: 'test-user',
          createdByRole: UserRole.CUSTOMER,
          title: 'Slack Channel Conversation',
          description: 'Slack conversation from channel mention',
          initialParticipants: ['test-user'],
        });

        // Verify mapping was created
        const mapping = (service as any).slackThreadToConversationMap;
        expect(mapping['1234567890.123456']).toBe('test-conversation-id');
      });

      it('should create new conversation when thread_ts is undefined and event_ts equals ts', async () => {
        // Arrange
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Hello @istackbuddy',
          thread_ts: undefined,
        };

        chatManagerService.startConversation.mockResolvedValue(
          mockConversation,
        );

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toEqual(mockConversation);
        expect(chatManagerService.startConversation).toHaveBeenCalledTimes(1);
      });

      it('should create new conversation when thread_ts is null and event_ts equals ts', async () => {
        // Arrange
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Hello @istackbuddy',
          thread_ts: null,
        };

        chatManagerService.startConversation.mockResolvedValue(
          mockConversation,
        );

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toEqual(mockConversation);
        expect(chatManagerService.startConversation).toHaveBeenCalledTimes(1);
      });
    });

    describe('existing conversation detection', () => {
      it('should return null when thread_ts exists but not found in mapping', async () => {
        // Arrange
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Reply in thread',
          thread_ts: '1234567889.111111', // Different from ts
        };

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toBeNull();
        expect(chatManagerService.startConversation).not.toHaveBeenCalled();
        expect(chatManagerService.getConversationById).not.toHaveBeenCalled();
      });

      it('should return conversation when thread_ts exists and found in mapping', async () => {
        // Arrange
        const threadTs = '1234567889.111111';
        const conversationId = 'existing-conversation-id';

        // Pre-populate the mapping
        (service as any).slackThreadToConversationMap[threadTs] =
          conversationId;

        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Reply in thread',
          thread_ts: threadTs,
        };

        const existingConversation = {
          ...mockConversation,
          id: conversationId,
        };
        chatManagerService.getConversationById.mockResolvedValue(
          existingConversation,
        );

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toEqual(existingConversation);
        expect(chatManagerService.getConversationById).toHaveBeenCalledWith(
          conversationId,
        );
        expect(chatManagerService.startConversation).not.toHaveBeenCalled();
      });

      it('should return null when conversation found in mapping but not in ChatManager', async () => {
        // Arrange
        const threadTs = '1234567889.111111';
        const conversationId = 'missing-conversation-id';

        // Pre-populate the mapping
        (service as any).slackThreadToConversationMap[threadTs] =
          conversationId;

        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Reply in thread',
          thread_ts: threadTs,
        };

        // Return undefined (conversation not found)
        chatManagerService.getConversationById.mockResolvedValue(undefined);

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toBeNull();
        expect(chatManagerService.getConversationById).toHaveBeenCalledWith(
          conversationId,
        );
        expect(chatManagerService.startConversation).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should not create new conversation when thread_ts exists even if event_ts equals ts', async () => {
        // Arrange
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Reply in existing thread',
          thread_ts: '1234567889.111111', // Has thread_ts, so not new
        };

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toBeNull(); // Should return null because thread not in mapping
        expect(chatManagerService.startConversation).not.toHaveBeenCalled();
      });

      it('should not create new conversation when event_ts does not equal ts', async () => {
        // Arrange
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.999999', // Different from ts
          text: 'Hello @istackbuddy',
          // No thread_ts
        };

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toBeNull(); // Should return null because condition not met
        expect(chatManagerService.startConversation).not.toHaveBeenCalled();
      });

      it('should handle empty string thread_ts as existing conversation attempt', async () => {
        // Arrange
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Reply in thread',
          thread_ts: '', // Empty string - should be treated as existing conversation
        };

        // Mock to ensure we don't accidentally call startConversation
        chatManagerService.startConversation.mockResolvedValue(
          mockConversation,
        );

        // Act
        const result = await (service as any).getOrCreateConversationForContext(
          event,
        );

        // Assert
        expect(result).toBeNull(); // Should return null because empty string not in mapping
        expect(chatManagerService.startConversation).not.toHaveBeenCalled();
        expect(chatManagerService.getConversationById).not.toHaveBeenCalled();
      });
    });

    describe('mapping management', () => {
      it('should correctly map thread timestamp to conversation ID for new conversations', async () => {
        // Arrange
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Hello @istackbuddy',
        };

        chatManagerService.startConversation.mockResolvedValue(
          mockConversation,
        );

        // Act
        await (service as any).getOrCreateConversationForContext(event);

        // Assert
        const mapping = (service as any).slackThreadToConversationMap;
        expect(mapping[event.ts]).toBe(mockConversation.id);
      });

      it('should preserve existing mappings when looking up conversations', async () => {
        // Arrange
        const existingMapping = {
          '1111111111.111111': 'conv-1',
          '2222222222.222222': 'conv-2',
        };
        (service as any).slackThreadToConversationMap = { ...existingMapping };

        const threadTs = '2222222222.222222';
        const event = {
          user: 'test-user',
          ts: '1234567890.123456',
          event_ts: '1234567890.123456',
          text: 'Reply in thread',
          thread_ts: threadTs,
        };

        const existingConversation = { ...mockConversation, id: 'conv-2' };
        chatManagerService.getConversationById.mockResolvedValue(
          existingConversation,
        );

        // Act
        await (service as any).getOrCreateConversationForContext(event);

        // Assert
        const mapping = (service as any).slackThreadToConversationMap;
        expect(mapping).toEqual(existingMapping); // Should be unchanged
      });
    });
  });
});
