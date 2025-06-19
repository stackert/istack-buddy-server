import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationUserModule } from './authentication-user.module';
import { AuthenticationUserController } from './authentication-user.controller';
import { AuthenticationUserService } from './authentication-user.service';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

describe('AuthenticationUserModule', () => {
  let module: TestingModule;
  let controller: AuthenticationUserController;
  let service: AuthenticationUserService;
  let authService: AuthService;
  let loggerService: CustomLoggerService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuthenticationUserModule],
    }).compile();

    controller = module.get<AuthenticationUserController>(
      AuthenticationUserController,
    );
    service = module.get<AuthenticationUserService>(AuthenticationUserService);
    authService = module.get<AuthService>(AuthService);
    loggerService = module.get<CustomLoggerService>(CustomLoggerService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Module Definition', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should compile successfully', () => {
      expect(module).toBeInstanceOf(TestingModule);
    });
  });

  describe('Controller Registration', () => {
    it('should provide AuthenticationUserController', () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(AuthenticationUserController);
    });
  });

  describe('Service Registration', () => {
    it('should provide AuthenticationUserService', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AuthenticationUserService);
    });

    it('should provide AuthService from AuthModule', () => {
      expect(authService).toBeDefined();
      expect(authService).toBeInstanceOf(AuthService);
    });

    it('should provide CustomLoggerService from AuthModule->LoggerModule', () => {
      expect(loggerService).toBeDefined();
      expect(loggerService).toBeInstanceOf(CustomLoggerService);
    });
  });

  describe('Service Dependencies', () => {
    it('should inject AuthService into AuthenticationUserService', () => {
      // Verify that AuthenticationUserService can be instantiated with its dependencies
      expect(service).toBeDefined();

      // Verify the AuthService dependency is available
      expect(authService).toBeDefined();
    });

    it('should inject CustomLoggerService into AuthenticationUserService', () => {
      // Verify that AuthenticationUserService can be instantiated with logger dependency
      expect(service).toBeDefined();

      // Verify the logger dependency is available
      expect(loggerService).toBeDefined();
    });

    it('should inject AuthenticationUserService into AuthenticationUserController', () => {
      // Verify that AuthenticationUserController can be instantiated with its dependencies
      expect(controller).toBeDefined();

      // Verify the service dependency is available
      expect(service).toBeDefined();
    });
  });

  describe('Module Imports', () => {
    it('should import AuthModule and provide its exports', () => {
      // Verify that AuthModule is properly imported and provides AuthService
      expect(authService).toBeDefined();
      expect(authService).toBeInstanceOf(AuthService);

      // Verify that LoggerModule (via AuthModule) provides CustomLoggerService
      expect(loggerService).toBeDefined();
      expect(loggerService).toBeInstanceOf(CustomLoggerService);
    });
  });

  describe('Module Integration', () => {
    it('should integrate properly with AuthModule', () => {
      // Verify that AuthModule is properly imported and provides its services
      expect(authService).toBeDefined();
      expect(loggerService).toBeDefined();

      // Verify AuthenticationUserService can use the imported services
      expect(service).toBeDefined();
    });

    it('should provide all required dependencies for AuthenticationUserService', () => {
      // Test that AuthenticationUserService can be instantiated without dependency injection errors
      expect(() => {
        module.get<AuthenticationUserService>(AuthenticationUserService);
      }).not.toThrow();
    });

    it('should provide all required dependencies for AuthenticationUserController', () => {
      // Test that AuthenticationUserController can be instantiated without dependency injection errors
      expect(() => {
        module.get<AuthenticationUserController>(AuthenticationUserController);
      }).not.toThrow();
    });
  });

  describe('Module Configuration', () => {
    it('should have correct module metadata', () => {
      const moduleMetadata =
        Reflect.getMetadata('imports', AuthenticationUserModule) || [];
      const controllersMetadata =
        Reflect.getMetadata('controllers', AuthenticationUserModule) || [];
      const providersMetadata =
        Reflect.getMetadata('providers', AuthenticationUserModule) || [];

      // Check that AuthModule is imported
      expect(moduleMetadata).toContain(AuthModule);

      // Check that AuthenticationUserController is registered
      expect(controllersMetadata).toContain(AuthenticationUserController);

      // Check that AuthenticationUserService is provided
      expect(providersMetadata).toContain(AuthenticationUserService);
    });

    it('should be importable by other modules', async () => {
      // Test creating a module that imports AuthenticationUserModule
      const importingModule = await Test.createTestingModule({
        imports: [AuthenticationUserModule],
      }).compile();

      expect(importingModule).toBeDefined();

      // Verify that imported services are available
      const importedController =
        importingModule.get<AuthenticationUserController>(
          AuthenticationUserController,
        );
      const importedService = importingModule.get<AuthenticationUserService>(
        AuthenticationUserService,
      );

      expect(importedController).toBeDefined();
      expect(importedController).toBeInstanceOf(AuthenticationUserController);

      expect(importedService).toBeDefined();
      expect(importedService).toBeInstanceOf(AuthenticationUserService);

      await importingModule.close();
    });
  });

  describe('Dependency Chain Verification', () => {
    it('should resolve the complete dependency chain correctly', () => {
      // Test the full dependency chain:
      // AuthenticationUserController -> AuthenticationUserService -> AuthService + CustomLoggerService

      expect(controller).toBeDefined();
      expect(service).toBeDefined();
      expect(authService).toBeDefined();
      expect(loggerService).toBeDefined();

      // Verify types
      expect(controller).toBeInstanceOf(AuthenticationUserController);
      expect(service).toBeInstanceOf(AuthenticationUserService);
      expect(authService).toBeInstanceOf(AuthService);
      expect(loggerService).toBeInstanceOf(CustomLoggerService);
    });

    it('should handle nested module dependencies (AuthModule -> LoggerModule)', () => {
      // Verify that nested module dependencies are resolved correctly
      // AuthenticationUserModule -> AuthModule -> LoggerModule -> CustomLoggerService

      expect(loggerService).toBeDefined();
      expect(loggerService).toBeInstanceOf(CustomLoggerService);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle module dependency resolution correctly', async () => {
      // Test that the module properly resolves all dependencies
      await expect(
        Test.createTestingModule({
          imports: [AuthenticationUserModule],
        }).compile(),
      ).resolves.toBeDefined();
    });

    it('should fail gracefully if AuthModule is missing', async () => {
      // Test module creation without AuthModule (should fail)
      const testModule = Test.createTestingModule({
        controllers: [AuthenticationUserController],
        providers: [AuthenticationUserService], // Missing AuthService and CustomLoggerService dependencies
      });

      await expect(testModule.compile()).rejects.toThrow();
    });

    it('should fail gracefully if dependencies are missing', async () => {
      // Test module creation with partial dependencies (should fail)
      const testModule = Test.createTestingModule({
        controllers: [AuthenticationUserController],
        // Missing AuthenticationUserService provider
      });

      await expect(testModule.compile()).rejects.toThrow();
    });
  });

  describe('Module Lifecycle', () => {
    it('should initialize and dispose properly', async () => {
      const testModule = await Test.createTestingModule({
        imports: [AuthenticationUserModule],
      }).compile();

      expect(testModule).toBeDefined();

      // Verify all components are available after initialization
      const testController = testModule.get<AuthenticationUserController>(
        AuthenticationUserController,
      );
      const testService = testModule.get<AuthenticationUserService>(
        AuthenticationUserService,
      );
      const testAuthService = testModule.get<AuthService>(AuthService);

      expect(testController).toBeDefined();
      expect(testService).toBeDefined();
      expect(testAuthService).toBeDefined();

      // Should dispose without errors
      await expect(testModule.close()).resolves.toBeUndefined();
    });
  });

  describe('Module Exports', () => {
    it('should not export any services (no exports defined)', () => {
      // AuthenticationUserModule doesn't define exports, so other modules importing it
      // should not be able to access its providers directly
      const exportsMetadata =
        Reflect.getMetadata('exports', AuthenticationUserModule) || [];
      expect(exportsMetadata).toHaveLength(0);
    });

    it('should work correctly as a feature module without exports', async () => {
      // Test that the module works as intended - as a feature module
      // that encapsulates its functionality without exposing internal services
      const featureModule = await Test.createTestingModule({
        imports: [AuthenticationUserModule],
      }).compile();

      // The controller should be available (as it's meant to handle HTTP requests)
      const moduleController = featureModule.get<AuthenticationUserController>(
        AuthenticationUserController,
      );
      expect(moduleController).toBeDefined();

      // Internal services should be available within the module context
      const moduleService = featureModule.get<AuthenticationUserService>(
        AuthenticationUserService,
      );
      expect(moduleService).toBeDefined();

      await featureModule.close();
    });
  });

  describe('Module Architecture Validation', () => {
    it('should follow proper NestJS module architecture', () => {
      // Verify the module follows NestJS conventions

      // Should have module metadata (checking for @Module decorator existence)
      const moduleMetadata =
        Reflect.getMetadata('imports', AuthenticationUserModule) ||
        Reflect.getMetadata('controllers', AuthenticationUserModule) ||
        Reflect.getMetadata('providers', AuthenticationUserModule);
      expect(moduleMetadata).toBeDefined();

      // Should be a class
      expect(typeof AuthenticationUserModule).toBe('function');
      expect(AuthenticationUserModule.prototype).toBeDefined();
    });

    it('should provide a cohesive authentication user feature', () => {
      // Verify that the module provides a complete feature set for user authentication

      // Should have a controller for handling HTTP requests
      expect(controller).toBeInstanceOf(AuthenticationUserController);

      // Should have a service for business logic
      expect(service).toBeInstanceOf(AuthenticationUserService);

      // Should have access to authentication services
      expect(authService).toBeInstanceOf(AuthService);

      // Should have access to logging services
      expect(loggerService).toBeInstanceOf(CustomLoggerService);
    });
  });
});
