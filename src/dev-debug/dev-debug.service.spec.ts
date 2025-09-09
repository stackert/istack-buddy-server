import { Test, TestingModule } from '@nestjs/testing';
import { DevDebugService } from './dev-debug.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import { FileManagerService } from '../file-manager/file-manager.service';

describe('DevDebugService', () => {
  let service: DevDebugService;
  let mockLogger: jest.Mocked<CustomLoggerService>;
  let mockAuthService: jest.Mocked<AuthenticationService>;

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

    const mockIStackInfoService = {
      sumoReport: {
        submitQuery: jest.fn(),
        jobs: {
          getStatus: jest.fn(),
          getResults: jest.fn(),
        },
        files: {
          get: jest.fn(),
          list: jest.fn(),
        },
      },
    };

    const mockFileManagerService = {
      put: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevDebugService,
        {
          provide: CustomLoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: AuthenticationService,
          useValue: mockAuth,
        },
        {
          provide: IStackInfoService,
          useValue: mockIStackInfoService,
        },
        {
          provide: FileManagerService,
          useValue: mockFileManagerService,
        },
      ],
    }).compile();

    service = module.get<DevDebugService>(DevDebugService);
    mockLogger = module.get<CustomLoggerService>(
      CustomLoggerService,
    ) as jest.Mocked<CustomLoggerService>;
    mockAuthService = module.get<AuthenticationService>(
      AuthenticationService,
    ) as jest.Mocked<AuthenticationService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
