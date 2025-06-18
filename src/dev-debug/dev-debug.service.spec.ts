import { Test, TestingModule } from '@nestjs/testing';
import { DevDebugService } from './dev-debug.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthService } from '../auth/auth.service';

describe('DevDebugService', () => {
  let service: DevDebugService;
  let mockLogger: jest.Mocked<CustomLoggerService>;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockLoggerService = {
      logWithContext: jest.fn(),
      auditLog: jest.fn(),
      error: jest.fn(),
    };

    const mockAuth = {
      authenticateUser: jest.fn(),
      isUserAuthenticated: jest.fn(),
      getUserPermissionSet: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevDebugService,
        {
          provide: CustomLoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: AuthService,
          useValue: mockAuth,
        },
      ],
    }).compile();

    service = module.get<DevDebugService>(DevDebugService);
    mockLogger = module.get<CustomLoggerService>(
      CustomLoggerService,
    ) as jest.Mocked<CustomLoggerService>;
    mockAuthService = module.get<AuthService>(
      AuthService,
    ) as jest.Mocked<AuthService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
