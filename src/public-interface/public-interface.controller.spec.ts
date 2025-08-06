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
      cookies: {},
    };

    // Mock path.join
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('serveRootContent', () => {
    it('should serve hello-world.html content successfully', async () => {
      const mockContent = '<html><body>Hello World!</body></html>';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockContent);

      await controller.serveRootContent(mockResponse as Response);

      expect(path.join).toHaveBeenCalledWith(
        process.cwd(),
        'public-content',
        'hello-world.html',
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        `${process.cwd()}/public-content/hello-world.html`,
        'utf8',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockContent);
    });

    it('should handle file read errors and return 500', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      await controller.serveRootContent(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal Server Error');
    });
  });

  describe('handleFormMarvRoot', () => {
    it('should return 404 for /form-marv root path', async () => {
      await controller.handleFormMarvRoot(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith('Not Found');
    });
  });

  describe('createFormMarvSession', () => {
    it('should create a session and return HTML with correct link format', async () => {
      const mockSecretKey = 'test-secret-key-123';
      const mockJwtToken = 'test-jwt-token-456';
      const mockFormId = '123456';

      mockFormMarvSessionService.createSession.mockReturnValue(mockSecretKey);
      mockFormMarvSessionService.getSession.mockReturnValue({
        secretKey: mockSecretKey,
        userId: 'form-marv-temp-123',
        jwtToken: mockJwtToken,
        formId: mockFormId,
        conversationId: 'test-conversation-id',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresInMs: 24 * 60 * 60 * 1000,
      });

      await controller.createFormMarvSession(
        mockResponse as Response,
        mockRequest,
      );

      expect(mockFormMarvSessionService.createSession).toHaveBeenCalled();
      expect(mockFormMarvSessionService.getSession).toHaveBeenCalledWith(
        mockSecretKey,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Thank you!'),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining(
          'Your form session has been created successfully',
        ),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining(`Form ID: ${mockFormId}`),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining(
          `/public/form-marv/${mockSecretKey}/${mockFormId}?jwtToken=${mockJwtToken}`,
        ),
      );
    });

    it('should handle session creation failure', async () => {
      mockFormMarvSessionService.createSession.mockReturnValue(
        'test-secret-key',
      );
      mockFormMarvSessionService.getSession.mockReturnValue(null);

      await controller.createFormMarvSession(
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Failed to create session',
      );
    });

    it('should handle service errors during session creation', async () => {
      mockFormMarvSessionService.createSession.mockImplementation(() => {
        throw new Error('Service error');
      });

      await controller.createFormMarvSession(
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal Server Error');
    });
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

    it('should redirect when jwtToken is provided in query', async () => {
      const secretKey = 'test-secret-key';
      const formId = '123456';
      const jwtToken = 'test-jwt-token';

      await controller.serveFormMarvContentWithFormId(
        secretKey,
        formId,
        jwtToken,
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith('jwtToken', jwtToken, {
        httpOnly: true,
        secure: false, // NODE_ENV is not 'production' in tests
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      });
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `/public/form-marv/${secretKey}/${formId}`,
      );
    });

    it('should return 404 when session does not exist', async () => {
      mockFormMarvSessionService.getSession.mockReturnValue(null);

      await controller.serveFormMarvContentWithFormId(
        'test-secret-key',
        '123456',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Session not found or expired',
      );
    });

    it('should return 401 when formId does not match session formId', async () => {
      mockFormMarvSessionService.getSession.mockReturnValue(mockSession);

      await controller.serveFormMarvContentWithFormId(
        'test-secret-key',
        'wrong-form-id',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Invalid form ID for this session',
      );
    });

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

    it('should handle general errors and return 500', async () => {
      mockFormMarvSessionService.getSession.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await controller.serveFormMarvContentWithFormId(
        'test-secret-key',
        '123456',
        '',
        mockResponse as Response,
        mockRequest,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal Server Error');
    });

    it('should handle production environment for secure cookies', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await controller.serveFormMarvContentWithFormId(
          'test-secret-key',
          '123456',
          'test-jwt-token',
          mockResponse as Response,
          mockRequest,
        );

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          'jwtToken',
          'test-jwt-token',
          {
            httpOnly: true,
            secure: true, // Should be true in production
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000,
          },
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
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
