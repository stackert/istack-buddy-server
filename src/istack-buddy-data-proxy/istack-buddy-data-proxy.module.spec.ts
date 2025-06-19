import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddyDataProxyModule } from './istack-buddy-data-proxy.module';
import { IstackBuddyDataProxyController } from './istack-buddy-data-proxy.controller';
import { IstackBuddyDataProxyService } from './istack-buddy-data-proxy.service';

describe('IstackBuddyDataProxyModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [IstackBuddyDataProxyModule],
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
    it('should provide IstackBuddyDataProxyController', () => {
      const controller = module.get<IstackBuddyDataProxyController>(
        IstackBuddyDataProxyController,
      );
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(IstackBuddyDataProxyController);
    });

    it('should have controller as singleton', () => {
      const controller1 = module.get<IstackBuddyDataProxyController>(
        IstackBuddyDataProxyController,
      );
      const controller2 = module.get<IstackBuddyDataProxyController>(
        IstackBuddyDataProxyController,
      );
      expect(controller1).toBe(controller2);
    });
  });

  describe('Service Registration', () => {
    it('should provide IstackBuddyDataProxyService', () => {
      const service = module.get<IstackBuddyDataProxyService>(
        IstackBuddyDataProxyService,
      );
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(IstackBuddyDataProxyService);
    });

    it('should have service as singleton', () => {
      const service1 = module.get<IstackBuddyDataProxyService>(
        IstackBuddyDataProxyService,
      );
      const service2 = module.get<IstackBuddyDataProxyService>(
        IstackBuddyDataProxyService,
      );
      expect(service1).toBe(service2);
    });
  });

  describe('Dependency Injection', () => {
    it('should inject service into controller', () => {
      const controller = module.get<IstackBuddyDataProxyController>(
        IstackBuddyDataProxyController,
      );
      const service = module.get<IstackBuddyDataProxyService>(
        IstackBuddyDataProxyService,
      );

      expect(() => {
        controller.findAll();
      }).not.toThrow();

      const result = controller.findAll();
      expect(result).toBe(service.findAll());
    });

    it('should properly wire all dependencies', () => {
      const controller = module.get<IstackBuddyDataProxyController>(
        IstackBuddyDataProxyController,
      );

      expect(() => {
        controller.findAll();
        controller.findOne('1');
        controller.create({});
        controller.update('1', {});
        controller.remove('1');
      }).not.toThrow();
    });
  });

  describe('Module Structure', () => {
    it('should handle module reference correctly', () => {
      const moduleRef = module.get(IstackBuddyDataProxyModule);
      expect(moduleRef).toBeDefined();
    });

    it('should provide all required components', () => {
      expect(() => {
        module.get<IstackBuddyDataProxyController>(
          IstackBuddyDataProxyController,
        );
        module.get<IstackBuddyDataProxyService>(IstackBuddyDataProxyService);
      }).not.toThrow();
    });
  });

  describe('Module Lifecycle', () => {
    it('should initialize without errors', async () => {
      expect(async () => {
        const testModule = await Test.createTestingModule({
          imports: [IstackBuddyDataProxyModule],
        }).compile();
        await testModule.close();
      }).not.toThrow();
    });

    it('should close gracefully', async () => {
      const testModule = await Test.createTestingModule({
        imports: [IstackBuddyDataProxyModule],
      }).compile();

      expect(async () => {
        await testModule.close();
      }).not.toThrow();
    });
  });

  describe('Component Integration', () => {
    it('should allow controller and service to work together', () => {
      const controller = module.get<IstackBuddyDataProxyController>(
        IstackBuddyDataProxyController,
      );
      const service = module.get<IstackBuddyDataProxyService>(
        IstackBuddyDataProxyService,
      );

      const serviceResult = service.findOne(1);
      const controllerResult = controller.findOne('1');

      expect(serviceResult).toBe(controllerResult);
    });

    it('should maintain consistency across method calls', () => {
      const controller = module.get<IstackBuddyDataProxyController>(
        IstackBuddyDataProxyController,
      );

      const result1 = controller.findAll();
      const result2 = controller.findAll();

      expect(result1).toBe(result2);
    });
  });

  describe('Module Imports', () => {
    it('should work when imported into other modules', async () => {
      const parentModule = await Test.createTestingModule({
        imports: [IstackBuddyDataProxyModule],
      }).compile();

      const controller = parentModule.get<IstackBuddyDataProxyController>(
        IstackBuddyDataProxyController,
      );
      const service = parentModule.get<IstackBuddyDataProxyService>(
        IstackBuddyDataProxyService,
      );

      expect(controller).toBeDefined();
      expect(service).toBeDefined();

      await parentModule.close();
    });
  });
});
