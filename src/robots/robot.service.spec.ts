import { Test, TestingModule } from '@nestjs/testing';
import { RobotService } from './robot.service';
import { ChatRobotParrot } from './ChatRobotParrot';
import { AgentRobotParrot } from './AgentRobotParrot';
import { AbstractRobot } from './AbstractRobot';
import type { TConversationTextMessageEnvelope } from './types';

// Test robot class for testing purposes
class TestRobot extends AbstractRobot {
  public readonly name: string = 'TestRobot';
  public readonly version: string = '1.0.0';
  public readonly LLModelName: string = 'test-model';
  public readonly LLModelVersion: string = '1.0';
  public readonly contextWindowSizeInTokens: number = 1000;

  public acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (response: TConversationTextMessageEnvelope) => void,
  ): Promise<TConversationTextMessageEnvelope> {
    return Promise.resolve(messageEnvelope);
  }

  public estimateTokens(message: string): number {
    return Math.ceil(message.length / 4);
  }
}

describe('RobotService', () => {
  let service: RobotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RobotService],
    }).compile();

    service = module.get<RobotService>(RobotService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRobotByName', () => {
    it('should return a robot when given a valid name', () => {
      const robot = service.getRobotByName('ChatRobotParrot');
      expect(robot).toBeDefined();
      expect(robot).toBeInstanceOf(ChatRobotParrot);
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
      expect(names).toContain('ChatRobotParrot');
      expect(names).toContain('AgentRobotParrot');
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
      expect(service.hasRobot('ChatRobotParrot')).toBe(true);
      expect(service.hasRobot('AgentRobotParrot')).toBe(true);
    });

    it('should return false for non-existing robots', () => {
      expect(service.hasRobot('NonExistentRobot')).toBe(false);
    });
  });

  describe('getRobotsByClass', () => {
    it('should return robots filtered by class name', () => {
      const chatRobots = service.getRobotsByClass('ChatRobotParrot');
      expect(chatRobots.length).toBe(1);
      expect(chatRobots[0]).toBeInstanceOf(ChatRobotParrot);
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
      const duplicateRobot = new ChatRobotParrot();
      expect(() => service.registerRobot(duplicateRobot)).toThrow(
        "Robot with name 'ChatRobotParrot' already exists",
      );
    });

    it('should allow overwriting existing robot when overwrite is true', () => {
      const newRobot = new ChatRobotParrot();
      service.registerRobot(newRobot, true);
      expect(service.getRobotByName('ChatRobotParrot')).toBe(newRobot);
    });
  });

  describe('unregisterRobot', () => {
    it('should unregister an existing robot', () => {
      expect(service.hasRobot('ChatRobotParrot')).toBe(true);
      const result = service.unregisterRobot('ChatRobotParrot');
      expect(result).toBe(true);
      expect(service.hasRobot('ChatRobotParrot')).toBe(false);
    });

    it('should return false when unregistering non-existing robot', () => {
      const result = service.unregisterRobot('NonExistentRobot');
      expect(result).toBe(false);
    });
  });
});
