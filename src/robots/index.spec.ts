import {
  // Abstract base classes
  AbstractRobot,
  AbstractRobotChat,
  AbstractRobotAgent,

  // Concrete robot implementations
  AgentRobotParrot,
  AnthropicMarv,
  SlackyOpenAiAgent,

  // Services and Modules
  RobotService,
  RobotModule,
} from './index';

// Import types to ensure they're exported correctly
import type { TConversationTextMessage } from './index';

describe('robots/index', () => {
  describe('Abstract Base Classes', () => {
    it('should export AbstractRobot', () => {
      expect(AbstractRobot).toBeDefined();
      expect(typeof AbstractRobot).toBe('function');
    });

    it('should export AbstractRobotChat', () => {
      expect(AbstractRobotChat).toBeDefined();
      expect(typeof AbstractRobotChat).toBe('function');
    });

    it('should export AbstractRobotAgent', () => {
      expect(AbstractRobotAgent).toBeDefined();
      expect(typeof AbstractRobotAgent).toBe('function');
    });
  });

  describe('Concrete Robot Implementations', () => {
    it('should export AgentRobotParrot', () => {
      expect(AgentRobotParrot).toBeDefined();
      expect(typeof AgentRobotParrot).toBe('function');
    });

    it('should export AnthropicMarv', () => {
      expect(AnthropicMarv).toBeDefined();
      expect(typeof AnthropicMarv).toBe('function');
    });

    it('should export SlackyOpenAiAgent', () => {
      expect(SlackyOpenAiAgent).toBeDefined();
      expect(typeof SlackyOpenAiAgent).toBe('function');
    });
  });

  describe('Services and Modules', () => {
    it('should export RobotService', () => {
      expect(RobotService).toBeDefined();
      expect(typeof RobotService).toBe('function');
    });

    it('should export RobotModule', () => {
      expect(RobotModule).toBeDefined();
      expect(typeof RobotModule).toBe('function');
    });
  });

  describe('Types', () => {
    it('should export TConversationTextMessage type', () => {
      // This is a type, so we just check that the import doesn't fail
      expect(true).toBe(true);
    });
  });
});
