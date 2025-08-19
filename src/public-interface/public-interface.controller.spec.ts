import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { PublicInterfaceController } from './public-interface.controller';
import { AuthenticationService } from '../authentication/authentication.service';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { Reflector } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotService } from '../robots/robot.service';
import { UserProfileService } from '../user-profile/user-profile.service';
import * as jwt from 'jsonwebtoken';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');

// Mock fs.readFileSync to return valid HTML content
(fs.readFileSync as jest.Mock).mockReturnValue(`
<!DOCTYPE html>
<html>
<head>
    <title>Forms Marv</title>
</head>
<body>
    <h1>Welcome to Forms Marv!</h1>
    <p>Form ID: 123456</p>
</body>
</html>
`);

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'test-user' }),
}));

describe('PublicInterfaceController', () => {
  let controller: PublicInterfaceController;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockAuthPermissionsService: jest.Mocked<AuthorizationPermissionsService>;
  let mockChatManagerService: jest.Mocked<ChatManagerService>;
  let mockResponse: Partial<Response>;
  let mockRequest: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Store original environment
    originalEnv = process.env;
    process.env = { ...originalEnv };

    mockAuthService = {
      isUserAuthenticated: jest.fn(),
      authenticateUser: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    mockAuthPermissionsService = {
      hasPermission: jest.fn(),
    } as any;

    mockChatManagerService = {
      createMessage: jest.fn(),
      joinConversation: jest.fn(),
      leaveConversation: jest.fn(),
      getLastMessages: jest.fn(),
      setGateway: jest.fn(),
      getMessages: jest.fn().mockResolvedValue([]),
      addMessage: jest.fn().mockResolvedValue({ id: 'msg_123_abc123def' }),
      addMessageFromMarvSession: jest
        .fn()
        .mockResolvedValue({ id: 'msg_123_abc123def' }),
      validateConversationFormId: jest.fn().mockReturnValue(true),
      getConversations: jest
        .fn()
        .mockResolvedValue([{ id: 'test-conversation-id', formId: '123456' }]),
      createConversationCallbacks: jest.fn().mockReturnValue({
        onStreamChunkReceived: jest.fn(),
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      }),
      handleRobotStreamingResponse: jest.fn().mockResolvedValue(undefined),
      getGateway: jest.fn().mockReturnValue({
        broadcastToConversation: jest.fn(),
      }),
    } as any;

    const mockRobotService = {
      getRobotByName: jest.fn(),
      processMessage: jest.fn(),
      getAllRobots: jest.fn(),
      hasRobot: jest.fn(),
      getRobotsByClass: jest.fn(),
      registerRobot: jest.fn(),
      unregisterRobot: jest.fn(),
    };

    const mockUserProfileService = {
      getUserProfile: jest.fn(),
      createUserProfile: jest.fn(),
      updateUserProfile: jest.fn(),
    };

    // Create mock guard
    const mockGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicInterfaceController],
      providers: [
        {
          provide: AuthenticationService,
          useValue: mockAuthService,
        },
        {
          provide: AuthorizationPermissionsService,
          useValue: mockAuthPermissionsService,
        },
        {
          provide: ChatManagerService,
          useValue: mockChatManagerService,
        },
        {
          provide: RobotService,
          useValue: mockRobotService,
        },
        {
          provide: UserProfileService,
          useValue: mockUserProfileService,
        },
        {
          provide: CustomLoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
            getAll: jest.fn(),
            getAllAndOverride: jest.fn(),
            getAllAndMerge: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthPermissionGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<PublicInterfaceController>(
      PublicInterfaceController,
    );

    // Mock response object
    mockResponse = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      cookie: jest.fn(),
      redirect: jest.fn(),
    };

    // Mock request object
    mockRequest = {
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:3000'),
      cookies: { jwtToken: 'valid-jwt-token' },
    };

    // Mock path.join
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  describe('getBaseUrl', () => {
    it('should return NGROK_URL when available', () => {
      process.env.NGROK_URL = 'https://abc123.ngrok.io';

      const result = (controller as any).getBaseUrl();

      expect(result).toBe('https://abc123.ngrok.io');
    });

    it('should remove trailing slash from NGROK_URL', () => {
      process.env.NGROK_URL = 'https://abc123.ngrok.io/';

      const result = (controller as any).getBaseUrl();

      expect(result).toBe('https://abc123.ngrok.io');
    });

    it('should return ISTACK_BUDDY_FRONT_END_HOST when NGROK_URL is not available', () => {
      delete process.env.NGROK_URL;
      process.env.ISTACK_BUDDY_FRONT_END_HOST = 'https://example.com';

      const result = (controller as any).getBaseUrl();

      expect(result).toBe('https://example.com');
    });

    it('should remove trailing slash from ISTACK_BUDDY_FRONT_END_HOST', () => {
      delete process.env.NGROK_URL;
      process.env.ISTACK_BUDDY_FRONT_END_HOST = 'https://example.com/';

      const result = (controller as any).getBaseUrl();

      expect(result).toBe('https://example.com');
    });

    it('should return empty string when no environment variables are set', () => {
      delete process.env.NGROK_URL;
      delete process.env.ISTACK_BUDDY_FRONT_END_HOST;

      const result = (controller as any).getBaseUrl();

      expect(result).toBe('');
    });
  });

  describe('serveRootContent', () => {
    it('should serve HTML content with proper headers', async () => {
      await controller.serveRootContent(mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('iStackBuddy Public Interface'),
      );
    });
  });

  describe('handleFormMarvRoot', () => {
    it('should return 404 with form ID required message', async () => {
      await controller.handleFormMarvRoot(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Form ID is required in the URL path',
      );
    });
  });

  describe('serveFormMarvContent', () => {
    it('should return 401 when formId is required in URL path', async () => {
      await controller.serveFormMarvContent(
        'test-secret-key',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Form ID is required in the URL path',
      );
    });
  });

  describe('serveFormMarvContentWithFormId', () => {
    const mockSession = {
      secretKey: 'test-secret-key',
      userId: 'form-marv-temp-123',
      jwtToken: 'test-jwt-token',
      formId: '123456',
      conversationId: 'test-conversation-id',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresInMs: 24 * 60 * 60 * 1000,
    };

    beforeEach(() => {
      mockChatManagerService.getConversations.mockResolvedValue([
        { id: 'test-conversation-id', formId: '123456' } as any,
      ]);
    });

    it('should handle JWT token in query parameter', async () => {
      const jwtToken = 'valid-jwt-token';
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'test-user' });
      mockAuthService.authenticateUser.mockResolvedValue({ success: true });

      await controller.serveFormMarvContentWithFormId(
        'test-conversation-id',
        '123456',
        jwtToken,
        mockResponse as Response,
        mockRequest,
      );

      expect(jwt.verify).toHaveBeenCalledWith(
        jwtToken,
        'istack-buddy-secret-key-2024',
      );
      expect(mockAuthService.authenticateUser).toHaveBeenCalledWith(
        'test-user',
        jwtToken,
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'jwtToken',
        jwtToken,
        expect.any(Object),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        '/public/form-marv/test-conversation-id/123456',
      );
    });

    it('should handle JWT authentication failure', async () => {
      const jwtToken = 'invalid-jwt-token';
      mockAuthService.authenticateUser.mockResolvedValue({ success: false });

      await controller.serveFormMarvContentWithFormId(
        'test-conversation-id',
        '123456',
        jwtToken,
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid JWT token');
    });

    it('should handle JWT verification error', async () => {
      const jwtToken = 'invalid-jwt-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await controller.serveFormMarvContentWithFormId(
        'test-conversation-id',
        '123456',
        jwtToken,
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid JWT token');
    });

    it('should handle missing JWT token in cookie', async () => {
      mockRequest.cookies = {};

      await controller.serveFormMarvContentWithFormId(
        'test-conversation-id',
        '123456',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Authentication required - JWT token not found in cookie',
      );
    });

    it('should handle invalid JWT token in cookie', async () => {
      mockAuthService.authenticateUser.mockResolvedValue({ success: false });

      await controller.serveFormMarvContentWithFormId(
        'test-conversation-id',
        '123456',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Invalid JWT token in cookie',
      );
    });

    it('should handle JWT verification error from cookie', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await controller.serveFormMarvContentWithFormId(
        'test-conversation-id',
        '123456',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Invalid JWT token in cookie',
      );
    });

    it('should handle conversation not found', async () => {
      mockChatManagerService.getConversations.mockResolvedValue([]);
      // Ensure JWT verification passes for this test
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'test-user' });
      mockAuthService.authenticateUser.mockResolvedValue({ success: true });

      await controller.serveFormMarvContentWithFormId(
        'non-existent-conversation',
        '123456',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith('Session not found');
    });

    it('should serve static content successfully', async () => {
      // Ensure JWT verification passes for this test
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'test-user' });
      mockAuthService.authenticateUser.mockResolvedValue({ success: true });

      await controller.serveFormMarvContentWithFormId(
        'test-conversation-id',
        '123456',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-store, must-revalidate',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Expires', '0');
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Forms Marv!'),
      );
    });
  });

  describe('getChatMessages', () => {
    it('should return messages when validation passes', async () => {
      const mockMessages = [
        {
          id: 'msg1',
          conversationId: 'test-conversation-id',
          authorUserId: 'user1',
          fromRole: 'cx-customer',
          toRole: 'cx-agent',
          messageType: 'text',
          content: { type: 'text/plain', payload: 'Hello' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'msg2',
          conversationId: 'test-conversation-id',
          authorUserId: 'user1',
          fromRole: 'cx-customer',
          toRole: 'cx-agent',
          messageType: 'text',
          content: { type: 'text/plain', payload: 'World' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any;
      mockChatManagerService.getMessages.mockResolvedValue(mockMessages);

      const result = await controller.getChatMessages(
        'test-conversation-id',
        '123456',
        mockRequest,
        undefined,
      );

      expect(result).toEqual(mockMessages);
      expect(mockChatManagerService.getMessages).toHaveBeenCalledWith(
        'test-conversation-id',
        {
          limit: 100,
          offset: 0,
        },
      );
    });

    it('should return empty array when validation fails', async () => {
      mockChatManagerService.validateConversationFormId.mockReturnValue(false);

      const result = await controller.getChatMessages(
        'test-conversation-id',
        '123456',
        mockRequest,
        undefined,
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when error occurs', async () => {
      mockChatManagerService.getMessages.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await controller.getChatMessages(
        'test-conversation-id',
        '123456',
        mockRequest,
        undefined,
      );

      expect(result).toEqual([]);
    });

    it('should return empty array with dtSinceMs parameter', async () => {
      const result = await controller.getChatMessages(
        'test-conversation-id',
        '123456',
        mockRequest,
        '1640995200000',
      );

      expect(result).toEqual([]);
    });
  });

  describe('postChatMessage', () => {
    const mockMessageData = { message: 'Hello, world!', type: 'user' };

    it('should return success response when validation passes', async () => {
      const result = await controller.postChatMessage(
        'test-conversation-id',
        '123456',
        mockMessageData,
        mockRequest,
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_123_abc123def');
      expect(
        mockChatManagerService.addMessageFromMarvSession,
      ).toHaveBeenCalledWith('test-conversation-id', {
        type: 'text',
        payload: 'Hello, world!',
      });
    });

    it('should handle message content from content field', async () => {
      const messageData = { content: 'Test content', type: 'user' };

      await controller.postChatMessage(
        'test-conversation-id',
        '123456',
        messageData,
        mockRequest,
      );

      expect(
        mockChatManagerService.addMessageFromMarvSession,
      ).toHaveBeenCalledWith('test-conversation-id', {
        type: 'text',
        payload: 'Test content',
      });
    });

    it('should return failure response when validation fails', async () => {
      mockChatManagerService.validateConversationFormId.mockReturnValue(false);

      const result = await controller.postChatMessage(
        'test-conversation-id',
        '123456',
        mockMessageData,
        mockRequest,
      );

      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
    });

    it('should return failure response when error occurs', async () => {
      mockChatManagerService.addMessageFromMarvSession.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await controller.postChatMessage(
        'test-conversation-id',
        '123456',
        mockMessageData,
        mockRequest,
      );

      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
    });
  });
});
