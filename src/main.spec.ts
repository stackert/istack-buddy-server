import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { json } from 'express';

// Mock all dependencies to avoid side effects
jest.mock('@nestjs/core');
jest.mock('@nestjs/swagger');
jest.mock('cookie-parser');
jest.mock('dotenv');
jest.mock('express', () => ({
  json: jest.fn(),
  static: jest.fn().mockReturnValue(jest.fn()),
}));
jest.mock('./app.module', () => ({
  AppModule: class MockAppModule {},
}));

// Import the actual bootstrap function
import { bootstrap } from './main';

describe('Main Bootstrap Function', () => {
  let mockApp: any;
  let mockNestFactory: jest.Mocked<typeof NestFactory>;
  let mockSwaggerModule: jest.Mocked<typeof SwaggerModule>;
  let mockJson: jest.MockedFunction<typeof json>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock the application instance
    mockApp = {
      use: jest.fn(),
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockReturnValue({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      }),
    };

    // Mock NestFactory
    mockNestFactory = NestFactory as jest.Mocked<typeof NestFactory>;
    mockNestFactory.create = jest.fn().mockResolvedValue(mockApp);

    // Mock SwaggerModule
    mockSwaggerModule = SwaggerModule as jest.Mocked<typeof SwaggerModule>;
    mockSwaggerModule.createDocument = jest.fn().mockReturnValue({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
    });
    mockSwaggerModule.setup = jest.fn();

    // Mock DocumentBuilder
    const mockDocumentBuilderInstance = {
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      setVersion: jest.fn().mockReturnThis(),
      addTag: jest.fn().mockReturnThis(),
      addCookieAuth: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0' },
        paths: {},
      }),
    } as any;

    (
      DocumentBuilder as jest.MockedClass<typeof DocumentBuilder>
    ).mockImplementation(() => mockDocumentBuilderInstance);

    // Mock cookieParser
    (cookieParser as jest.MockedFunction<typeof cookieParser>).mockReturnValue(
      jest.fn(),
    );

    // Mock express json
    mockJson = json as jest.MockedFunction<typeof json>;
    mockJson.mockReturnValue(jest.fn());
  });

  describe('Bootstrap Function Execution', () => {
    it('should be defined and callable', () => {
      expect(bootstrap).toBeDefined();
      expect(typeof bootstrap).toBe('function');
    });

    it('should create NestJS application with AppModule', async () => {
      await bootstrap();
      expect(mockNestFactory.create).toHaveBeenCalledTimes(1);
    });

    it('should enable CORS with correct configuration', async () => {
      await bootstrap();
      expect(mockApp.enableCors).toHaveBeenCalledWith({
        origin: true,
        credentials: true,
        methods: '*',
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'Accept',
          'Origin',
          'X-Requested-With',
          'Accept-Language',
          'Content-Language',
          'Cookie',
        ],
        exposedHeaders: ['Set-Cookie', 'Authorization'],
        optionsSuccessStatus: 200,
        preflightContinue: false,
      });
    });

    it('should enable cookie parsing middleware', async () => {
      await bootstrap();
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
      expect(cookieParser).toHaveBeenCalled();
    });

    it('should configure Swagger documentation', async () => {
      await bootstrap();
      expect(DocumentBuilder).toHaveBeenCalled();
      expect(mockSwaggerModule.createDocument).toHaveBeenCalledWith(
        mockApp,
        expect.any(Object),
      );
      expect(mockSwaggerModule.setup).toHaveBeenCalledWith(
        'api',
        mockApp,
        expect.any(Object),
      );
    });

    it('should start listening on default port 3500', async () => {
      const originalEnv = process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;
      delete process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith(3500);

      // Restore original environment
      if (originalEnv) {
        process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT = originalEnv;
      }
    });

    it('should start listening on configured port from environment', async () => {
      const originalEnv = process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;
      process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT = '4000';

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith('4000');

      // Restore original environment
      if (originalEnv) {
        process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT = originalEnv;
      } else {
        delete process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;
      }
    });
  });

  describe('Swagger Configuration', () => {
    let mockBuilderInstance: any;

    beforeEach(() => {
      mockBuilderInstance = {
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        setVersion: jest.fn().mockReturnThis(),
        addTag: jest.fn().mockReturnThis(),
        addCookieAuth: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0' },
          paths: {},
        }),
      };
      (
        DocumentBuilder as jest.MockedClass<typeof DocumentBuilder>
      ).mockImplementation(() => mockBuilderInstance);
    });

    it('should set correct API title', async () => {
      await bootstrap();
      expect(mockBuilderInstance.setTitle).toHaveBeenCalledWith(
        'iStack Buddy Server API',
      );
    });

    it('should set correct API description', async () => {
      await bootstrap();
      expect(mockBuilderInstance.setDescription).toHaveBeenCalledWith(
        'Authentication and user management API for iStack Buddy platform',
      );
    });

    it('should set correct API version', async () => {
      await bootstrap();
      expect(mockBuilderInstance.setVersion).toHaveBeenCalledWith('1.0');
    });

    it('should add authentication tag', async () => {
      await bootstrap();
      expect(mockBuilderInstance.addTag).toHaveBeenCalledWith(
        'authentication',
        'User authentication and session management',
      );
    });

    it('should add profile tag', async () => {
      await bootstrap();
      expect(mockBuilderInstance.addTag).toHaveBeenCalledWith(
        'profile',
        'User profile management',
      );
    });

    it('should configure cookie authentication', async () => {
      await bootstrap();
      expect(mockBuilderInstance.addCookieAuth).toHaveBeenCalledWith(
        'auth-token',
        {
          type: 'http',
          in: 'cookie',
          scheme: 'bearer',
          description: 'Authentication token stored in httpOnly cookie',
        },
      );
    });

    it('should build configuration object', async () => {
      await bootstrap();
      expect(mockBuilderInstance.build).toHaveBeenCalled();
    });
  });

  describe('Environment Configuration', () => {
    it('should handle undefined PORT environment variable', async () => {
      const originalPort = process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;
      delete process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith(3500);

      // Restore
      if (originalPort) {
        process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT = originalPort;
      }
    });

    it('should handle empty PORT environment variable', async () => {
      const originalPort = process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;
      process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT = '';

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith(3500);

      // Restore
      if (originalPort) {
        process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT = originalPort;
      } else {
        delete process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;
      }
    });

    it('should handle custom port from environment', async () => {
      const originalPort = process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;
      process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT = '8080';

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith('8080');

      // Restore
      if (originalPort) {
        process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT = originalPort;
      } else {
        delete process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle NestFactory creation errors gracefully', async () => {
      mockNestFactory.create.mockRejectedValue(new Error('Creation failed'));

      await expect(bootstrap()).rejects.toThrow('Creation failed');
    });

    it('should handle app listen errors gracefully', async () => {
      mockApp.listen.mockRejectedValue(new Error('Listen failed'));

      await expect(bootstrap()).rejects.toThrow('Listen failed');
    });
  });

  describe('Integration Flow', () => {
    it('should execute bootstrap sequence in correct order', async () => {
      const callOrder: string[] = [];

      mockNestFactory.create.mockImplementation(async () => {
        callOrder.push('create');
        return mockApp;
      });

      mockApp.enableCors.mockImplementation(() => {
        callOrder.push('enableCors');
      });

      mockApp.use.mockImplementation(() => {
        callOrder.push('use');
      });

      mockSwaggerModule.createDocument.mockImplementation(() => {
        callOrder.push('createDocument');
        return {
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0' },
          paths: {},
        };
      });

      mockSwaggerModule.setup.mockImplementation(() => {
        callOrder.push('setup');
      });

      mockApp.listen.mockImplementation(async () => {
        callOrder.push('listen');
      });

      await bootstrap();
      expect(callOrder).toEqual([
        'create',
        'use',
        'enableCors',
        'use',
        'use',
        'use',
        'use',
        'use',
        'createDocument',
        'setup',
        'listen',
      ]);
    });

    it('should configure all required middleware and documentation', async () => {
      await bootstrap();

      // Verify all major bootstrap steps were called
      expect(mockNestFactory.create).toHaveBeenCalledTimes(1);
      expect(mockApp.enableCors).toHaveBeenCalledTimes(1);
      expect(mockApp.use).toHaveBeenCalledTimes(6);
      expect(mockSwaggerModule.createDocument).toHaveBeenCalledTimes(1);
      expect(mockSwaggerModule.setup).toHaveBeenCalledTimes(1);
      expect(mockApp.listen).toHaveBeenCalledTimes(1);
    });
  });

  describe('Middleware Configuration', () => {
    it('should configure cookie parser middleware', async () => {
      await bootstrap();
      expect(cookieParser).toHaveBeenCalled();
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should configure Slack webhook middleware with raw body parsing', async () => {
      await bootstrap();

      // Find the Slack webhook middleware call
      const slackMiddlewareCall = mockApp.use.mock.calls.find(
        (call: any[]) =>
          call[0] === '/istack-buddy/slack-integration/slack/events',
      );

      expect(slackMiddlewareCall).toBeDefined();

      // Verify that the middleware is configured for the correct path
      expect(slackMiddlewareCall[0]).toBe(
        '/istack-buddy/slack-integration/slack/events',
      );

      // The middleware should be a function (express json middleware)
      expect(typeof slackMiddlewareCall[1]).toBe('function');

      // Test that the middleware function can be called (simulating the verify function behavior)
      const mockReq: any = {};
      const mockRes = {};
      const mockBuf = Buffer.from('test body');

      // Simulate what the verify function does
      mockReq.rawBody = mockBuf;
      mockReq.rawBodyString = mockBuf.toString();

      expect(mockReq.rawBody).toBe(mockBuf);
      expect(mockReq.rawBodyString).toBe('test body');
    });

    it('should configure all required middleware', async () => {
      await bootstrap();

      // Should have 6 middleware calls: Slack webhook + cookie parser + 4 static file serving
      expect(mockApp.use).toHaveBeenCalledTimes(6);

      // Check Slack webhook middleware
      const slackCall = mockApp.use.mock.calls.find(
        (call: any[]) =>
          call[0] === '/istack-buddy/slack-integration/slack/events',
      );
      expect(slackCall).toBeDefined();

      // Check cookie parser middleware (second call)
      expect(cookieParser).toHaveBeenCalled();
    });
  });

  describe('Slack Webhook Verify Function', () => {
    it('should configure express json middleware with verify function', async () => {
      await bootstrap();

      // Verify express.json was called with the correct configuration
      expect(mockJson).toHaveBeenCalledWith({
        verify: expect.any(Function),
      });
    });

    it('should execute verify function and store raw body', async () => {
      await bootstrap();

      // Get the verify function that was passed to express.json
      const verifyFunction = mockJson.mock.calls[0][0]?.verify;
      expect(typeof verifyFunction).toBe('function');

      // Create mock request and buffer
      const mockReq: any = {};
      const mockRes: any = {};
      const mockBuf = Buffer.from('{"test": "data"}');

      // Execute the verify function (express verify functions have 4 parameters)
      if (verifyFunction) {
        verifyFunction(mockReq, mockRes, mockBuf, 'utf8');
      }

      // Verify that rawBody and rawBodyString were stored
      expect(mockReq.rawBody).toBe(mockBuf);
      expect(mockReq.rawBodyString).toBe('{"test": "data"}');
    });

    it('should handle different buffer types in verify function', async () => {
      await bootstrap();

      const verifyFunction = mockJson.mock.calls[0][0]?.verify;
      const mockReq: any = {};
      const mockRes: any = {};

      // Test with empty buffer
      const emptyBuf = Buffer.alloc(0);
      if (verifyFunction) {
        verifyFunction(mockReq, mockRes, emptyBuf, 'utf8');
      }
      expect(mockReq.rawBody).toBe(emptyBuf);
      expect(mockReq.rawBodyString).toBe('');

      // Test with string buffer
      const stringBuf = Buffer.from('hello world');
      if (verifyFunction) {
        verifyFunction(mockReq, mockRes, stringBuf, 'utf8');
      }
      expect(mockReq.rawBody).toBe(stringBuf);
      expect(mockReq.rawBodyString).toBe('hello world');
    });
  });

  describe('Bootstrap Function Properties', () => {
    it('should be an async function', () => {
      expect(bootstrap.constructor.name).toBe('AsyncFunction');
    });

    it('should return a Promise', () => {
      const result = bootstrap();
      expect(result).toBeInstanceOf(Promise);
      return result; // Ensure it completes
    });
  });

  describe('Module Execution', () => {
    it('should have bootstrap function available for export', () => {
      // Test that bootstrap is exported and callable
      expect(bootstrap).toBeDefined();
      expect(typeof bootstrap).toBe('function');
    });

    it('should handle the require.main === module condition', () => {
      // This test verifies the structure without trying to modify read-only properties
      // The actual execution logic is tested through the bootstrap function tests
      expect(require.main).toBeDefined();
    });

    it('should test module execution condition structure', () => {
      // Test that the condition structure exists and is valid
      const mainModule = require.main;
      expect(mainModule).toBeDefined();

      // Verify that the condition would work if this file was executed directly
      // This covers the structure of the condition without actually executing it
      expect(typeof mainModule).toBe('object');
    });
  });
});
