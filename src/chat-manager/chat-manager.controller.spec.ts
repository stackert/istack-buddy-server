import { Test, TestingModule } from '@nestjs/testing';
import { ChatManagerController } from './chat-manager.controller';
import { ChatManagerService } from './chat-manager.service';

import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import {
  CreateMessageDto,
  UserRole,
  MessageType,
} from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthenticationService } from '../authentication/authentication.service';

describe('ChatManagerController', () => {
  let controller: ChatManagerController;
  let service: ChatManagerService;

  const mockChatManagerService = {
    createMessage: jest.fn(),
    getConversations: jest.fn(),
    getMessages: jest.fn(),
    getLastMessages: jest.fn(),
    joinConversation: jest.fn(),
    getParticipants: jest.fn(),
    getDashboardStats: jest.fn(),
    startConversation: jest.fn(),
    leaveConversation: jest.fn(),
  };

  const mockCustomLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockAuthenticationService = {
    // Add any methods that AuthPermissionGuard might call
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatManagerController],
      providers: [
        {
          provide: ChatManagerService,
          useValue: mockChatManagerService,
        },
        {
          provide: CustomLoggerService,
          useValue: mockCustomLoggerService,
        },
        {
          provide: AuthenticationService,
          useValue: mockAuthenticationService,
        },

        ChatConversationListService,
      ],
    }).compile();

    controller = module.get<ChatManagerController>(ChatManagerController);
    service = module.get<ChatManagerService>(ChatManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMessage', () => {
    it('should create a message successfully', async () => {
      const createMessageDto: CreateMessageDto = {
        content: 'Test message',
        conversationId: 'conv-123',
        fromUserId: 'user-123',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
      };

      const expectedMessage = {
        id: 'msg-123',
        content: 'Test message',
        conversationId: 'conv-123',
        fromUserId: 'user-123',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockChatManagerService.createMessage.mockResolvedValue(expectedMessage);

      const result = await controller.createMessage(createMessageDto);

      expect(service.createMessage).toHaveBeenCalledWith(createMessageDto);
      expect(result).toEqual(expectedMessage);
    });

    it('should handle service errors', async () => {
      const createMessageDto: CreateMessageDto = {
        content: 'Test message',
        conversationId: 'conv-123',
        fromUserId: 'user-123',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      };

      const error = new Error('Service error');
      mockChatManagerService.createMessage.mockRejectedValue(error);

      await expect(controller.createMessage(createMessageDto)).rejects.toThrow(
        'Service error',
      );
      expect(service.createMessage).toHaveBeenCalledWith(createMessageDto);
    });
  });

  describe('getConversations', () => {
    it('should get conversations without userId filter', async () => {
      const expectedConversations = [
        { id: 'conv-1', title: 'Conversation 1' },
        { id: 'conv-2', title: 'Conversation 2' },
      ];

      mockChatManagerService.getConversations.mockResolvedValue(
        expectedConversations,
      );

      const result = await controller.getConversations();

      expect(service.getConversations).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expectedConversations);
    });

    it('should get conversations with userId filter', async () => {
      const userId = 'user-123';
      const expectedConversations = [
        { id: 'conv-1', title: 'User Conversation' },
      ];

      mockChatManagerService.getConversations.mockResolvedValue(
        expectedConversations,
      );

      const result = await controller.getConversations(userId);

      expect(service.getConversations).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedConversations);
    });

    it('should handle empty conversations list', async () => {
      mockChatManagerService.getConversations.mockResolvedValue([]);

      const result = await controller.getConversations();

      expect(service.getConversations).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('getMessages', () => {
    it('should get messages with query parameters', async () => {
      const conversationId = 'conv-123';
      const query: GetMessagesDto = {
        limit: 10,
        offset: 0,
        userId: 'user-123',
      };

      const expectedMessages = [
        {
          id: 'msg-1',
          content: 'Test message',
          conversationId: 'conv-123',
          authorUserId: 'user-123',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
          messageType: MessageType.TEXT,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockChatManagerService.getMessages.mockResolvedValue(expectedMessages);

      const result = await controller.getMessages(conversationId, query);

      expect(service.getMessages).toHaveBeenCalledWith(conversationId, query);
      expect(result).toEqual(expectedMessages);
    });

    it('should handle empty query parameters', async () => {
      const conversationId = 'conv-123';
      const query = {};

      const expectedMessages: any[] = [];

      mockChatManagerService.getMessages.mockResolvedValue(expectedMessages);

      const result = await controller.getMessages(conversationId, query);

      expect(service.getMessages).toHaveBeenCalledWith(conversationId, query);
      expect(result).toEqual(expectedMessages);
    });
  });

  describe('getLastMessages', () => {
    it('should get last messages with valid count', async () => {
      const conversationId = 'conv-123';
      const count = '5';

      const expectedMessages: any[] = [
        {
          id: 'msg-1',
          content: 'Message 1',
          conversationId: 'conv-123',
          authorUserId: 'user-123',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
          messageType: MessageType.TEXT,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'msg-2',
          content: 'Message 2',
          conversationId: 'conv-123',
          authorUserId: 'user-123',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
          messageType: MessageType.TEXT,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockChatManagerService.getLastMessages.mockResolvedValue(
        expectedMessages,
      );

      const result = await controller.getLastMessages(conversationId, count);

      expect(service.getLastMessages).toHaveBeenCalledWith(conversationId, 5);
      expect(result).toEqual(expectedMessages);
    });

    it('should default to 1 message when count is invalid', async () => {
      const conversationId = 'conv-123';
      const count = 'invalid';

      const expectedMessages = [{ id: 'msg-1', content: 'Message 1' }];

      mockChatManagerService.getLastMessages.mockResolvedValue(
        expectedMessages,
      );

      const result = await controller.getLastMessages(conversationId, count);

      expect(service.getLastMessages).toHaveBeenCalledWith(conversationId, 1);
      expect(result).toEqual(expectedMessages);
    });

    it('should handle zero count', async () => {
      const conversationId = 'conv-123';
      const count = '0';

      const expectedMessages: any[] = [];

      mockChatManagerService.getLastMessages.mockResolvedValue(
        expectedMessages,
      );

      const result = await controller.getLastMessages(conversationId, count);

      expect(service.getLastMessages).toHaveBeenCalledWith(conversationId, 1);
      expect(result).toEqual(expectedMessages);
    });
  });

  describe('joinConversation', () => {
    it('should join conversation successfully', async () => {
      const conversationId = 'conv-123';
      const joinRoomDto: JoinRoomDto = {
        userId: 'user-123',
        userRole: UserRole.CUSTOMER,
      };

      const expectedParticipant = {
        userId: 'user-123',
        userRole: UserRole.CUSTOMER,
        joinedAt: new Date(),
      };

      mockChatManagerService.joinConversation.mockResolvedValue(
        expectedParticipant,
      );

      const result = await controller.joinConversation(
        conversationId,
        joinRoomDto,
      );

      expect(service.joinConversation).toHaveBeenCalledWith(
        conversationId,
        joinRoomDto,
      );
      expect(result).toEqual(expectedParticipant);
    });

    it('should handle join conversation errors', async () => {
      const conversationId = 'conv-123';
      const joinRoomDto: JoinRoomDto = {
        userId: 'user-123',
        userRole: UserRole.CUSTOMER,
      };

      const error = new Error('Join failed');
      mockChatManagerService.joinConversation.mockRejectedValue(error);

      await expect(
        controller.joinConversation(conversationId, joinRoomDto),
      ).rejects.toThrow('Join failed');
      expect(service.joinConversation).toHaveBeenCalledWith(
        conversationId,
        joinRoomDto,
      );
    });
  });

  describe('getParticipants', () => {
    it('should get participants successfully', async () => {
      const conversationId = 'conv-123';

      const expectedParticipants = [
        { userId: 'user-1', userRole: UserRole.CUSTOMER, joinedAt: new Date() },
        { userId: 'user-2', userRole: UserRole.AGENT, joinedAt: new Date() },
      ];

      mockChatManagerService.getParticipants.mockResolvedValue(
        expectedParticipants,
      );

      const result = await controller.getParticipants(conversationId);

      expect(service.getParticipants).toHaveBeenCalledWith(conversationId);
      expect(result).toEqual(expectedParticipants);
    });

    it('should handle empty participants list', async () => {
      const conversationId = 'conv-123';

      mockChatManagerService.getParticipants.mockResolvedValue([]);

      const result = await controller.getParticipants(conversationId);

      expect(service.getParticipants).toHaveBeenCalledWith(conversationId);
      expect(result).toEqual([]);
    });
  });

  describe('getDashboardStats', () => {
    it('should get dashboard stats successfully', async () => {
      const expectedStats = {
        totalConversations: 10,
        activeConversations: 5,
        totalMessages: 100,
        averageMessagesPerConversation: 10,
      };

      mockChatManagerService.getDashboardStats.mockResolvedValue(expectedStats);

      const result = await controller.getDashboardStats();

      expect(service.getDashboardStats).toHaveBeenCalled();
      expect(result).toEqual(expectedStats);
    });

    it('should handle dashboard stats errors', async () => {
      const error = new Error('Stats error');
      mockChatManagerService.getDashboardStats.mockRejectedValue(error);

      await expect(controller.getDashboardStats()).rejects.toThrow(
        'Stats error',
      );
      expect(service.getDashboardStats).toHaveBeenCalled();
    });
  });

  describe('startConversation', () => {
    it('should start conversation successfully', async () => {
      const startConversationDto: StartConversationDto = {
        createdBy: 'user-123',
        createdByRole: UserRole.CUSTOMER,
        title: 'New Conversation',
        description: 'Test conversation',
      };

      const expectedConversation = {
        id: 'conv-123',
        title: 'New Conversation',
        description: 'Test conversation',
        createdBy: 'user-123',
        createdAt: new Date(),
      };

      mockChatManagerService.startConversation.mockResolvedValue(
        expectedConversation,
      );

      const result = await controller.startConversation(startConversationDto);

      expect(service.startConversation).toHaveBeenCalledWith(
        startConversationDto,
      );
      expect(result).toEqual(expectedConversation);
    });

    it('should handle start conversation errors', async () => {
      const startConversationDto: StartConversationDto = {
        createdBy: 'user-123',
        createdByRole: UserRole.CUSTOMER,
      };

      const error = new Error('Start failed');
      mockChatManagerService.startConversation.mockRejectedValue(error);

      await expect(
        controller.startConversation(startConversationDto),
      ).rejects.toThrow('Start failed');
      expect(service.startConversation).toHaveBeenCalledWith(
        startConversationDto,
      );
    });
  });

  describe('leaveConversation', () => {
    it('should leave conversation successfully', async () => {
      const conversationId = 'conv-123';
      const data = { userId: 'user-123' };

      mockChatManagerService.leaveConversation.mockResolvedValue(true);

      const result = await controller.leaveConversation(conversationId, data);

      expect(service.leaveConversation).toHaveBeenCalledWith(
        conversationId,
        data.userId,
      );
      expect(result).toEqual({
        success: true,
        conversationId: 'conv-123',
        userId: 'user-123',
      });
    });

    it('should handle leave conversation failure', async () => {
      const conversationId = 'conv-123';
      const data = { userId: 'user-123' };

      mockChatManagerService.leaveConversation.mockResolvedValue(false);

      const result = await controller.leaveConversation(conversationId, data);

      expect(service.leaveConversation).toHaveBeenCalledWith(
        conversationId,
        data.userId,
      );
      expect(result).toEqual({
        success: false,
        conversationId: 'conv-123',
        userId: 'user-123',
      });
    });

    it('should handle leave conversation errors', async () => {
      const conversationId = 'conv-123';
      const data = { userId: 'user-123' };

      const error = new Error('Leave failed');
      mockChatManagerService.leaveConversation.mockRejectedValue(error);

      await expect(
        controller.leaveConversation(conversationId, data),
      ).rejects.toThrow('Leave failed');
      expect(service.leaveConversation).toHaveBeenCalledWith(
        conversationId,
        data.userId,
      );
    });
  });
});
