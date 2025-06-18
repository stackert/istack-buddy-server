import { Test, TestingModule } from '@nestjs/testing';
import { DevDebugService } from './dev-debug.service';

describe('DevDebugService', () => {
  let service: DevDebugService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DevDebugService],
    }).compile();

    service = module.get<DevDebugService>(DevDebugService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
