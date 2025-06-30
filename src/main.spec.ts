import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';

// Mock all dependencies to avoid side effects
jest.mock('@nestjs/core');
jest.mock('@nestjs/swagger');
jest.mock('cookie-parser');
jest.mock('dotenv');
jest.mock('./app.module', () => ({
  AppModule: class MockAppModule {},
}));

// Import the actual bootstrap function
import { bootstrap } from './main';

describe('Main Bootstrap Function', () => {
  let mockApp: any;
  let mockNestFactory: jest.Mocked<typeof NestFactory>;
  let mockSwaggerModule: jest.Mocked<typeof SwaggerModule>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock the application instance
    mockApp = {
      use: jest.fn(),
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
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
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'Accept',
          'Origin',
          'X-Requested-With',
        ],
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

    it('should start listening on default port 3000', async () => {
      const originalEnv = process.env.PORT;
      delete process.env.PORT;

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith(3000);

      // Restore original environment
      if (originalEnv) {
        process.env.PORT = originalEnv;
      }
    });

    it('should start listening on configured port from environment', async () => {
      const originalEnv = process.env.PORT;
      process.env.PORT = '4000';

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith('4000');

      // Restore original environment
      if (originalEnv) {
        process.env.PORT = originalEnv;
      } else {
        delete process.env.PORT;
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
      const originalPort = process.env.PORT;
      delete process.env.PORT;

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith(3000);

      // Restore
      if (originalPort) {
        process.env.PORT = originalPort;
      }
    });

    it('should handle empty PORT environment variable', async () => {
      const originalPort = process.env.PORT;
      process.env.PORT = '';

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith('');

      // Restore
      if (originalPort) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
      }
    });

    it('should handle custom port from environment', async () => {
      const originalPort = process.env.PORT;
      process.env.PORT = '8080';

      await bootstrap();
      expect(mockApp.listen).toHaveBeenCalledWith('8080');

      // Restore
      if (originalPort) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
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
        'enableCors',
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
      expect(mockApp.use).toHaveBeenCalledTimes(1);
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
});
