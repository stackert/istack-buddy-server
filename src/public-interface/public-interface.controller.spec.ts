import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { PublicInterfaceController } from './public-interface.controller';
import { FormMarvSessionService } from './form-marv-session.service';
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
  let mockFormMarvSessionService: jest.Mocked<FormMarvSessionService>;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockAuthPermissionsService: jest.Mocked<AuthorizationPermissionsService>;
  let mockResponse: Partial<Response>;
  let mockRequest: any;

  beforeEach(async () => {
    // Create mock services
    mockFormMarvSessionService = {
      createSession: jest.fn(),
      getSession: jest.fn(),
    } as any;

    mockAuthService = {
      isUserAuthenticated: jest.fn(),
      authenticateUser: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    mockAuthPermissionsService = {
      hasPermission: jest.fn(),
    } as any;

    // Create mock guard
    const mockGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const mockChatManagerService = {
      createMessage: jest.fn(),
      joinConversation: jest.fn(),
      leaveConversation: jest.fn(),
      getLastMessages: jest.fn(),
      setGateway: jest.fn(),
      getMessages: jest.fn().mockResolvedValue([]),
      addMessage: jest.fn().mockResolvedValue({ id: 'msg_123_abc123def' }),
      validateConversationFormId: jest.fn().mockReturnValue(true),
      getConversations: jest
        .fn()
        .mockResolvedValue([{ id: 'test-secret-key', formId: '123456' }]),
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
    };

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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicInterfaceController],
      providers: [
        {
          provide: FormMarvSessionService,
          useValue: mockFormMarvSessionService,
        },
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
  });

  describe('serveFormMarvContent (secretKey only - should return 401)', () => {
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

    it('should serve content when session and formId are valid', async () => {
      mockFormMarvSessionService.getSession.mockReturnValue(mockSession);

      await controller.serveFormMarvContentWithFormId(
        'test-secret-key',
        '123456',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Forms Marv!'),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('123456'),
      );
    });
  });

  describe('getChatMessages', () => {
    it('should return empty array', async () => {
      const result = await controller.getChatMessages(
        'test-secret-key',
        '123456',
        mockRequest,
        undefined,
      );

      expect(result).toEqual([]);
    });

    it('should return empty array with dtSinceMs parameter', async () => {
      const result = await controller.getChatMessages(
        'test-secret-key',
        '123456',
        mockRequest,
        '1640995200000',
      );

      expect(result).toEqual([]);
    });
  });

  describe('postChatMessage', () => {
    const mockMessageData = { message: 'Hello, world!', type: 'user' };

    it('should return success response', async () => {
      const result = await controller.postChatMessage(
        'test-secret-key',
        '123456',
        mockMessageData,
        mockRequest,
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^msg_\d+_[a-z0-9]{9}$/);
    });
  });
});
