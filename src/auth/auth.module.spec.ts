import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { LoggerModule } from '../common/logger/logger.module';

describe('AuthModule', () => {
  let module: TestingModule;
  let authService: AuthService;
  let loggerService: CustomLoggerService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

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

  describe('Provider Registration', () => {
    it('should provide AuthService', () => {
      expect(authService).toBeDefined();
      expect(authService).toBeInstanceOf(AuthService);
    });

    it('should provide CustomLoggerService from LoggerModule', () => {
      expect(loggerService).toBeDefined();
      expect(loggerService).toBeInstanceOf(CustomLoggerService);
    });
  });

  describe('Service Dependencies', () => {
    it('should inject CustomLoggerService into AuthService', () => {
      // Verify that AuthService can be instantiated with its dependencies
      expect(authService).toBeDefined();

      // Verify the logger dependency is available
      expect(loggerService).toBeDefined();
    });
  });

  describe('Module Exports', () => {
    it('should export AuthService for other modules', async () => {
      // Create a test module that imports AuthModule
      const testModule = await Test.createTestingModule({
        imports: [AuthModule],
        providers: [
          {
            provide: 'TestService',
            useFactory: (authService: AuthService) => {
              return { authService };
            },
            inject: [AuthService],
          },
        ],
      }).compile();

      const testService = testModule.get('TestService');
      expect(testService.authService).toBeDefined();
      expect(testService.authService).toBeInstanceOf(AuthService);

      await testModule.close();
    });
  });

  describe('Module Integration', () => {
    it('should integrate properly with LoggerModule', () => {
      // Verify that LoggerModule is properly imported and provides its services
      expect(loggerService).toBeDefined();

      // Verify AuthService can use the logger (basic instantiation test)
      expect(authService).toBeDefined();
    });

    it('should provide all required dependencies for AuthService', async () => {
      // Test that AuthService can be instantiated without dependency injection errors
      expect(() => {
        module.get<AuthService>(AuthService);
      }).not.toThrow();
    });
  });

  describe('Module Configuration', () => {
    it('should have correct module metadata', () => {
      const moduleMetadata = Reflect.getMetadata('imports', AuthModule) || [];
      const providersMetadata =
        Reflect.getMetadata('providers', AuthModule) || [];
      const exportsMetadata = Reflect.getMetadata('exports', AuthModule) || [];

      // Check that LoggerModule is imported
      expect(moduleMetadata).toContain(LoggerModule);

      // Check that AuthService is provided
      expect(providersMetadata).toContain(AuthService);

      // Check that AuthService is exported
      expect(exportsMetadata).toContain(AuthService);
    });

    it('should be importable by other modules', async () => {
      // Test creating a module that imports AuthModule
      const importingModule = await Test.createTestingModule({
        imports: [AuthModule],
      }).compile();

      expect(importingModule).toBeDefined();

      // Verify that imported AuthService is available
      const importedAuthService = importingModule.get<AuthService>(AuthService);
      expect(importedAuthService).toBeDefined();
      expect(importedAuthService).toBeInstanceOf(AuthService);

      await importingModule.close();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle module dependency resolution correctly', async () => {
      // Test that the module properly resolves all dependencies
      await expect(
        Test.createTestingModule({
          imports: [AuthModule],
        }).compile(),
      ).resolves.toBeDefined();
    });

    it('should fail gracefully if dependencies are missing', async () => {
      // Test module creation without LoggerModule (should fail)
      const testModule = Test.createTestingModule({
        providers: [AuthService], // Missing CustomLoggerService dependency
      });

      await expect(testModule.compile()).rejects.toThrow();
    });
  });
});
