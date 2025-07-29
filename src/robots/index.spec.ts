import {
  // Abstract base classes
  AbstractRobot,
  AbstractRobotChat,
  AbstractRobotAgent,

  // Concrete robot implementations
  ChatRobotParrot,
  AgentRobotParrot,
  RobotChatOpenAI,
  RobotChatAnthropic,
  AnthropicMarv,
  MarvOpenAiAgent,
  SlackyOpenAiAgent,

  // Slack Agent implementations
  SlackAgentCoreFormsParrot,
  SlackAgentCoreFormsSsoAutofillParrot,

  // Services and Modules
  RobotService,
  RobotModule,
} from './index';

// Import types to ensure they're exported correctly
import type {
  TConversationTextMessage,
  TConversationTextMessageEnvelope,
} from './index';

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
    it('should export ChatRobotParrot', () => {
      expect(ChatRobotParrot).toBeDefined();
      expect(typeof ChatRobotParrot).toBe('function');
    });

    it('should export AgentRobotParrot', () => {
      expect(AgentRobotParrot).toBeDefined();
      expect(typeof AgentRobotParrot).toBe('function');
    });

    it('should export RobotChatOpenAI', () => {
      expect(RobotChatOpenAI).toBeDefined();
      expect(typeof RobotChatOpenAI).toBe('function');
    });

    it('should export RobotChatAnthropic', () => {
      expect(RobotChatAnthropic).toBeDefined();
      expect(typeof RobotChatAnthropic).toBe('function');
    });

    it('should export AnthropicMarv', () => {
      expect(AnthropicMarv).toBeDefined();
      expect(typeof AnthropicMarv).toBe('function');
    });

    it('should export MarvOpenAiAgent', () => {
      expect(MarvOpenAiAgent).toBeDefined();
      expect(typeof MarvOpenAiAgent).toBe('function');
    });

    it('should export SlackyOpenAiAgent', () => {
      expect(SlackyOpenAiAgent).toBeDefined();
      expect(typeof SlackyOpenAiAgent).toBe('function');
    });
  });

  describe('Slack Agent Implementations', () => {
    it('should export SlackAgentCoreFormsParrot', () => {
      expect(SlackAgentCoreFormsParrot).toBeDefined();
      expect(typeof SlackAgentCoreFormsParrot).toBe('function');
    });

    it('should export SlackAgentCoreFormsSsoAutofillParrot', () => {
      expect(SlackAgentCoreFormsSsoAutofillParrot).toBeDefined();
      expect(typeof SlackAgentCoreFormsSsoAutofillParrot).toBe('function');
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

  describe('Exported Types', () => {
    it('should export TConversationTextMessage type', () => {
      // TypeScript compilation test - if this compiles, the type is exported
      const testMessage: TConversationTextMessage = {
        messageId: 'test-id',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'test message',
        },
        created_at: new Date().toISOString(),
        estimated_token_count: 10,
      };
      expect(testMessage).toBeDefined();
      expect(testMessage.messageId).toBe('test-id');
      expect(testMessage.content.payload).toBe('test message');
    });

    it('should export TConversationTextMessageEnvelope type', () => {
      // TypeScript compilation test - if this compiles, the type is exported
      const testEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'envelope-id',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'test-id',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'test message',
          },
          created_at: new Date().toISOString(),
          estimated_token_count: 10,
        },
      };
      expect(testEnvelope).toBeDefined();
      expect(testEnvelope.messageId).toBe('envelope-id');
      expect(testEnvelope.envelopePayload.messageId).toBe('test-id');
    });
  });

  describe('Export Structure Validation', () => {
    it('should have all expected exports', () => {
      const expectedExports = [
        'AbstractRobot',
        'AbstractRobotChat',
        'AbstractRobotAgent',
        'ChatRobotParrot',
        'AgentRobotParrot',
        'RobotChatOpenAI',
        'RobotChatAnthropic',
        'AnthropicMarv',
        'MarvOpenAiAgent',
        'SlackyOpenAiAgent',
        'SlackAgentCoreFormsParrot',
        'SlackAgentCoreFormsSsoAutofillParrot',
        'RobotService',
        'RobotModule',
      ];

      expectedExports.forEach((exportName) => {
        expect(require('./index')).toHaveProperty(exportName);
      });
    });

    it('should export abstract classes as constructors', () => {
      const abstractClasses = [
        AbstractRobot,
        AbstractRobotChat,
        AbstractRobotAgent,
      ];

      abstractClasses.forEach((AbstractClass) => {
        expect(typeof AbstractClass).toBe('function');
        expect(AbstractClass.prototype).toBeDefined();
      });
    });

    it('should export concrete robot classes as constructors', () => {
      const concreteClasses = [
        ChatRobotParrot,
        AgentRobotParrot,
        RobotChatOpenAI,
        RobotChatAnthropic,
        AnthropicMarv,
        MarvOpenAiAgent,
        SlackyOpenAiAgent,
        SlackAgentCoreFormsParrot,
        SlackAgentCoreFormsSsoAutofillParrot,
      ];

      concreteClasses.forEach((ConcreteClass) => {
        expect(typeof ConcreteClass).toBe('function');
        expect(ConcreteClass.prototype).toBeDefined();
      });
    });
  });
});
