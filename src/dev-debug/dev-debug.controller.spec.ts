import { Test, TestingModule } from '@nestjs/testing';
import { DevDebugController } from './dev-debug.controller';

describe('DevDebugController', () => {
  let controller: DevDebugController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevDebugController],
    }).compile();

    controller = module.get<DevDebugController>(DevDebugController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
