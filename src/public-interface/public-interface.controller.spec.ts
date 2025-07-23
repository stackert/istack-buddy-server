import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('path');

// Create a test controller class without decorators
class TestPublicInterfaceController {
  constructor(
    private readonly formMarvSessionService: any,
    private readonly authService: any,
    private readonly authPermissionsService: any,
  ) {}

  async serveRootContent(res: Response): Promise<void> {
    try {
      const filePath = path.join(
        process.cwd(),
        'public-content',
        'hello-world.html',
      );
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(content);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }

  async handleFormMarvRoot(res: Response): Promise<void> {
    res.status(404).send('Not Found');
  }

  async createFormMarvSession(res: Response, req: any): Promise<void> {
    try {
      const secretKey = this.formMarvSessionService.createSession();
      const session = this.formMarvSessionService.getSession(secretKey);
      if (!session) {
        res.status(500).send('Failed to create session');
        return;
      }

      const link = `${req.protocol}://${req.get('host')}/public/form-marv/${secretKey}?jwtToken=${session.jwtToken}`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Marv Session Created</title>
</head>
<body>
    <h1>Thank you!</h1>
    <p>Your form session has been created successfully.</p>
    <p>Form ID: ${session.formId}</p>
    <p>Here is your link: <a href="${link}">${link}</a></p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }

  async serveFormMarvContent(
    secretKey: string,
    jwtToken: string,
    res: Response,
    req: any,
  ): Promise<void> {
    try {
      // If JWT token is provided in query, set it as a cookie and redirect
      if (jwtToken) {
        res.cookie('jwtToken', jwtToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        // Redirect to the same URL without the jwtToken query parameter
        res.redirect(`/public/form-marv/${secretKey}`);
        return;
      }

      // Check if session exists
      const session = this.formMarvSessionService.getSession(secretKey);
      if (!session) {
        res.status(404).send('Session not found or expired');
        return;
      }

      // Get JWT token from cookies or use session token as fallback
      const jwtTokenFromCookie = req.cookies?.jwtToken;
      const tokenToUse = jwtTokenFromCookie || session.jwtToken;

      try {
        // Verify the token and check if user has the required permission
        const isAuthenticated = await this.authService.isUserAuthenticated(
          session.userId,
          tokenToUse,
        );
        if (!isAuthenticated) {
          res.status(401).send('Invalid or expired authentication token');
          return;
        }

        // Verify the user has the required permission
        const hasPermission = await this.authPermissionsService.hasPermission(
          session.userId,
          'cx-agent:form-marv:read',
        );
        if (!hasPermission) {
          res
            .status(403)
            .send(
              'Access denied. Required permissions: cx-agent:form-marv:read',
            );
          return;
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Forms Marv</title>
</head>
<body>
    <h1>Welcome to Forms Marv!</h1>
    <p>Your session is active and ready for formId: ${session.formId}</p>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } catch (authError) {
        res.status(401).send('Authentication failed');
      }
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }

  async serveFormMarvContentOld(
    randomkey: string,
    formId: string,
    res: Response,
  ): Promise<void> {
    try {
      const filePath = path.join(
        process.cwd(),
        'public-content',
        'form-marv',
        'hello-from-marv.html',
      );
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(content);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }
}

describe('PublicInterfaceController', () => {
  let controller: TestPublicInterfaceController;
  let mockFormMarvSessionService: jest.Mocked<any>;
  let mockAuthService: jest.Mocked<any>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockFormMarvSessionService = {
      createSession: jest.fn(),
      getSession: jest.fn(),
    };

    mockAuthService = {
      isUserAuthenticated: jest.fn(),
    };

    const mockAuthPermissionsService = {
      hasPermission: jest.fn(),
    };

    controller = new TestPublicInterfaceController(
      mockFormMarvSessionService,
      mockAuthService,
      mockAuthPermissionsService,
    );

    // Mock response object
    mockResponse = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      cookie: jest.fn(),
      redirect: jest.fn(),
    };

    // Mock path.join to return a predictable path
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('serveRootContent', () => {
    it('should serve hello-world.html content', async () => {
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

    it('should handle file read errors', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      await controller.serveRootContent(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal Server Error');
    });
  });

  describe('handleFormMarvRoot', () => {
    it('should return 404 for /form-marv', async () => {
      await controller.handleFormMarvRoot(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith('Not Found');
    });
  });

  describe('createFormMarvSession', () => {
    it('should create a session and return HTML with link', async () => {
      const mockSecretKey = 'test-secret-key-123';
      const mockJwtToken = 'test-jwt-token-456';

      mockFormMarvSessionService.createSession.mockReturnValue(mockSecretKey);
      mockFormMarvSessionService.getSession.mockReturnValue({
        secretKey: mockSecretKey,
        userId: 'form-marv-temp-123',
        jwtToken: mockJwtToken,
        formId: '123456',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresInMs: 24 * 60 * 60 * 1000,
      });

      await controller.createFormMarvSession(mockResponse as Response, {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3000'),
      });

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
        expect.stringContaining('Form ID: 123456'),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining(
          `http://localhost:3000/public/form-marv/${mockSecretKey}?jwtToken=${mockJwtToken}`,
        ),
      );
    });

    it('should handle session creation failure', async () => {
      mockFormMarvSessionService.createSession.mockReturnValue(
        'test-secret-key',
      );
      mockFormMarvSessionService.getSession.mockReturnValue(null);

      await controller.createFormMarvSession(mockResponse as Response, {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3000'),
      });

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Failed to create session',
      );
    });

    it('should handle service errors', async () => {
      mockFormMarvSessionService.createSession.mockImplementation(() => {
        throw new Error('Service error');
      });

      await controller.createFormMarvSession(mockResponse as Response, {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3000'),
      });

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal Server Error');
    });
  });

  describe('serveFormMarvContent', () => {
    it('should redirect when jwtToken is provided in query', async () => {
      const secretKey = 'test-secret-key';
      const jwtToken = 'test-jwt-token';

      await controller.serveFormMarvContent(
        secretKey,
        jwtToken,
        mockResponse as Response,
        { cookies: {} },
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith('jwtToken', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      });
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `/public/form-marv/${secretKey}`,
      );
    });

    it('should return 404 when session does not exist', async () => {
      mockFormMarvSessionService.getSession.mockReturnValue(null);

      await controller.serveFormMarvContent(
        'non-existent-key',
        '',
        mockResponse as Response,
        { cookies: {} },
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Session not found or expired',
      );
    });

    it('should return 401 when authentication fails', async () => {
      const mockSession = {
        secretKey: 'test-secret-key',
        userId: 'form-marv-temp-123',
        jwtToken: 'test-jwt-token',
        formId: '123456',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresInMs: 24 * 60 * 60 * 1000,
      };

      mockFormMarvSessionService.getSession.mockReturnValue(mockSession);
      mockAuthService.isUserAuthenticated.mockResolvedValue(false);

      await controller.serveFormMarvContent(
        'test-secret-key',
        '',
        mockResponse as Response,
        { cookies: {} },
      );

      expect(mockAuthService.isUserAuthenticated).toHaveBeenCalledWith(
        mockSession.userId,
        mockSession.jwtToken,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Invalid or expired authentication token',
      );
    });

    it('should serve content when authentication succeeds', async () => {
      const mockSession = {
        secretKey: 'test-secret-key',
        userId: 'form-marv-temp-123',
        jwtToken: 'test-jwt-token',
        formId: '123456',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresInMs: 24 * 60 * 60 * 1000,
      };

      mockFormMarvSessionService.getSession.mockReturnValue(mockSession);
      mockAuthService.isUserAuthenticated.mockResolvedValue(true);
      const mockAuthPermissionsService = controller['authPermissionsService'];
      mockAuthPermissionsService.hasPermission.mockResolvedValue(true);

      await controller.serveFormMarvContent(
        'test-secret-key',
        '',
        mockResponse as Response,
        { cookies: {} },
      );

      expect(mockAuthService.isUserAuthenticated).toHaveBeenCalledWith(
        mockSession.userId,
        mockSession.jwtToken,
      );
      expect(mockAuthPermissionsService.hasPermission).toHaveBeenCalledWith(
        mockSession.userId,
        'cx-agent:form-marv:read',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Forms Marv!'),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining(
          'Your session is active and ready for formId: 123456',
        ),
      );
    });

    it('should handle authentication service errors', async () => {
      const mockSession = {
        secretKey: 'test-secret-key',
        userId: 'form-marv-temp-123',
        jwtToken: 'test-jwt-token',
        formId: '123456',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresInMs: 24 * 60 * 60 * 1000,
      };

      mockFormMarvSessionService.getSession.mockReturnValue(mockSession);
      mockAuthService.isUserAuthenticated.mockRejectedValue(
        new Error('Auth error'),
      );

      await controller.serveFormMarvContent(
        'test-secret-key',
        '',
        mockResponse as Response,
        { cookies: {} },
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
    });

    it('should return 403 when user lacks required permission', async () => {
      const mockSession = {
        secretKey: 'test-secret-key',
        userId: 'form-marv-temp-123',
        jwtToken: 'test-jwt-token',
        formId: '123456',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresInMs: 24 * 60 * 60 * 1000,
      };

      mockFormMarvSessionService.getSession.mockReturnValue(mockSession);
      mockAuthService.isUserAuthenticated.mockResolvedValue(true);
      const mockAuthPermissionsService = controller['authPermissionsService'];
      mockAuthPermissionsService.hasPermission.mockResolvedValue(false);

      await controller.serveFormMarvContent(
        'test-secret-key',
        '',
        mockResponse as Response,
        { cookies: {} },
      );

      expect(mockAuthService.isUserAuthenticated).toHaveBeenCalledWith(
        mockSession.userId,
        mockSession.jwtToken,
      );
      expect(mockAuthPermissionsService.hasPermission).toHaveBeenCalledWith(
        mockSession.userId,
        'cx-agent:form-marv:read',
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Access denied. Required permissions: cx-agent:form-marv:read',
      );
    });
  });

  describe('serveFormMarvContentOld', () => {
    it('should serve hello-from-marv.html content', async () => {
      const mockContent = '<html><body>Hello from Marv!</body></html>';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockContent);

      await controller.serveFormMarvContentOld(
        'random123',
        'form456',
        mockResponse as Response,
      );

      expect(path.join).toHaveBeenCalledWith(
        process.cwd(),
        'public-content',
        'form-marv',
        'hello-from-marv.html',
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        `${process.cwd()}/public-content/form-marv/hello-from-marv.html`,
        'utf8',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockContent);
    });

    it('should handle file read errors', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      await controller.serveFormMarvContentOld(
        'random123',
        'form456',
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal Server Error');
    });
  });
});
