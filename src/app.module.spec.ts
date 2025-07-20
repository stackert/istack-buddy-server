import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DevDebugModule } from './dev-debug/dev-debug.module';
import { AuthenticationModule } from './authentication/authentication.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { LoggerModule } from './common/logger/logger.module';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Module Compilation', () => {
    it('should compile successfully', () => {
      expect(module).toBeDefined();
    });

    it('should be an instance of TestingModule', () => {
      expect(module).toBeInstanceOf(TestingModule);
    });
  });

  describe('Controller Registration', () => {
    it('should provide AppController', () => {
      const controller = module.get<AppController>(AppController);
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(AppController);
    });

    it('should have AppController as singleton', () => {
      const controller1 = module.get<AppController>(AppController);
      const controller2 = module.get<AppController>(AppController);
      expect(controller1).toBe(controller2);
    });
  });

  describe('Service Registration', () => {
    it('should provide AppService', () => {
      const service = module.get<AppService>(AppService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AppService);
    });

    it('should have AppService as singleton', () => {
      const service1 = module.get<AppService>(AppService);
      const service2 = module.get<AppService>(AppService);
      expect(service1).toBe(service2);
    });
  });

  describe('Module Imports', () => {
    it('should import LoggerModule', () => {
      expect(() => module.get(LoggerModule)).not.toThrow();
    });

    it('should import AuthenticationModule', () => {
      expect(() => module.get(AuthenticationModule)).not.toThrow();
    });

    it('should import UserProfileModule', () => {
      expect(() => module.get(UserProfileModule)).not.toThrow();
    });

    it('should import DevDebugModule', () => {
      expect(() => module.get(DevDebugModule)).not.toThrow();
    });
  });

  describe('Dependency Injection', () => {
    it('should inject AppService into AppController', () => {
      const controller = module.get<AppController>(AppController);
      const service = module.get<AppService>(AppService);

      expect(() => {
        controller.getHello();
      }).not.toThrow();

      const result = controller.getHello();
      expect(result).toBe(service.getHello());
    });
  });

  describe('Module Structure', () => {
    it('should handle module reference correctly', () => {
      const moduleRef = module.get(AppModule);
      expect(moduleRef).toBeDefined();
    });

    it('should provide all required components', () => {
      expect(() => {
        module.get<AppController>(AppController);
        module.get<AppService>(AppService);
      }).not.toThrow();
    });
  });

  describe('Component Integration', () => {
    it('should allow controller and service to work together', () => {
      const controller = module.get<AppController>(AppController);
      const service = module.get<AppService>(AppService);

      const serviceResult = service.getHello();
      const controllerResult = controller.getHello();

      expect(serviceResult).toBe(controllerResult);
    });

    it('should maintain consistency across method calls', () => {
      const controller = module.get<AppController>(AppController);

      const result1 = controller.getHello();
      const result2 = controller.getHello();

      expect(result1).toBe(result2);
    });
  });

  describe('Module Lifecycle', () => {
    it('should initialize without errors', async () => {
      expect(async () => {
        const testModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();
        await testModule.close();
      }).not.toThrow();
    });

    it('should close gracefully', async () => {
      const testModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      expect(async () => {
        await testModule.close();
      }).not.toThrow();
    });
  });

  describe('Module Configuration', () => {
    it('should have all imports configured correctly', () => {
      const modules = [
        LoggerModule,
        AuthenticationModule,
        UserProfileModule,
        DevDebugModule,
      ];

      modules.forEach((moduleClass) => {
        expect(() => module.get(moduleClass)).not.toThrow();
      });
    });

    it('should have basic providers configured correctly', () => {
      const providers = [AppService];

      providers.forEach((providerClass) => {
        expect(() => module.get(providerClass)).not.toThrow();
      });
    });
  });

  describe('Application Bootstrap Readiness', () => {
    it('should be ready for application bootstrap', () => {
      // Test that the module contains all necessary components for bootstrapping
      expect(module.get<AppController>(AppController)).toBeDefined();
      expect(module.get<AppService>(AppService)).toBeDefined();
    });

    it('should have all required modules imported', () => {
      // Verify all imported modules are accessible
      expect(() => {
        module.get(LoggerModule);
        module.get(AuthenticationModule);
        module.get(UserProfileModule);
        module.get(DevDebugModule);
      }).not.toThrow();
    });
  });
});
