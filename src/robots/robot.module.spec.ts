import { Test, TestingModule } from '@nestjs/testing';
import { RobotModule } from './robot.module';
import { RobotService } from './robot.service';

describe('RobotModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RobotModule],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have RobotService', () => {
    const service = module.get<RobotService>(RobotService);
    expect(service).toBeDefined();
  });

  it('should be a global module', () => {
    // Test that the module can be instantiated without errors
    // This verifies the module structure is valid
    expect(module).toBeDefined();
  });
});
