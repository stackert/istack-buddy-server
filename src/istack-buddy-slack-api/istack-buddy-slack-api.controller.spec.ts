import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiController } from './istack-buddy-slack-api.controller';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ConversationListServiceModule } from '../ConversationLists';
import { RobotModule } from '../robots/robot.module';
import { ChatManagerModule } from '../chat-manager/chat-manager.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { LoggerModule } from '../common/logger/logger.module';

describe('IstackBuddySlackApiController', () => {
  let controller: IstackBuddySlackApiController;

  beforeEach(async () => {
    // Clear all timers and mock setInterval to prevent hanging tests
    jest.clearAllTimers();
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval').mockImplementation(
      () =>
        ({
          unref: jest.fn(),
          ref: jest.fn(),
          hasRef: jest.fn().mockReturnValue(false),
          refresh: jest.fn(),
          [Symbol.toPrimitive]: jest.fn(),
          [Symbol.dispose]: jest.fn(),
        }) as any,
    );

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConversationListServiceModule,
        RobotModule,
        ChatManagerModule,
        AuthenticationModule,
        LoggerModule,
      ],
      controllers: [IstackBuddySlackApiController],
      providers: [IstackBuddySlackApiService],
    }).compile();

    controller = module.get<IstackBuddySlackApiController>(
      IstackBuddySlackApiController,
    );
  });

  afterEach(() => {
    // Clear all timers and restore original functions
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status with timestamp', () => {
      const result = controller.getHealth();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('should return current timestamp', () => {
      const before = new Date();
      const result = controller.getHealth();
      const after = new Date();

      const resultTime = new Date(result.timestamp).getTime();
      expect(resultTime).toBeGreaterThanOrEqual(before.getTime());
      expect(resultTime).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information with Slack configuration status', () => {
      const result = controller.getDebugInfo();

      expect(result).toHaveProperty('slackConfigured');
      expect(typeof result.slackConfigured).toBe('boolean');
      expect(result).toHaveProperty('endpoints');
      expect(Array.isArray(result.endpoints)).toBe(true);
      expect(result).toHaveProperty('environment');
      expect(typeof result.environment).toBe('object');
    });

    it('should include correct endpoints', () => {
      const result = controller.getDebugInfo();

      expect(result.endpoints).toContain(
        'GET /istack-buddy/slack-integration/health',
      );
      expect(result.endpoints).toContain(
        'GET /istack-buddy/slack-integration/debug',
      );
      expect(result.endpoints).toContain(
        'POST /istack-buddy/slack-integration/slack/events (Slack Events API)',
      );
    });

    it('should include environment variables', () => {
      const result = controller.getDebugInfo();

      expect(result.environment).toHaveProperty('SLACK_BOT_TOKEN_SET');
      expect(result.environment).toHaveProperty('SLACK_SIGNING_SECRET_SET');
      expect(result.environment).toHaveProperty('PORT');
      expect(typeof result.environment.SLACK_BOT_TOKEN_SET).toBe('boolean');
      expect(typeof result.environment.SLACK_SIGNING_SECRET_SET).toBe(
        'boolean',
      );
    });

    it('should correctly detect Slack configuration', () => {
      // Test with environment variables set
      const originalToken = process.env.SLACK_BOT_TOKEN;
      const originalSecret = process.env.SLACK_SIGNING_SECRET;

      process.env.SLACK_BOT_TOKEN = 'test-token';
      process.env.SLACK_SIGNING_SECRET = 'test-secret';

      const result = controller.getDebugInfo();
      expect(result.slackConfigured).toBe(true);

      // Restore original values
      if (originalToken) {
        process.env.SLACK_BOT_TOKEN = originalToken;
      } else {
        delete process.env.SLACK_BOT_TOKEN;
      }
      if (originalSecret) {
        process.env.SLACK_SIGNING_SECRET = originalSecret;
      } else {
        delete process.env.SLACK_SIGNING_SECRET;
      }
    });

    it('should detect missing Slack configuration', () => {
      // Test with environment variables not set
      const originalToken = process.env.SLACK_BOT_TOKEN;
      const originalSecret = process.env.SLACK_SIGNING_SECRET;

      delete process.env.SLACK_BOT_TOKEN;
      delete process.env.SLACK_SIGNING_SECRET;

      const result = controller.getDebugInfo();
      expect(result.slackConfigured).toBe(false);

      // Restore original values
      if (originalToken) {
        process.env.SLACK_BOT_TOKEN = originalToken;
      }
      if (originalSecret) {
        process.env.SLACK_SIGNING_SECRET = originalSecret;
      }
    });

    it('should handle partial Slack configuration', () => {
      // Test with only one environment variable set
      const originalToken = process.env.SLACK_BOT_TOKEN;
      const originalSecret = process.env.SLACK_SIGNING_SECRET;

      process.env.SLACK_BOT_TOKEN = 'test-token';
      delete process.env.SLACK_SIGNING_SECRET;

      const result = controller.getDebugInfo();
      expect(result.slackConfigured).toBe(false);
      expect(result.environment.SLACK_BOT_TOKEN_SET).toBe(true);
      expect(result.environment.SLACK_SIGNING_SECRET_SET).toBe(false);

      // Restore original values
      if (originalToken) {
        process.env.SLACK_BOT_TOKEN = originalToken;
      } else {
        delete process.env.SLACK_BOT_TOKEN;
      }
      if (originalSecret) {
        process.env.SLACK_SIGNING_SECRET = originalSecret;
      }
    });
  });

  describe('handleSlackEvents', () => {
    it('should delegate to service handleSlackEvent method', async () => {
      const mockService = {
        handleSlackEvent: jest.fn().mockResolvedValue(undefined),
      };

      const module = await Test.createTestingModule({
        imports: [AuthenticationModule, LoggerModule],
        controllers: [IstackBuddySlackApiController],
        providers: [
          {
            provide: IstackBuddySlackApiService,
            useValue: mockService,
          },
        ],
      }).compile();

      const testController = module.get<IstackBuddySlackApiController>(
        IstackBuddySlackApiController,
      );

      const mockReq = { body: { event: {} } };
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await testController.handleSlackEvents(mockReq as any, mockRes as any);

      expect(mockService.handleSlackEvent).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });
});
