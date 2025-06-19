import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddyDataProxyController } from './istack-buddy-data-proxy.controller';
import { IstackBuddyDataProxyService } from './istack-buddy-data-proxy.service';
import { CreateIstackBuddyDataProxyDto } from './dto/create-istack-buddy-data-proxy.dto';
import { UpdateIstackBuddyDataProxyDto } from './dto/update-istack-buddy-data-proxy.dto';

describe('IstackBuddyDataProxyController', () => {
  let controller: IstackBuddyDataProxyController;
  let service: IstackBuddyDataProxyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IstackBuddyDataProxyController],
      providers: [IstackBuddyDataProxyService],
    }).compile();

    controller = module.get<IstackBuddyDataProxyController>(
      IstackBuddyDataProxyController,
    );
    service = module.get<IstackBuddyDataProxyService>(
      IstackBuddyDataProxyService,
    );
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should be an instance of IstackBuddyDataProxyController', () => {
      expect(controller).toBeInstanceOf(IstackBuddyDataProxyController);
    });

    it('should have all CRUD methods', () => {
      expect(typeof controller.create).toBe('function');
      expect(typeof controller.findAll).toBe('function');
      expect(typeof controller.findOne).toBe('function');
      expect(typeof controller.update).toBe('function');
      expect(typeof controller.remove).toBe('function');
    });

    it('should have service dependency injected', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(IstackBuddyDataProxyService);
    });
  });

  describe('create', () => {
    it('should call service.create with correct parameters', () => {
      const createDto = new CreateIstackBuddyDataProxyDto();
      const serviceSpy = jest.spyOn(service, 'create');

      controller.create(createDto);

      expect(serviceSpy).toHaveBeenCalledWith(createDto);
      expect(serviceSpy).toHaveBeenCalledTimes(1);
    });

    it('should return the result from service.create', () => {
      const createDto = new CreateIstackBuddyDataProxyDto();
      const expectedResult = 'This action adds a new istackBuddyDataProxy';

      const result = controller.create(createDto);

      expect(result).toBe(expectedResult);
    });

    it('should handle empty DTO', () => {
      const createDto = new CreateIstackBuddyDataProxyDto();

      expect(() => controller.create(createDto)).not.toThrow();
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', () => {
      const serviceSpy = jest.spyOn(service, 'findAll');

      controller.findAll();

      expect(serviceSpy).toHaveBeenCalledWith();
      expect(serviceSpy).toHaveBeenCalledTimes(1);
    });

    it('should return the result from service.findAll', () => {
      const expectedResult = 'This action returns all istackBuddyDataProxy';

      const result = controller.findAll();

      expect(result).toBe(expectedResult);
    });

    it('should not require parameters', () => {
      expect(() => controller.findAll()).not.toThrow();
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with correct parameters', () => {
      const id = '1';
      const serviceSpy = jest.spyOn(service, 'findOne');

      controller.findOne(id);

      expect(serviceSpy).toHaveBeenCalledWith(1);
      expect(serviceSpy).toHaveBeenCalledTimes(1);
    });

    it('should convert string id to number', () => {
      const serviceSpy = jest.spyOn(service, 'findOne');

      controller.findOne('123');

      expect(serviceSpy).toHaveBeenCalledWith(123);
    });

    it('should return the result from service.findOne', () => {
      const id = '5';
      const expectedResult = 'This action returns a #5 istackBuddyDataProxy';

      const result = controller.findOne(id);

      expect(result).toBe(expectedResult);
    });

    it('should handle string id parameters', () => {
      expect(() => controller.findOne('456')).not.toThrow();
    });

    it('should handle numeric string ids', () => {
      const testIds = ['1', '10', '999', '0'];

      testIds.forEach((id) => {
        expect(() => controller.findOne(id)).not.toThrow();
      });
    });

    it('should handle negative string ids', () => {
      const result = controller.findOne('-1');
      expect(result).toBe('This action returns a #-1 istackBuddyDataProxy');
    });
  });

  describe('update', () => {
    it('should call service.update with correct parameters', () => {
      const id = '1';
      const updateDto = new UpdateIstackBuddyDataProxyDto();
      const serviceSpy = jest.spyOn(service, 'update');

      controller.update(id, updateDto);

      expect(serviceSpy).toHaveBeenCalledWith(1, updateDto);
      expect(serviceSpy).toHaveBeenCalledTimes(1);
    });

    it('should convert string id to number', () => {
      const updateDto = new UpdateIstackBuddyDataProxyDto();
      const serviceSpy = jest.spyOn(service, 'update');

      controller.update('789', updateDto);

      expect(serviceSpy).toHaveBeenCalledWith(789, updateDto);
    });

    it('should return the result from service.update', () => {
      const id = '3';
      const updateDto = new UpdateIstackBuddyDataProxyDto();
      const expectedResult = 'This action updates a #3 istackBuddyDataProxy';

      const result = controller.update(id, updateDto);

      expect(result).toBe(expectedResult);
    });

    it('should handle empty DTO', () => {
      const updateDto = new UpdateIstackBuddyDataProxyDto();

      expect(() => controller.update('1', updateDto)).not.toThrow();
    });

    it('should handle various id formats', () => {
      const updateDto = new UpdateIstackBuddyDataProxyDto();
      const testIds = ['1', '10', '999', '0', '-5'];

      testIds.forEach((id) => {
        expect(() => controller.update(id, updateDto)).not.toThrow();
      });
    });
  });

  describe('remove', () => {
    it('should call service.remove with correct parameters', () => {
      const id = '1';
      const serviceSpy = jest.spyOn(service, 'remove');

      controller.remove(id);

      expect(serviceSpy).toHaveBeenCalledWith(1);
      expect(serviceSpy).toHaveBeenCalledTimes(1);
    });

    it('should convert string id to number', () => {
      const serviceSpy = jest.spyOn(service, 'remove');

      controller.remove('456');

      expect(serviceSpy).toHaveBeenCalledWith(456);
    });

    it('should return the result from service.remove', () => {
      const id = '7';
      const expectedResult = 'This action removes a #7 istackBuddyDataProxy';

      const result = controller.remove(id);

      expect(result).toBe(expectedResult);
    });

    it('should handle string id parameters', () => {
      expect(() => controller.remove('999')).not.toThrow();
    });

    it('should handle various id formats', () => {
      const testIds = ['1', '10', '999', '0', '-10'];

      testIds.forEach((id) => {
        expect(() => controller.remove(id)).not.toThrow();
      });
    });
  });

  describe('Service Integration', () => {
    it('should properly delegate all calls to service', () => {
      const createSpy = jest.spyOn(service, 'create');
      const findAllSpy = jest.spyOn(service, 'findAll');
      const findOneSpy = jest.spyOn(service, 'findOne');
      const updateSpy = jest.spyOn(service, 'update');
      const removeSpy = jest.spyOn(service, 'remove');

      const createDto = new CreateIstackBuddyDataProxyDto();
      const updateDto = new UpdateIstackBuddyDataProxyDto();

      controller.create(createDto);
      controller.findAll();
      controller.findOne('1');
      controller.update('1', updateDto);
      controller.remove('1');

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(findAllSpy).toHaveBeenCalledTimes(1);
      expect(findOneSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Parameter Transformation', () => {
    it('should correctly transform string IDs to numbers for findOne', () => {
      const serviceSpy = jest.spyOn(service, 'findOne');

      controller.findOne('42');

      expect(serviceSpy).toHaveBeenCalledWith(42);
      expect(typeof serviceSpy.mock.calls[0][0]).toBe('number');
    });

    it('should correctly transform string IDs to numbers for update', () => {
      const serviceSpy = jest.spyOn(service, 'update');
      const updateDto = new UpdateIstackBuddyDataProxyDto();

      controller.update('42', updateDto);

      expect(serviceSpy).toHaveBeenCalledWith(42, updateDto);
      expect(typeof serviceSpy.mock.calls[0][0]).toBe('number');
    });

    it('should correctly transform string IDs to numbers for remove', () => {
      const serviceSpy = jest.spyOn(service, 'remove');

      controller.remove('42');

      expect(serviceSpy).toHaveBeenCalledWith(42);
      expect(typeof serviceSpy.mock.calls[0][0]).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should not throw errors for valid operations', () => {
      const createDto = new CreateIstackBuddyDataProxyDto();
      const updateDto = new UpdateIstackBuddyDataProxyDto();

      expect(() => {
        controller.create(createDto);
        controller.findAll();
        controller.findOne('1');
        controller.update('1', updateDto);
        controller.remove('1');
      }).not.toThrow();
    });
  });

  describe('Return Values', () => {
    it('should return values from service methods', () => {
      const createResult = controller.create(
        new CreateIstackBuddyDataProxyDto(),
      );
      const findAllResult = controller.findAll();
      const findOneResult = controller.findOne('1');
      const updateResult = controller.update(
        '1',
        new UpdateIstackBuddyDataProxyDto(),
      );
      const removeResult = controller.remove('1');

      expect(createResult).toBeDefined();
      expect(findAllResult).toBeDefined();
      expect(findOneResult).toBeDefined();
      expect(updateResult).toBeDefined();
      expect(removeResult).toBeDefined();

      expect(typeof createResult).toBe('string');
      expect(typeof findAllResult).toBe('string');
      expect(typeof findOneResult).toBe('string');
      expect(typeof updateResult).toBe('string');
      expect(typeof removeResult).toBe('string');
    });
  });
});
