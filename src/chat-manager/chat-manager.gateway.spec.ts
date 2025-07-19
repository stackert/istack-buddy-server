import { Test, TestingModule } from '@nestjs/testing';
import { ChatManagerGateway } from './chat-manager.gateway';
import { ChatManagerService } from './chat-manager.service';
import { ConversationListSlackAppService } from '../ConversationLists/ConversationListSlackAppService';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import {
  CreateMessageDto,
  UserRole,
  MessageType,
} from './dto/create-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { Server, Socket } from 'socket.io';

describe('ChatManagerGateway', () => {
  let gateway: ChatManagerGateway;
  let service: ChatManagerService;
  let mockServer: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;

  const mockChatManagerService = {
    createMessage: jest.fn(),
    joinConversation: jest.fn(),
    leaveConversation: jest.fn(),
    getLastMessages: jest.fn(),
    setGateway: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatManagerGateway,
        {
          provide: ChatManagerService,
          useValue: mockChatManagerService,
        },
        ConversationListSlackAppService,
        ChatConversationListService,
      ],
    }).compile();

    gateway = module.get<ChatManagerGateway>(ChatManagerGateway);
    service = module.get<ChatManagerService>(ChatManagerService);

    // Mock Socket.IO server and socket
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    mockSocket = {
      id: 'socket-123',
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    // Set the mocked server
    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      gateway.handleConnection(mockSocket);

      expect(consoleSpy).toHaveBeenCalledWith('Client connected: socket-123');
      consoleSpy.mockRestore();
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      gateway.handleDisconnect(mockSocket);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Client disconnected: socket-123',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('handleJoinRoom', () => {
    it('should handle join room with perfect data structure', async () => {
      const data = {
        conversationId: 'conv-123',
        joinData: {
          userId: 'user-123',
          userRole: UserRole.CUSTOMER,
        },
      };

      const expectedParticipant = {
        userId: 'user-123',
        userRole: UserRole.CUSTOMER,
        joinedAt: new Date(),
      };

      mockChatManagerService.joinConversation.mockResolvedValue(
        expectedParticipant,
      );

      const result = await gateway.handleJoinRoom(data, mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('conv-123');
      expect(service.joinConversation).toHaveBeenCalledWith(
        'conv-123',
        data.joinData,
      );
      expect(mockSocket.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_joined', {
        conversationId: 'conv-123',
        participant: expectedParticipant,
      });
      expect(result).toEqual({
        success: true,
        participant: expectedParticipant,
      });
    });

    it('should handle join room with default values', async () => {
      const data = {
        conversationId: 'conv-123',
        userId: 'user-123',
        userRole: UserRole.AGENT,
      };

      const expectedParticipant = {
        userId: 'user-123',
        userRole: UserRole.AGENT,
        joinedAt: new Date(),
      };

      mockChatManagerService.joinConversation.mockResolvedValue(
        expectedParticipant,
      );

      const result = await gateway.handleJoinRoom(data, mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('conv-123');
      expect(service.joinConversation).toHaveBeenCalledWith('conv-123', {
        userId: 'user-123',
        userRole: UserRole.AGENT,
      });
      expect(result).toEqual({
        success: true,
        participant: expectedParticipant,
      });
    });

    it('should handle missing conversationId', async () => {
      const data = { userId: 'user-123' };

      const result = await gateway.handleJoinRoom(data, mockSocket);

      expect(result).toEqual({
        success: false,
        error: 'conversationId is required',
      });
      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(service.joinConversation).not.toHaveBeenCalled();
    });

    it('should handle missing data', async () => {
      const result = await gateway.handleJoinRoom(null, mockSocket);

      expect(result).toEqual({
        success: false,
        error: 'No data provided',
      });
      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(service.joinConversation).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const data = {
        conversationId: 'conv-123',
        joinData: {
          userId: 'user-123',
          userRole: UserRole.CUSTOMER,
        },
      };

      const error = new Error('Join failed');
      mockChatManagerService.joinConversation.mockRejectedValue(error);

      const result = await gateway.handleJoinRoom(data, mockSocket);

      expect(result).toEqual({
        success: false,
        error: 'Join failed',
      });
    });
  });

  describe('handleLeaveRoom', () => {
    it('should handle leave room with userId', async () => {
      const data = {
        conversationId: 'conv-123',
        userId: 'user-123',
      };

      mockChatManagerService.leaveConversation.mockResolvedValue(true);

      const result = await gateway.handleLeaveRoom(data, mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('conv-123');
      expect(service.leaveConversation).toHaveBeenCalledWith(
        'conv-123',
        'user-123',
      );
      expect(mockSocket.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_left', {
        conversationId: 'conv-123',
        socketId: 'socket-123',
        userId: 'user-123',
      });
      expect(result).toEqual({ success: true });
    });

    it('should handle leave room without userId', async () => {
      const data = {
        conversationId: 'conv-123',
      };

      const result = await gateway.handleLeaveRoom(data, mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('conv-123');
      expect(service.leaveConversation).not.toHaveBeenCalled();
      expect(mockSocket.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_left', {
        conversationId: 'conv-123',
        socketId: 'socket-123',
        userId: undefined,
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('handleMessage', () => {
    it('should handle send message successfully', async () => {
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

      const result = await gateway.handleMessage(createMessageDto, mockSocket);

      expect(service.createMessage).toHaveBeenCalledWith(createMessageDto);
      expect(mockServer.to).toHaveBeenCalledWith('conv-123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'new_message',
        expectedMessage,
      );
      expect(result).toEqual(expectedMessage);
    });

    it('should handle message creation errors', async () => {
      const createMessageDto: CreateMessageDto = {
        content: 'Test message',
        conversationId: 'conv-123',
        fromUserId: 'user-123',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      };

      const error = new Error('Message creation failed');
      mockChatManagerService.createMessage.mockRejectedValue(error);

      await expect(
        gateway.handleMessage(createMessageDto, mockSocket),
      ).rejects.toThrow('Message creation failed');
      expect(service.createMessage).toHaveBeenCalledWith(createMessageDto);
      expect(mockServer.to).not.toHaveBeenCalled();
    });
  });

  describe('handleTypingStart', () => {
    it('should handle typing start', () => {
      const data = {
        conversationId: 'conv-123',
        userId: 'user-123',
        userName: 'John Doe',
      };

      gateway.handleTypingStart(data, mockSocket);

      expect(mockSocket.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_typing', {
        userId: 'user-123',
        userName: 'John Doe',
        isTyping: true,
      });
    });
  });

  describe('handleTypingStop', () => {
    it('should handle typing stop', () => {
      const data = {
        conversationId: 'conv-123',
        userId: 'user-123',
      };

      gateway.handleTypingStop(data, mockSocket);

      expect(mockSocket.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_typing', {
        userId: 'user-123',
        isTyping: false,
      });
    });
  });

  describe('handleGetMessages', () => {
    it('should handle get messages with limit', async () => {
      const data = {
        conversationId: 'conv-123',
        limit: 25,
      };

      const expectedMessages = [
        { id: 'msg-1', content: 'Message 1' },
        { id: 'msg-2', content: 'Message 2' },
      ];

      mockChatManagerService.getLastMessages.mockResolvedValue(
        expectedMessages,
      );

      const result = await gateway.handleGetMessages(data);

      expect(service.getLastMessages).toHaveBeenCalledWith('conv-123', 25);
      expect(result).toEqual(expectedMessages);
    });

    it('should handle get messages with default limit', async () => {
      const data = {
        conversationId: 'conv-123',
      };

      const expectedMessages = [{ id: 'msg-1', content: 'Message 1' }];

      mockChatManagerService.getLastMessages.mockResolvedValue(
        expectedMessages,
      );

      const result = await gateway.handleGetMessages(data);

      expect(service.getLastMessages).toHaveBeenCalledWith('conv-123', 50);
      expect(result).toEqual(expectedMessages);
    });
  });

  describe('handleShareRobotMessage', () => {
    it('should handle share robot message', async () => {
      const data = {
        originalMessageId: 'msg-123',
        conversationId: 'conv-123',
        fromUserId: 'user-123',
      };

      const result = await gateway.handleShareRobotMessage(data);

      expect(result).toEqual({
        success: true,
        message: 'Robot message sharing not yet implemented',
      });
    });
  });

  describe('handleJoinDashboard', () => {
    it('should handle join dashboard successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await gateway.handleJoinDashboard(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('dashboard');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Client socket-123 joining dashboard',
      );
      expect(result).toEqual({
        success: true,
        message: 'Joined dashboard room',
      });

      consoleSpy.mockRestore();
    });

    it('should handle join dashboard errors', async () => {
      const error = new Error('Join failed');
      mockSocket.join.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await gateway.handleJoinDashboard(mockSocket);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error joining dashboard:',
        error,
      );
      expect(result).toEqual({
        success: false,
        error: 'Failed to join dashboard',
      });

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleLeaveDashboard', () => {
    it('should handle leave dashboard', async () => {
      const result = await gateway.handleLeaveDashboard(mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('dashboard');
      expect(result).toEqual({ success: true, message: 'Left dashboard room' });
    });
  });

  describe('broadcastToConversation', () => {
    it('should broadcast to conversation', () => {
      const conversationId = 'conv-123';
      const event = 'test_event';
      const data = { message: 'test' };

      gateway.broadcastToConversation(conversationId, event, data);

      expect(mockServer.to).toHaveBeenCalledWith(conversationId);
      expect(mockServer.emit).toHaveBeenCalledWith(event, data);
    });
  });

  describe('broadcastToDashboard', () => {
    it('should broadcast to dashboard', () => {
      const event = 'dashboard_event';
      const data = { stats: 'test' };

      gateway.broadcastToDashboard(event, data);

      expect(mockServer.to).toHaveBeenCalledWith('dashboard');
      expect(mockServer.emit).toHaveBeenCalledWith(event, data);
    });
  });
});
