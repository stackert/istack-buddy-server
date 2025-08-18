import { Test, TestingModule } from '@nestjs/testing';
import { RobotService } from './robot.service';
import { AgentRobotParrot } from './AgentRobotParrot';
import { AbstractRobot } from './AbstractRobot';
import type { TConversationMessageContentString } from './types';
import type { IConversationMessage } from '../chat-manager/interfaces/message.interface';

// Test robot class for testing purposes
class TestRobot extends AbstractRobot {
  public readonly name: string = 'TestRobot';
  public readonly version: string = '1.0.0';
  public readonly LLModelName: string = 'test-model';
  public readonly LLModelVersion: string = '1.0';
  public readonly contextWindowSizeInTokens: number = 1000;

  public acceptMessageMultiPartResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    delayedMessageCallback: (
      response: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      >,
    ) => void,
  ): Promise<TConversationMessageContentString> {
    const response = { type: 'text/plain' as const, payload: 'test response' };
    delayedMessageCallback({ content: response });
    return Promise.resolve(response);
  }

  public estimateTokens(message: string): number {
    return Math.ceil(message.length / 4);
  }
}

describe('RobotService', () => {
  let service: RobotService;
  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RobotService],
    }).compile();

    service = module.get<RobotService>(RobotService);
    await service.onModuleInit();
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Normal Robot Initialization', () => {
    it('should initialize with real robots when USE_FAKE_PARROT_ROBOT is not set', () => {
      // Ensure the environment variable is not set
      delete process.env.USE_FAKE_PARROT_ROBOT;

      const robot = service.getRobotByName('AgentRobotParrot');
      expect(robot).toBeDefined();
      expect(robot).toBeInstanceOf(AgentRobotParrot);
    });

    it('should have correct robot types for all registered robots', () => {
      delete process.env.USE_FAKE_PARROT_ROBOT;

      expect(service.getRobotByName('AgentRobotParrot')).toBeInstanceOf(
        AgentRobotParrot,
      );
      expect(service.getRobotByName('AnthropicMarv')).toBeDefined();
      expect(service.getRobotByName('SlackyOpenAiAgent')).toBeDefined();
    });
  });

  describe('Fake Robot Mode (USE_FAKE_PARROT_ROBOT)', () => {
    it('should use AgentRobotParrot for all robots when USE_FAKE_PARROT_ROBOT is set', async () => {
      // Set the environment variable
      process.env.USE_FAKE_PARROT_ROBOT = 'true';

      // Create a new service instance to trigger the fake robot initialization
      const module: TestingModule = await Test.createTestingModule({
        providers: [RobotService],
      }).compile();

      const fakeService = module.get<RobotService>(RobotService);
      await fakeService.onModuleInit();

      // All robots should be AgentRobotParrot instances
      const agentRobot = fakeService.getRobotByName('AgentRobotParrot');
      const anthropicRobot = fakeService.getRobotByName('AnthropicMarv');
      const slackyRobot = fakeService.getRobotByName('SlackyOpenAiAgent');

      expect(agentRobot).toBeInstanceOf(AgentRobotParrot);
      expect(anthropicRobot).toBeInstanceOf(AgentRobotParrot);
      expect(slackyRobot).toBeInstanceOf(AgentRobotParrot);
    });
  });

  describe('getRobotByName', () => {
    it('should return a robot when given a valid name', () => {
      const robot = service.getRobotByName('AgentRobotParrot');
      expect(robot).toBeDefined();
      expect(robot).toBeInstanceOf(AgentRobotParrot);
    });

    it('should return undefined when given an invalid name', () => {
      const robot = service.getRobotByName('NonExistentRobot');
      expect(robot).toBeUndefined();
    });
  });

  describe('getAvailableRobotNames', () => {
    it('should return an array of robot names', () => {
      const names = service.getAvailableRobotNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('AgentRobotParrot');
      expect(names).toContain('AnthropicMarv');
      expect(names).toContain('SlackyOpenAiAgent');
    });
  });

  describe('getAllRobots', () => {
    it('should return an array of robot instances', () => {
      const robots = service.getAllRobots();
      expect(Array.isArray(robots)).toBe(true);
      expect(robots.length).toBeGreaterThan(0);
      robots.forEach((robot) => {
        expect(robot).toHaveProperty('name');
        expect(robot).toHaveProperty('version');
      });
    });
  });

  describe('hasRobot', () => {
    it('should return true for existing robots', () => {
      expect(service.hasRobot('AgentRobotParrot')).toBe(true);
      expect(service.hasRobot('AnthropicMarv')).toBe(true);
      expect(service.hasRobot('SlackyOpenAiAgent')).toBe(true);
    });

    it('should return false for non-existing robots', () => {
      expect(service.hasRobot('NonExistentRobot')).toBe(false);
    });
  });

  describe('getRobotsByClass', () => {
    it('should return robots filtered by class name', () => {
      const agentRobots = service.getRobotsByClass('AgentRobotParrot');
      expect(agentRobots.length).toBe(1);
      expect(agentRobots[0]).toBeInstanceOf(AgentRobotParrot);
    });

    it('should return empty array for non-matching class', () => {
      const robots = service.getRobotsByClass('NonExistentRobotClass');
      expect(robots).toEqual([]);
    });
  });

  describe('registerRobot', () => {
    it('should register a new robot', () => {
      const newRobot = new TestRobot();

      service.registerRobot(newRobot);
      expect(service.hasRobot('TestRobot')).toBe(true);
      expect(service.getRobotByName('TestRobot')).toBe(newRobot);
    });

    it('should throw error when registering duplicate robot without overwrite', () => {
      const duplicateRobot = new AgentRobotParrot();
      expect(() => service.registerRobot(duplicateRobot)).toThrow(
        "Robot with name 'AgentRobotParrot' already exists",
      );
    });

    it('should allow overwriting existing robot when overwrite is true', () => {
      const newRobot = new AgentRobotParrot();
      service.registerRobot(newRobot, true);
      expect(service.getRobotByName('AgentRobotParrot')).toBe(newRobot);
    });
  });

  describe('unregisterRobot', () => {
    it('should unregister an existing robot', () => {
      expect(service.hasRobot('AgentRobotParrot')).toBe(true);
      const result = service.unregisterRobot('AgentRobotParrot');
      expect(result).toBe(true);
      expect(service.hasRobot('AgentRobotParrot')).toBe(false);
    });

    it('should return false when unregistering non-existing robot', () => {
      const result = service.unregisterRobot('NonExistentRobot');
      expect(result).toBe(false);
    });
  });
});
