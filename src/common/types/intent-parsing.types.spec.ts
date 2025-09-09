import {
  IntentParsingResponse,
  IntentData,
  IntentParsingError,
  IntentParsingResult,
  RobotIntent,
  RobotIntentRegistry,
} from './intent-parsing.types';

describe('Intent Parsing Types', () => {
  describe('IntentData', () => {
    it('should allow basic intent data structure', () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Test prompt',
        subIntents: ['test1', 'test2'],
        subjects: {
          formId: ['123'],
          account: ['test-account'],
        },
      };

      expect(intentData.originalUserPrompt).toBe('Test prompt');
      expect(intentData.subIntents).toEqual(['test1', 'test2']);
      expect(intentData.subjects?.formId).toEqual(['123']);
      expect(intentData.subjects?.account).toEqual(['test-account']);
    });

    it('should allow additional robot-specific parameters', () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Test prompt',
        subIntents: ['test'],
        customRobotParam: 'custom value',
        anotherParam: { nested: 'data' },
      };

      expect(intentData.customRobotParam).toBe('custom value');
      expect(intentData.anotherParam).toEqual({ nested: 'data' });
    });

    it('should allow undefined subjects', () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Test prompt',
        subIntents: ['test'],
      };

      expect(intentData.subjects).toBeUndefined();
    });

    it('should allow extensible subjects with custom keys', () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Test prompt',
        subIntents: ['test'],
        subjects: {
          formId: ['123'],
          customSubject: ['custom1', 'custom2'],
        },
      };

      expect(intentData.subjects?.customSubject).toEqual([
        'custom1',
        'custom2',
      ]);
    });
  });

  describe('IntentParsingResponse', () => {
    it('should structure response correctly', () => {
      const response: IntentParsingResponse = {
        robotName: 'TestRobot',
        intent: 'testIntent',
        intentData: {
          originalUserPrompt: 'Test prompt',
          subIntents: ['sub1'],
          subjects: { formId: ['123'] },
        },
      };

      expect(response.robotName).toBe('TestRobot');
      expect(response.intent).toBe('testIntent');
      expect(response.intentData.originalUserPrompt).toBe('Test prompt');
    });
  });

  describe('IntentParsingError', () => {
    it('should structure error correctly', () => {
      const error: IntentParsingError = {
        error: 'Parsing failed',
        reason: 'Invalid input format',
      };

      expect(error.error).toBe('Parsing failed');
      expect(error.reason).toBe('Invalid input format');
    });
  });

  describe('IntentParsingResult', () => {
    it('should accept IntentParsingResponse', () => {
      const result: IntentParsingResult = {
        robotName: 'TestRobot',
        intent: 'testIntent',
        intentData: {
          originalUserPrompt: 'Test prompt',
          subIntents: ['sub1'],
        },
      };

      expect('robotName' in result).toBe(true);
      expect('error' in result).toBe(false);
    });

    it('should accept IntentParsingError', () => {
      const result: IntentParsingResult = {
        error: 'Parsing failed',
        reason: 'Invalid input format',
      };

      expect('error' in result).toBe(true);
      expect('robotName' in result).toBe(false);
    });
  });

  describe('RobotIntent', () => {
    it('should structure robot intent correctly', () => {
      const robotIntent: RobotIntent = {
        intent: 'debugForm',
        subIntents: ['checkFieldsLogic', 'checkFieldsCalculation'],
        requiredSubjects: ['formId'],
        description: 'Debug form functionality',
        priority: 1,
      };

      expect(robotIntent.intent).toBe('debugForm');
      expect(robotIntent.subIntents).toEqual([
        'checkFieldsLogic',
        'checkFieldsCalculation',
      ]);
      expect(robotIntent.requiredSubjects).toEqual(['formId']);
      expect(robotIntent.description).toBe('Debug form functionality');
      expect(robotIntent.priority).toBe(1);
    });

    it('should allow optional fields', () => {
      const robotIntent: RobotIntent = {
        intent: 'assistUser',
        subIntents: ['generalAssistance'],
      };

      expect(robotIntent.requiredSubjects).toBeUndefined();
      expect(robotIntent.description).toBeUndefined();
      expect(robotIntent.priority).toBeUndefined();
    });
  });

  describe('RobotIntentRegistry', () => {
    it('should structure robot registry correctly', () => {
      const registry: RobotIntentRegistry = {
        robotName: 'AnthropicMarv',
        supportedIntents: [
          {
            intent: 'debugForm',
            subIntents: ['checkFieldsLogic', 'checkFieldsCalculation'],
            requiredSubjects: ['formId'],
            description: 'Debug form functionality',
            priority: 1,
          },
          {
            intent: 'createForm',
            subIntents: ['createFormField'],
            description: 'Create new forms',
          },
        ],
      };

      expect(registry.robotName).toBe('AnthropicMarv');
      expect(registry.supportedIntents).toHaveLength(2);
      expect(registry.supportedIntents[0].intent).toBe('debugForm');
      expect(registry.supportedIntents[1].intent).toBe('createForm');
    });
  });
});
