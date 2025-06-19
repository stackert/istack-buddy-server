import { Test, TestingModule } from '@nestjs/testing';
import { DevDebugController } from './dev-debug.controller';
import { DevDebugService } from './dev-debug.service';

describe('DevDebugController', () => {
  let controller: DevDebugController;
  let mockDevDebugService: jest.Mocked<DevDebugService>;

  beforeEach(async () => {
    const mockService = {
      authenticate: jest.fn(),
      getUserDetails: jest.fn(),
      getAllUsers: jest.fn(),
      testAuthenticationStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevDebugController],
      providers: [
        {
          provide: DevDebugService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<DevDebugController>(DevDebugController);
    mockDevDebugService = module.get<DevDebugService>(
      DevDebugService,
    ) as jest.Mocked<DevDebugService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
