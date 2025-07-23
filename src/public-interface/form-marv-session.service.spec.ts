import { Test, TestingModule } from '@nestjs/testing';
import { FormMarvSessionService } from './form-marv-session.service';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { UserProfileService } from '../user-profile/user-profile.service';

describe('FormMarvSessionService', () => {
  let service: FormMarvSessionService;
  let mockAuthPermissionsService: jest.Mocked<AuthorizationPermissionsService>;
  let mockUserProfileService: jest.Mocked<UserProfileService>;
  let mockLogger: jest.Mocked<CustomLoggerService>;

  beforeEach(async () => {
    const mockAuthPermissionsServiceValue = {
      addUser: jest.fn(),
    };

    const mockUserProfileServiceValue = {
      addTemporaryUser: jest.fn(),
    };

    const mockLoggerValue = {
      logWithContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormMarvSessionService,
        {
          provide: AuthorizationPermissionsService,
          useValue: mockAuthPermissionsServiceValue,
        },
        {
          provide: UserProfileService,
          useValue: mockUserProfileServiceValue,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLoggerValue,
        },
      ],
    }).compile();

    service = module.get<FormMarvSessionService>(FormMarvSessionService);
    mockAuthPermissionsService = module.get(AuthorizationPermissionsService);
    mockUserProfileService = module.get(UserProfileService);
    mockLogger = module.get(CustomLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a session with a generated fake formId when no formId is provided', () => {
      const secretKey = service.createSession();

      expect(secretKey).toBeDefined();
      expect(mockAuthPermissionsService.addUser).toHaveBeenCalledWith(
        expect.stringMatching(/^form-marv-temp-/),
        ['cx-agent:form-marv:read'],
        [],
      );
      expect(mockUserProfileService.addTemporaryUser).toHaveBeenCalledWith(
        expect.stringMatching(/^form-marv-temp-/),
        expect.objectContaining({
          email: expect.stringMatching(/^form-marv-temp-.*@form-marv\.temp$/),
          username: expect.stringMatching(/^form-marv-temp-/),
          account_type_informal: 'TEMPORARY',
          first_name: 'Form',
          last_name: 'Marv',
        }),
      );

      const session = service.getSession(secretKey);
      expect(session).toBeDefined();
      expect(session?.formId).toMatch(/^[1-9]\d{5}$/); // 6 digits starting with 1-9
      expect(session?.secretKey).toBe(secretKey);
      expect(session?.userId).toMatch(/^form-marv-temp-/);
      expect(session?.jwtToken).toBeDefined();
      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.lastActivityAt).toBeInstanceOf(Date);
      expect(session?.expiresInMs).toBe(24 * 60 * 60 * 1000);

      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'log',
        'Form-marv session created',
        'FormMarvSessionService.createSession',
        undefined,
        expect.objectContaining({
          secretKey,
          userId: expect.stringMatching(/^form-marv-temp-/),
          formId: expect.stringMatching(/^[1-9]\d{5}$/),
        }),
      );
    });

    it('should create a session with the provided formId', () => {
      const providedFormId = '123456';
      const secretKey = service.createSession(providedFormId);

      expect(secretKey).toBeDefined();
      expect(mockAuthPermissionsService.addUser).toHaveBeenCalledWith(
        expect.stringMatching(/^form-marv-temp-/),
        ['cx-agent:form-marv:read'],
        [],
      );
      expect(mockUserProfileService.addTemporaryUser).toHaveBeenCalledWith(
        expect.stringMatching(/^form-marv-temp-/),
        expect.objectContaining({
          email: expect.stringMatching(/^form-marv-temp-.*@form-marv\.temp$/),
          username: expect.stringMatching(/^form-marv-temp-/),
          account_type_informal: 'TEMPORARY',
          first_name: 'Form',
          last_name: 'Marv',
        }),
      );

      const session = service.getSession(secretKey);
      expect(session).toBeDefined();
      expect(session?.formId).toBe(providedFormId);
      expect(session?.secretKey).toBe(secretKey);
      expect(session?.userId).toMatch(/^form-marv-temp-/);
      expect(session?.jwtToken).toBeDefined();
      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.lastActivityAt).toBeInstanceOf(Date);
      expect(session?.expiresInMs).toBe(24 * 60 * 60 * 1000);

      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'log',
        'Form-marv session created',
        'FormMarvSessionService.createSession',
        undefined,
        expect.objectContaining({
          secretKey,
          userId: expect.stringMatching(/^form-marv-temp-/),
          formId: providedFormId,
        }),
      );
    });

    it('should generate different formIds for different sessions', () => {
      const secretKey1 = service.createSession();
      const secretKey2 = service.createSession();

      const session1 = service.getSession(secretKey1);
      const session2 = service.getSession(secretKey2);

      expect(session1?.formId).not.toBe(session2?.formId);
      expect(session1?.formId).toMatch(/^[1-9]\d{5}$/);
      expect(session2?.formId).toMatch(/^[1-9]\d{5}$/);
    });
  });

  describe('getSession', () => {
    it('should return session when it exists and is not expired', () => {
      const secretKey = service.createSession();
      const session = service.getSession(secretKey);

      expect(session).toBeDefined();
      expect(session?.secretKey).toBe(secretKey);
      expect(session?.userId).toMatch(/^form-marv-temp-/);
      expect(session?.jwtToken).toBeDefined();
      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.lastActivityAt).toBeInstanceOf(Date);
      expect(session?.expiresInMs).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    it('should return null for non-existent session', () => {
      const session = service.getSession('non-existent-key');
      expect(session).toBeNull();
    });

    it('should update lastActivityAt when session is accessed', () => {
      const secretKey = service.createSession();
      const session1 = service.getSession(secretKey);
      const originalLastActivity = session1?.lastActivityAt;

      // Wait a bit to ensure time difference
      jest.advanceTimersByTime(1000);

      const session2 = service.getSession(secretKey);
      expect(session2?.lastActivityAt.getTime()).toBeGreaterThan(
        originalLastActivity!.getTime(),
      );
    });

    it('should return null for expired session', () => {
      const secretKey = service.createSession();

      // Mock the session to be expired by setting createdAt to 25 hours ago
      const session = service.getSession(secretKey);
      if (session) {
        session.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      }

      const expiredSession = service.getSession(secretKey);
      expect(expiredSession).toBeNull();

      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'log',
        'Form-marv session expired and removed',
        'FormMarvSessionService.getSession',
        undefined,
        { secretKey },
      );
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      // Create multiple sessions
      const secretKey1 = service.createSession();
      const secretKey2 = service.createSession();
      const secretKey3 = service.createSession();

      // Mock one session to be expired
      const session2 = service.getSession(secretKey2);
      if (session2) {
        session2.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      }

      // Mock another session to be expired
      const session3 = service.getSession(secretKey3);
      if (session3) {
        session3.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      }

      service.cleanupExpiredSessions();

      // Check that expired sessions are removed
      expect(service.getSession(secretKey1)).toBeDefined(); // Still valid
      expect(service.getSession(secretKey2)).toBeNull(); // Expired
      expect(service.getSession(secretKey3)).toBeNull(); // Expired

      expect(mockLogger.logWithContext).toHaveBeenCalledWith(
        'log',
        'Cleaned up expired form-marv sessions',
        'FormMarvSessionService.cleanupExpiredSessions',
        undefined,
        { expiredCount: 2 },
      );
    });

    it('should not log when no sessions are expired', () => {
      service.createSession();
      service.createSession();

      service.cleanupExpiredSessions();

      expect(mockLogger.logWithContext).not.toHaveBeenCalledWith(
        'log',
        'Cleaned up expired form-marv sessions',
        expect.any(String),
        undefined,
        expect.any(Object),
      );
    });
  });

  describe('getSessionStats', () => {
    it('should return correct session statistics', () => {
      // Create some sessions
      service.createSession();
      service.createSession();
      service.createSession();

      const stats = service.getSessionStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(3);
    });

    it('should count only active sessions when some are expired', () => {
      // Create sessions
      const secretKey1 = service.createSession();
      const secretKey2 = service.createSession();

      // Mock one session to be expired
      const session2 = service.getSession(secretKey2);
      if (session2) {
        session2.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      }

      const stats = service.getSessionStats();

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1);
    });
  });
});
