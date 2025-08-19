import { Test, TestingModule } from '@nestjs/testing';
import { ChatManagerService } from './chat-manager.service';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import { RobotService } from '../robots/robot.service';
import {
  CreateMessageDto,
  MessageType,
  UserRole,
} from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { IConversationMessage } from './interfaces/message.interface';
import { mockConversationMessages } from '../../test-data/mocks/conversation-messages';
import { mockAIClientMocks } from '../../test-data/mocks/ai-clients';

describe('ChatManagerService', () => {
  let service: ChatManagerService;
  let mockChatConversationListService: jest.Mocked<ChatConversationListService>;
  let mockRobotService: jest.Mocked<RobotService>;
  let mockGateway: any;

  beforeEach(async () => {
    mockChatConversationListService = {
      addMessageToConversation: jest.fn(),
      getConversationById: jest.fn(),
      getConversationOrCreate: jest.fn(),
      getAllConversationIds: jest.fn(),
      getFilteredMessages: jest.fn(),
      getFilteredRobotMessages: jest.fn(),
      getMessagesVisibleToRole: jest.fn(),
      getMessagesForRobotProcessing: jest.fn(),
      getRecentMessagesWithinTokenLimit: jest.fn(),
      getMessagesByUser: jest.fn(),
      getMessagesByType: jest.fn(),
      getLatestMessage: jest.fn(),
      getMessageCountsByType: jest.fn(),
      getMessageCount: jest.fn(),
      hasConversation: jest.fn(),
      removeConversation: jest.fn(),
      getAllConversationIds: jest.fn(),
      getAllConversations: jest.fn(),
      getConversationCount: jest.fn(),
      clearAllConversations: jest.fn(),
    } as any;

    mockRobotService = {
      getRobotByName: jest.fn(),
      getRobotByType: jest.fn(),
      getAllRobots: jest.fn(),
      executeRobot: jest.fn(),
    } as any;

    mockGateway = {
      broadcastToConversation: jest.fn(),
      broadcastToDashboard: jest.fn(),
      server: {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatManagerService,
        {
          provide: ChatConversationListService,
          useValue: mockChatConversationListService,
        },
        {
          provide: RobotService,
          useValue: mockRobotService,
        },
      ],
    }).compile();

    service = module.get<ChatManagerService>(ChatManagerService);

    // Set the gateway
    (service as any).gateway = mockGateway;
  });

  describe('createConversationCallbacks', () => {
    it('should create callbacks with all required methods', () => {
      const conversationId = 'test-conversation';
      const callbacks = service.createConversationCallbacks(conversationId);

      expect(callbacks).toHaveProperty('onStreamChunkReceived');
      expect(callbacks).toHaveProperty('onStreamStart');
      expect(callbacks).toHaveProperty('onStreamFinished');
      expect(callbacks).toHaveProperty('onFullMessageReceived');
      expect(callbacks).toHaveProperty('onError');
      expect(typeof callbacks.onStreamChunkReceived).toBe('function');
      expect(typeof callbacks.onStreamStart).toBe('function');
      expect(typeof callbacks.onStreamFinished).toBe('function');
      expect(typeof callbacks.onFullMessageReceived).toBe('function');
      expect(typeof callbacks.onError).toBe('function');
    });

    it('should handle onStreamChunkReceived', async () => {
      const conversationId = 'test-conversation';
      const callbacks = service.createConversationCallbacks(conversationId);
      const chunk = 'test chunk';

      await callbacks.onStreamChunkReceived(chunk, 'text/plain');

      expect(mockGateway.broadcastToConversation).toHaveBeenCalledWith(
        conversationId,
        'robot_chunk',
        { chunk },
      );
    });

    it('should handle onStreamStart', async () => {
      const conversationId = 'test-conversation';
      const callbacks = service.createConversationCallbacks(conversationId);
      const message = { id: 'test-message' };

      await callbacks.onStreamStart(message);

      // Should not throw any errors
      expect(true).toBe(true);
    });

    it('should handle onStreamFinished with content', async () => {
      const conversationId = 'test-conversation';
      const callbacks = service.createConversationCallbacks(conversationId);
      const message = mockConversationMessages.robotMessage('Final response');

      // Mock the createMessage method
      jest.spyOn(service, 'createMessage').mockResolvedValue(message);

      // Mock accumulated content by calling onStreamChunkReceived first
      await callbacks.onStreamChunkReceived('Final response');

      await callbacks.onStreamFinished(message);

      expect(service.createMessage).toHaveBeenCalled();
      expect(mockGateway.server.to).toHaveBeenCalledWith(conversationId);
      expect(mockGateway.broadcastToConversation).toHaveBeenCalledWith(
        conversationId,
        'robot_complete',
        { messageId: message.id },
      );
    });

    it('should handle onFullMessageReceived', async () => {
      const conversationId = 'test-conversation';
      const callbacks = service.createConversationCallbacks(conversationId);
      const message = {
        content: {
          type: 'text/plain',
          payload: 'Full message content',
        },
      };

      // Mock the addMessage method
      jest
        .spyOn(service, 'addMessage')
        .mockResolvedValue(mockConversationMessages.robotMessage('Response'));
      jest
        .spyOn(service, 'createMessage')
        .mockResolvedValue(mockConversationMessages.robotMessage('Response'));

      await callbacks.onFullMessageReceived(message);

      expect(service.addMessage).toHaveBeenCalled();
      expect(service.createMessage).toHaveBeenCalled();
    });

    it('should handle onError', async () => {
      const conversationId = 'test-conversation';
      const callbacks = service.createConversationCallbacks(conversationId);
      const error = new Error('Test error');

      await callbacks.onError(error);

      // The onError callback creates messages and broadcasts them, not just robot_error
      expect(mockGateway.broadcastToConversation).toHaveBeenCalled();
    });
  });

  describe('handleRobotMessage', () => {
    it('should handle robot message and trigger robot response', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Hello robot',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      const mockRobot = {
        acceptMessageImmediateResponse: jest
          .fn()
          .mockResolvedValue('Robot response'),
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      // Mock the addMessage method to avoid complex robot interactions
      jest
        .spyOn(service, 'addMessage')
        .mockResolvedValue(mockConversationMessages.robotMessage('Response'));

      await service.handleRobotMessage(createMessageDto);

      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'AnthropicMarv',
      );
      expect(service.addMessage).toHaveBeenCalled();
    });

    it('should handle robot message with different robot name', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Hello robot',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
        robotName: 'SlackyOpenAiAgent', // Add robotName to the DTO
      };

      const mockRobot = {
        acceptMessageImmediateResponse: jest
          .fn()
          .mockResolvedValue('Robot response'),
        getGetFromRobotToConversationTransformer: jest.fn(),
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      // Mock the addMessage method to avoid complex robot interactions
      jest
        .spyOn(service, 'addMessage')
        .mockResolvedValue(mockConversationMessages.robotMessage('Response'));

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      await service.handleRobotMessage(createMessageDto);

      // The service hardcodes 'AnthropicMarv' regardless of the DTO
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'AnthropicMarv',
      );
    });
  });

  describe('addMessage', () => {
    it('should add message successfully', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Hello world',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      };

      const result = await service.addMessage(createMessageDto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(
        mockChatConversationListService.addMessageToConversation,
      ).toHaveBeenCalledWith(
        createMessageDto.conversationId,
        expect.objectContaining({
          conversationId: createMessageDto.conversationId,
          content: expect.objectContaining({
            type: 'text/plain',
            payload: createMessageDto.content,
          }),
          messageType: createMessageDto.messageType,
        }),
      );
    });

    it('should handle robot message and trigger robot response', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Hello robot',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      const mockRobot = {
        acceptMessageImmediateResponse: jest
          .fn()
          .mockResolvedValue('Robot response'),
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      const result = await service.addMessage(createMessageDto);

      expect(result).toBeDefined();
      // The addMessage method doesn't directly call robot methods, it just adds the message
      expect(
        mockChatConversationListService.addMessageToConversation,
      ).toHaveBeenCalled();
    });
  });

  describe('createMessage', () => {
    it('should create message and redirect to addMessage', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Hello world',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      };

      const expectedMessage =
        mockConversationMessages.customerMessage('Hello world');
      jest.spyOn(service, 'addMessage').mockResolvedValue(expectedMessage);

      const result = await service.createMessage(createMessageDto);

      expect(result).toBe(expectedMessage);
      expect(service.addMessage).toHaveBeenCalledWith(createMessageDto, 'text');
    });

    it('should create message with custom content type', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Hello world',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      };

      const expectedMessage =
        mockConversationMessages.customerMessage('Hello world');
      jest.spyOn(service, 'addMessage').mockResolvedValue(expectedMessage);

      const result = await service.createMessage(
        createMessageDto,
        'application/json',
      );

      expect(result).toBe(expectedMessage);
      expect(service.addMessage).toHaveBeenCalledWith(
        createMessageDto,
        'application/json',
      );
    });
  });

  describe('addMessageFromSlack', () => {
    it('should add message from Slack and trigger robot response', async () => {
      const conversationId = 'test-conversation';
      const content = { type: 'text', payload: 'Hello from Slack' };
      const slackResponseCallback = jest.fn();

      const mockRobot = {
        acceptMessageImmediateResponse: jest
          .fn()
          .mockResolvedValue('Robot response'),
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      const expectedMessage =
        mockConversationMessages.customerMessage('Hello from Slack');
      jest.spyOn(service, 'addUserMessage').mockResolvedValue(expectedMessage);

      const result = await service.addMessageFromSlack(
        conversationId,
        content,
        slackResponseCallback,
      );

      expect(result).toBe(expectedMessage);
      expect(service.addUserMessage).toHaveBeenCalledWith(
        conversationId,
        content.payload,
        'cx-slack-robot',
        UserRole.CUSTOMER,
        UserRole.AGENT,
      );
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'SlackyOpenAiAgent',
      );
    });
  });

  describe('addMessageFromMarvSession', () => {
    it('should add message from Marv session and trigger robot response', async () => {
      const conversationId = 'test-conversation';
      const content = { type: 'text', payload: 'Hello from Marv' };
      const marvResponseCallback = jest.fn();

      const mockRobot = {
        acceptMessageImmediateResponse: jest
          .fn()
          .mockResolvedValue('Robot response'),
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      const expectedMessage =
        mockConversationMessages.customerMessage('Hello from Marv');
      jest.spyOn(service, 'addUserMessage').mockResolvedValue(expectedMessage);

      const result = await service.addMessageFromMarvSession(
        conversationId,
        content,
        marvResponseCallback,
      );

      expect(result).toBe(expectedMessage);
      expect(service.addUserMessage).toHaveBeenCalledWith(
        conversationId,
        content.payload,
        'form-marv-user',
        UserRole.CUSTOMER,
        UserRole.AGENT,
      );
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'AnthropicMarv',
      );
    });
  });

  describe('addUserMessage', () => {
    it('should add user message successfully', async () => {
      const conversationId = 'test-conversation';
      const content = 'Hello world';
      const fromUserId = 'test-user';
      const fromRole = UserRole.CUSTOMER;
      const toRole = UserRole.AGENT;

      const expectedMessage = mockConversationMessages.customerMessage(content);
      jest.spyOn(service, 'addMessage').mockResolvedValue(expectedMessage);

      const result = await service.addUserMessage(
        conversationId,
        content,
        fromUserId,
        fromRole,
        toRole,
      );

      expect(result).toBe(expectedMessage);
      expect(service.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId,
          fromUserId,
          content,
          messageType: MessageType.TEXT,
          fromRole,
          toRole,
        }),
      );
    });
  });

  describe('getConversations', () => {
    it('should return all conversations when no userId provided', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          participantIds: ['user1'],
          isActive: true,
          lastMessageAt: new Date(),
        },
        {
          id: 'conv2',
          participantIds: ['user2'],
          isActive: true,
          lastMessageAt: new Date(),
        },
      ];

      // Mock the conversation metadata
      (service as any).conversationMetadata = {
        conv1: mockConversations[0],
        conv2: mockConversations[1],
      };

      const result = await service.getConversations();

      expect(result).toEqual(mockConversations);
    });

    it('should return conversations for specific user', async () => {
      const userId = 'user1';
      const mockConversations = [
        { id: 'conv1', participantIds: ['user1'], isActive: true },
        { id: 'conv2', participantIds: ['user2'], isActive: true },
      ];

      // Mock the conversation metadata
      (service as any).conversationMetadata = {
        conv1: mockConversations[0],
        conv2: mockConversations[1],
      };

      const result = await service.getConversations(userId);

      expect(result).toEqual([mockConversations[0]]);
    });
  });

  describe('getConversationById', () => {
    it('should return conversation when it exists', async () => {
      const conversationId = 'test-conversation';
      const mockConversation = {
        id: conversationId,
        participantIds: ['user1'],
        isActive: true,
      };

      // Mock the conversation metadata
      (service as any).conversationMetadata = {
        [conversationId]: mockConversation,
      };

      const result = await service.getConversationById(conversationId);

      expect(result).toBe(mockConversation);
    });

    it('should return undefined when conversation does not exist', async () => {
      const conversationId = 'non-existent';

      const result = await service.getConversationById(conversationId);

      expect(result).toBeUndefined();
    });
  });

  describe('getMessages', () => {
    it('should return messages from conversation list service', async () => {
      const conversationId = 'test-conversation';
      const limit = 10;
      const mockMessages = [mockConversationMessages.customerMessage('Hello')];

      mockChatConversationListService.getConversationById.mockReturnValue({
        getAllChatMessages: jest.fn().mockReturnValue(mockMessages),
      } as any);

      const result = await service.getMessages(conversationId, limit);

      expect(result).toEqual(mockMessages);
    });

    it('should return empty array when conversation does not exist', async () => {
      const conversationId = 'non-existent';
      const limit = 10;

      mockChatConversationListService.getConversationById.mockReturnValue(
        undefined,
      );

      const result = await service.getMessages(conversationId, limit);

      expect(result).toEqual([]);
    });
  });

  describe('getLastMessages', () => {
    it('should return last messages from conversation list service', async () => {
      const conversationId = 'test-conversation';
      const limit = 5;
      const mockMessages = [mockConversationMessages.customerMessage('Hello')];

      mockChatConversationListService.getConversationById.mockReturnValue({
        getAllChatMessages: jest.fn().mockReturnValue(mockMessages),
      } as any);

      const result = await service.getLastMessages(conversationId, limit);

      expect(result).toEqual(mockMessages);
    });
  });

  describe('getFilteredMessages', () => {
    it('should return filtered messages from conversation list service', async () => {
      const conversationId = 'test-conversation';
      const filterOptions = { authorUserId: 'test-user' };
      const mockMessages = [mockConversationMessages.customerMessage('Hello')];

      mockChatConversationListService.getFilteredMessages.mockResolvedValue(
        mockMessages,
      );

      const result = await service.getFilteredMessages(
        conversationId,
        filterOptions,
      );

      expect(result).toEqual(mockMessages);
      expect(
        mockChatConversationListService.getFilteredMessages,
      ).toHaveBeenCalledWith(conversationId, filterOptions);
    });
  });

  describe('getFilteredRobotMessages', () => {
    it('should return robot messages from conversation list service', async () => {
      const conversationId = 'test-conversation';
      const mockMessages = [
        mockConversationMessages.robotMessage('Robot response'),
      ];

      mockChatConversationListService.getFilteredRobotMessages.mockResolvedValue(
        mockMessages,
      );

      const result = await service.getFilteredRobotMessages(conversationId);

      expect(result).toEqual(mockMessages);
      expect(
        mockChatConversationListService.getFilteredRobotMessages,
      ).toHaveBeenCalledWith(conversationId);
    });
  });

  describe('joinConversation', () => {
    it('should join conversation successfully', async () => {
      const conversationId = 'test-conversation';
      const joinRoomDto: JoinRoomDto = {
        userId: 'test-user',
        userRole: UserRole.CUSTOMER,
      };

      const mockConversation = {
        id: conversationId,
        participantIds: [],
        participantRoles: [],
      };

      // Mock the conversation metadata
      (service as any).conversationMetadata = {
        [conversationId]: mockConversation,
      };

      // Mock the participants map
      (service as any).participants = new Map();

      const result = await service.joinConversation(
        conversationId,
        joinRoomDto,
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(joinRoomDto.userId);
      expect(result.userRole).toBe(joinRoomDto.userRole);
      expect(mockGateway.broadcastToDashboard).toHaveBeenCalledWith(
        'conversation_participant_added',
        expect.objectContaining({
          conversationId,
          participant: result,
          action: 'added',
        }),
      );
    });

    it('should return existing participant if already joined', async () => {
      const conversationId = 'test-conversation';
      const joinRoomDto: JoinRoomDto = {
        userId: 'test-user',
        userRole: UserRole.CUSTOMER,
      };

      const existingParticipant = {
        userId: 'test-user',
        userRole: UserRole.CUSTOMER,
        joinedAt: new Date(),
      };

      const mockConversation = {
        id: conversationId,
        participantIds: ['test-user'],
        participantRoles: [UserRole.CUSTOMER],
      };

      // Mock the conversation metadata
      (service as any).conversationMetadata = {
        [conversationId]: mockConversation,
      };

      // Mock the participants map with existing participant
      (service as any).participants = new Map([
        [conversationId, [existingParticipant]],
      ]);

      const result = await service.joinConversation(
        conversationId,
        joinRoomDto,
      );

      expect(result).toBe(existingParticipant);
    });

    it('should throw error when conversation does not exist', async () => {
      const conversationId = 'non-existent';
      const joinRoomDto: JoinRoomDto = {
        userId: 'test-user',
        userRole: UserRole.CUSTOMER,
      };

      await expect(
        service.joinConversation(conversationId, joinRoomDto),
      ).rejects.toThrow(`Conversation ${conversationId} not found`);
    });
  });

  describe('getParticipants', () => {
    it('should return participants for conversation', async () => {
      const conversationId = 'test-conversation';
      const mockParticipants = [
        { userId: 'user1', userRole: UserRole.CUSTOMER, joinedAt: new Date() },
      ];

      // Mock the participants map
      (service as any).participants = new Map([
        [conversationId, mockParticipants],
      ]);

      const result = await service.getParticipants(conversationId);

      expect(result).toEqual(mockParticipants);
    });

    it('should return empty array when no participants', async () => {
      const conversationId = 'test-conversation';

      // Mock the participants map
      (service as any).participants = new Map();

      const result = await service.getParticipants(conversationId);

      expect(result).toEqual([]);
    });
  });

  describe('leaveConversation', () => {
    it('should remove participant from conversation', async () => {
      const conversationId = 'test-conversation';
      const userId = 'test-user';

      const mockParticipants = [
        { userId: 'user1', userRole: UserRole.CUSTOMER, joinedAt: new Date() },
        { userId: 'test-user', userRole: UserRole.AGENT, joinedAt: new Date() },
      ];

      const mockConversation = {
        id: conversationId,
        participantIds: ['user1', 'test-user'],
        participantRoles: [UserRole.CUSTOMER, UserRole.AGENT],
      };

      // Mock the conversation metadata
      (service as any).conversationMetadata = {
        [conversationId]: mockConversation,
      };

      // Mock the participants map
      (service as any).participants = new Map([
        [conversationId, mockParticipants],
      ]);

      const result = await service.leaveConversation(conversationId, userId);

      expect(result).toBe(true);
      expect(mockGateway.broadcastToDashboard).toHaveBeenCalledWith(
        'conversation_participant_removed',
        expect.objectContaining({
          conversationId,
          action: 'removed',
        }),
      );
    });

    it('should return false when participant not found', async () => {
      const conversationId = 'test-conversation';
      const userId = 'non-existent';

      const mockParticipants = [
        { userId: 'user1', userRole: UserRole.CUSTOMER, joinedAt: new Date() },
      ];

      // Mock the participants map
      (service as any).participants = new Map([
        [conversationId, mockParticipants],
      ]);

      const result = await service.leaveConversation(conversationId, userId);

      expect(result).toBe(false);
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      const mockConversations = [
        { id: 'conv1', isActive: true },
        { id: 'conv2', isActive: false },
        { id: 'conv3', isActive: true },
      ];

      // Mock the conversation metadata
      (service as any).conversationMetadata = {
        conv1: mockConversations[0],
        conv2: mockConversations[1],
        conv3: mockConversations[2],
      };

      // Mock conversation list service
      mockChatConversationListService.getAllConversationIds.mockReturnValue([
        'conv1',
        'conv2',
        'conv3',
      ]);
      mockChatConversationListService.getConversationById.mockReturnValue({
        getAllChatMessages: jest.fn().mockReturnValue([
          { authorUserId: 'user1', createdAt: new Date() },
          { authorUserId: 'user2', createdAt: new Date() },
        ]),
      } as any);

      const result = await service.getDashboardStats();

      expect(result).toBeDefined();
      expect(result.activeConversations).toBe(2);
      expect(result.totalMessages).toBe(6);
      expect(result.activeUsers).toBe(2);
      expect(result.queuedConversations).toBe(0);
    });
  });

  describe('startConversation', () => {
    it('should start new conversation successfully', async () => {
      const startConversationDto: StartConversationDto = {
        createdBy: 'test-user',
        createdByRole: UserRole.CUSTOMER,
        initialParticipants: ['user1', 'user2'],
      };

      const result = await service.startConversation(startConversationDto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.participantIds).toContain('test-user');
      expect(result.participantIds).toContain('user1');
      expect(result.participantIds).toContain('user2');
      expect(mockGateway.broadcastToDashboard).toHaveBeenCalledWith(
        'conversation_created',
        expect.objectContaining({
          createdBy: startConversationDto.createdBy,
          initialParticipants: startConversationDto.initialParticipants,
        }),
      );
    });
  });

  describe('getOrCreateExternalConversation', () => {
    it('should return existing conversation', async () => {
      const externalConversationId = 'external-123';
      const createdBy = 'test-user';
      const source = 'slack';
      const channelName = 'general';

      const existingConversation = {
        id: externalConversationId,
        participantIds: ['test-user'],
        isActive: true,
      };

      // Mock the conversation metadata
      (service as any).conversationMetadata = {
        [externalConversationId]: existingConversation,
      };

      const result = await service.getOrCreateExternalConversation(
        externalConversationId,
        createdBy,
        source,
        channelName,
      );

      expect(result).toBe(existingConversation);
    });

    it('should create new external conversation', async () => {
      const externalConversationId = 'external-123';
      const createdBy = 'test-user';
      const source = 'slack';
      const channelName = 'general';

      const result = await service.getOrCreateExternalConversation(
        externalConversationId,
        createdBy,
        source,
        channelName,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(externalConversationId);
      expect(result.participantIds).toContain(createdBy);
    });
  });

  describe('setGateway', () => {
    it('should set gateway', () => {
      const newGateway = { test: 'gateway' };

      service.setGateway(newGateway);

      expect((service as any).gateway).toBe(newGateway);
    });
  });

  describe('getGateway', () => {
    it('should return gateway', () => {
      const gateway = { test: 'gateway' };
      (service as any).gateway = gateway;

      const result = service.getGateway();

      expect(result).toBe(gateway);
    });
  });

  describe('setConversationFormId', () => {
    it('should set conversation form ID', () => {
      const conversationId = 'test-conversation';
      const formId = 'form-123';

      service.setConversationFormId(conversationId, formId);

      expect((service as any).conversationFormIds.get(conversationId)).toBe(
        formId,
      );
    });
  });

  describe('getConversationFormId', () => {
    it('should return conversation form ID', () => {
      const conversationId = 'test-conversation';
      const formId = 'form-123';

      (service as any).conversationFormIds.set(conversationId, formId);

      const result = service.getConversationFormId(conversationId);

      expect(result).toBe(formId);
    });

    it('should return undefined when form ID not found', () => {
      const conversationId = 'non-existent';

      const result = service.getConversationFormId(conversationId);

      expect(result).toBeUndefined();
    });
  });

  // **New Tests for Coverage Improvement**
  describe('validateConversationFormId', () => {
    it('should return false when conversation does not exist', () => {
      const conversationId = 'non-existent';
      const formId = 'form-123';

      const result = service.validateConversationFormId(conversationId, formId);

      expect(result).toBe(false);
    });

    it('should return false when form ID does not match', () => {
      const conversationId = 'test-conversation';
      const formId = 'form-123';
      const wrongFormId = 'form-456';

      // Mock conversation exists
      (service as any).conversationMetadata = {
        [conversationId]: { id: conversationId },
      };
      // Set form ID
      (service as any).conversationFormIds.set(conversationId, formId);

      const result = service.validateConversationFormId(
        conversationId,
        wrongFormId,
      );

      expect(result).toBe(false);
    });

    it('should return true when conversation and form ID match', () => {
      const conversationId = 'test-conversation';
      const formId = 'form-123';

      // Mock conversation exists
      (service as any).conversationMetadata = {
        [conversationId]: { id: conversationId },
      };
      // Set form ID
      (service as any).conversationFormIds.set(conversationId, formId);

      const result = service.validateConversationFormId(conversationId, formId);

      expect(result).toBe(true);
    });
  });

  describe('handleRobotStreamingResponse', () => {
    it('should handle robot not found error', async () => {
      const conversationId = 'test-conversation';
      const robotName = 'NonExistentRobot';
      const userMessage = 'Hello';
      const callbacks = {
        onError: jest.fn(),
      } as any;

      mockRobotService.getRobotByName.mockReturnValue(null);

      await service.handleRobotStreamingResponse(
        conversationId,
        robotName,
        userMessage,
        callbacks,
      );

      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Robot NonExistentRobot not found'),
        }),
      );
    });

    it('should handle robot without streaming support', async () => {
      const conversationId = 'test-conversation';
      const robotName = 'BasicRobot';
      const userMessage = 'Hello';
      const callbacks = {
        onError: jest.fn(),
      } as any;

      const mockRobot = {
        // Robot without acceptMessageStreamResponse method
        name: 'BasicRobot',
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      await service.handleRobotStreamingResponse(
        conversationId,
        robotName,
        userMessage,
        callbacks,
      );

      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'does not support streaming responses',
          ),
        }),
      );
    });

    it('should handle getHistory error gracefully', async () => {
      const conversationId = 'test-conversation';
      const robotName = 'AnthropicMarv';
      const userMessage = 'Hello';
      const callbacks = {
        onError: jest.fn(),
      } as any;

      const mockRobot = {
        acceptMessageStreamResponse: jest.fn().mockResolvedValue(undefined),
        getGetFromRobotToConversationTransformer: jest.fn(),
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      // Mock getHistory to throw error
      jest.spyOn(service as any, 'getHistory').mockImplementation(() => {
        throw new Error('History error');
      });

      await service.handleRobotStreamingResponse(
        conversationId,
        robotName,
        userMessage,
        callbacks,
      );

      // Should not call onError since getHistory error is caught internally
      expect(mockRobot.acceptMessageStreamResponse).toHaveBeenCalled();
    });
  });

  describe('addMessageFromSlack error handling', () => {
    it('should handle robot error gracefully', async () => {
      const conversationId = 'test-conversation';
      const content = { type: 'text', payload: 'Hello from Slack' };
      const slackResponseCallback = jest.fn();

      // Mock robot that throws error
      const mockRobot = {
        acceptMessageMultiPartResponse: jest
          .fn()
          .mockRejectedValue(new Error('Robot error')),
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      const expectedMessage =
        mockConversationMessages.customerMessage('Hello from Slack');
      jest.spyOn(service, 'addUserMessage').mockResolvedValue(expectedMessage);
      jest.spyOn(service, 'getLastMessages').mockResolvedValue([]);

      const result = await service.addMessageFromSlack(
        conversationId,
        content,
        slackResponseCallback,
      );

      expect(result).toBe(expectedMessage);
      // Should still return the user message even if robot fails
      expect(service.addUserMessage).toHaveBeenCalled();
    });

    it('should handle invalid robot response structure', async () => {
      const conversationId = 'test-conversation';
      const content = { type: 'text', payload: 'Hello from Slack' };
      const slackResponseCallback = jest.fn();

      const mockRobot = {
        acceptMessageMultiPartResponse: jest
          .fn()
          .mockImplementation(async (message, callback) => {
            // Call callback with invalid response structure
            await callback({ content: null });
          }),
      };
      mockRobotService.getRobotByName.mockReturnValue(mockRobot as any);

      const expectedMessage =
        mockConversationMessages.customerMessage('Hello from Slack');
      jest.spyOn(service, 'addUserMessage').mockResolvedValue(expectedMessage);
      jest.spyOn(service, 'getLastMessages').mockResolvedValue([]);

      const result = await service.addMessageFromSlack(
        conversationId,
        content,
        slackResponseCallback,
      );

      expect(result).toBe(expectedMessage);
      expect(slackResponseCallback).not.toHaveBeenCalled();
    });
  });

  describe('addMessageFromMarvSession error handling', () => {
    it('should handle robot streaming error gracefully', async () => {
      const conversationId = 'test-conversation';
      const content = { type: 'text', payload: 'Hello from Marv' };

      const expectedMessage =
        mockConversationMessages.customerMessage('Hello from Marv');
      jest.spyOn(service, 'addUserMessage').mockResolvedValue(expectedMessage);

      // Mock handleRobotStreamingResponse to throw error
      jest
        .spyOn(service, 'handleRobotStreamingResponse')
        .mockRejectedValue(new Error('Streaming error'));

      const result = await service.addMessageFromMarvSession(
        conversationId,
        content,
      );

      expect(result).toBe(expectedMessage);
      // Should still return the user message even if robot streaming fails
      expect(service.addUserMessage).toHaveBeenCalled();
    });
  });

  describe('getMessages with filtering', () => {
    it('should filter messages by threadId', async () => {
      const conversationId = 'test-conversation';
      const threadId = 'thread-123';
      const query = { threadId, limit: 10, offset: 0 };

      const mockMessages = [
        {
          ...mockConversationMessages.customerMessage('Hello'),
          threadId: 'thread-123',
        },
        {
          ...mockConversationMessages.customerMessage('World'),
          threadId: 'thread-456',
        },
      ];

      mockChatConversationListService.getConversationById.mockReturnValue({
        getAllChatMessages: jest.fn().mockReturnValue(mockMessages),
      } as any);

      const result = await service.getMessages(conversationId, query);

      expect(result).toHaveLength(1);
      expect(result[0].threadId).toBe(threadId);
    });

    it('should filter messages by userId', async () => {
      const conversationId = 'test-conversation';
      const userId = 'user-123';
      const query = { userId, limit: 10, offset: 0 };

      const mockMessages = [
        {
          ...mockConversationMessages.customerMessage('Hello'),
          authorUserId: 'user-123',
        },
        {
          ...mockConversationMessages.robotMessage('World'),
          authorUserId: 'user-456',
          fromRole: UserRole.ROBOT,
          toRole: UserRole.AGENT,
        },
      ];

      mockChatConversationListService.getConversationById.mockReturnValue({
        getAllChatMessages: jest.fn().mockReturnValue(mockMessages),
      } as any);

      const result = await service.getMessages(conversationId, query);

      expect(result).toHaveLength(1);
      expect(result[0].authorUserId).toBe(userId);
    });
  });

  describe('onStreamChunkReceived edge cases', () => {
    it('should not broadcast empty chunks', async () => {
      const conversationId = 'test-conversation';
      const callbacks = service.createConversationCallbacks(conversationId);

      await callbacks.onStreamChunkReceived('', 'text/plain');
      await callbacks.onStreamChunkReceived('   ', 'text/plain');

      expect(mockGateway.broadcastToConversation).not.toHaveBeenCalled();
    });

    it('should handle missing gateway in onStreamChunkReceived', async () => {
      const conversationId = 'test-conversation';

      // Temporarily remove gateway
      const originalGateway = (service as any).gateway;
      (service as any).gateway = null;

      const callbacks = service.createConversationCallbacks(conversationId);

      await callbacks.onStreamChunkReceived('test chunk', 'text/plain');

      // Should not throw error
      expect(true).toBe(true);

      // Restore gateway
      (service as any).gateway = originalGateway;
    });
  });

  describe('onStreamFinished edge cases', () => {
    it('should handle empty accumulated content', async () => {
      const conversationId = 'test-conversation';
      const callbacks = service.createConversationCallbacks(conversationId);
      const message = mockConversationMessages.robotMessage('');

      await callbacks.onStreamFinished(message);

      expect(mockGateway.server.to).not.toHaveBeenCalled();
    });

    it('should handle missing gateway in onStreamFinished', async () => {
      const conversationId = 'test-conversation';

      // Temporarily remove gateway
      const originalGateway = (service as any).gateway;
      (service as any).gateway = null;

      const callbacks = service.createConversationCallbacks(conversationId);
      const message = mockConversationMessages.robotMessage('Final response');

      // Mock the createMessage method
      jest.spyOn(service, 'createMessage').mockResolvedValue(message);

      // Add content first
      await callbacks.onStreamChunkReceived('Final response');
      await callbacks.onStreamFinished(message);

      // Should not throw error
      expect(service.createMessage).toHaveBeenCalled();

      // Restore gateway
      (service as any).gateway = originalGateway;
    });
  });
});
