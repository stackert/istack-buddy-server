import { Test, TestingModule } from '@nestjs/testing';
import { IntentParsingService } from './intent-parsing.service';
import {
  IntentParsingResult,
  IntentParsingResponse,
  IntentParsingError,
  RobotIntentRegistry,
} from '../types/intent-parsing.types';

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => mockOpenAI),
  };
});

describe('IntentParsingService', () => {
  let service: IntentParsingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IntentParsingService],
    }).compile();

    service = module.get<IntentParsingService>(IntentParsingService);

    // Clear mocks
    jest.clearAllMocks();

    // Set up environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('registerRobotIntents', () => {
    it('should register new robot intents', () => {
      const registry: RobotIntentRegistry = {
        robotName: 'TestRobot',
        supportedIntents: [
          {
            intent: 'testIntent',
            subIntents: ['sub1', 'sub2'],
            description: 'Test intent',
          },
        ],
      };

      service.registerRobotIntents(registry);
      const registered = service.getRegisteredIntents();

      expect(registered).toHaveLength(1);
      expect(registered[0].robotName).toBe('TestRobot');
      expect(registered[0].supportedIntents[0].intent).toBe('testIntent');
    });

    it('should update existing robot intents', () => {
      const initialRegistry: RobotIntentRegistry = {
        robotName: 'TestRobot',
        supportedIntents: [
          {
            intent: 'oldIntent',
            subIntents: ['old1'],
          },
        ],
      };

      const updatedRegistry: RobotIntentRegistry = {
        robotName: 'TestRobot',
        supportedIntents: [
          {
            intent: 'newIntent',
            subIntents: ['new1', 'new2'],
          },
        ],
      };

      service.registerRobotIntents(initialRegistry);
      service.registerRobotIntents(updatedRegistry);

      const registered = service.getRegisteredIntents();
      expect(registered).toHaveLength(1);
      expect(registered[0].supportedIntents[0].intent).toBe('newIntent');
      expect(registered[0].supportedIntents[0].subIntents).toEqual([
        'new1',
        'new2',
      ]);
    });

    it('should register multiple different robots', () => {
      const registry1: RobotIntentRegistry = {
        robotName: 'Robot1',
        supportedIntents: [{ intent: 'intent1', subIntents: ['sub1'] }],
      };

      const registry2: RobotIntentRegistry = {
        robotName: 'Robot2',
        supportedIntents: [{ intent: 'intent2', subIntents: ['sub2'] }],
      };

      service.registerRobotIntents(registry1);
      service.registerRobotIntents(registry2);

      const registered = service.getRegisteredIntents();
      expect(registered).toHaveLength(2);
      expect(registered.find((r) => r.robotName === 'Robot1')).toBeDefined();
      expect(registered.find((r) => r.robotName === 'Robot2')).toBeDefined();
    });
  });

  describe('parsePromptIntent', () => {
    it('should successfully parse intent with valid OpenAI response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'debugForm',
                intentData: {
                  originalUserPrompt: 'Debug my form',
                  subIntents: ['checkFieldsLogic'],
                  subjects: { formId: ['123'] },
                  isConversationContinuation: false,
                  conversationId: 'test-conversation',
                },
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parsePromptIntent('Debug my form');

      expect('intent' in result).toBe(true);
      if ('intent' in result) {
        const response = result as IntentParsingResponse;
        expect(response.intent).toBe('debugForm');
        expect(response.intentData.originalUserPrompt).toBe('Debug my form');
        expect(response.intentData.subIntents).toEqual(['checkFieldsLogic']);
        expect(response.intentData.subjects?.formId).toEqual(['123']);
      }
    });

    it('should handle empty OpenAI response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parsePromptIntent('Test message');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        const error = result as IntentParsingError;
        expect(error.error).toBe('No response from AI');
        expect(error.reason).toBe('Empty response from OpenAI');
      }
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Invalid JSON response',
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parsePromptIntent('Test message');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        const error = result as IntentParsingError;
        expect(error.error).toBe('AI execution failed');
        expect(error.reason).toBe(
          'Unexpected token \'I\', "Invalid JS"... is not valid JSON',
        );
      }
    });

    it('should handle response missing required fields', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'testIntent',
                intentData: {
                  originalUserPrompt: 'Test message',
                  subIntents: [],
                  subjects: {},
                  isConversationContinuation: false,
                  conversationId: 'test-conversation',
                },
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parsePromptIntent('Test message');

      expect('intent' in result).toBe(true);
      if ('intent' in result) {
        const response = result as IntentParsingResponse;
        expect(response.intent).toBe('testIntent');
        expect(response.intentData.originalUserPrompt).toBe('Test message');
      }
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API Error'),
      );

      const result = await service.parsePromptIntent('Test message');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        const error = result as IntentParsingError;
        expect(error.error).toBe('AI execution failed');
        expect(error.reason).toBe('API Error');
      }
    });

    it('should include conversation context in OpenAI call', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                robotName: 'SlackyOpenAiAgent',
                intent: 'assistUser',
                intentData: {
                  originalUserPrompt: 'Help me',
                  subIntents: ['generalAssistance'],
                  subjects: {},
                },
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await service.parsePromptIntent('Help me', {
        currentRobot: 'SlackyOpenAiAgent',
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(
                'Previous robot name: undefined',
              ),
            }),
          ]),
          temperature: 0.1,
          max_tokens: 1000,
        }),
      );
    });

    it('should ensure intentData has required fields even if missing from OpenAI', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'testIntent',
                intentData: {
                  originalUserPrompt: 'Test message',
                  subIntents: [],
                  subjects: {},
                  isConversationContinuation: false,
                  conversationId: 'test-conversation',
                },
              }),
            },
          },
        ],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parsePromptIntent('Test message');

      expect('intent' in result).toBe(true);
      if ('intent' in result) {
        const response = result as IntentParsingResponse;
        expect(response.intentData.originalUserPrompt).toBe('Test message');
        expect(response.intentData.subIntents).toEqual([]);
        expect(response.intentData.subjects).toEqual({});
      }
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build system prompt with registered robot intents', () => {
      // Register some test robots
      service.registerRobotIntents({
        robotName: 'Robot1',
        supportedIntents: [
          {
            intent: 'intent1',
            subIntents: ['sub1', 'sub2'],
            description: 'First intent',
          },
        ],
      });

      service.registerRobotIntents({
        robotName: 'Robot2',
        supportedIntents: [
          {
            intent: 'intent2',
            subIntents: ['sub3'],
            description: 'Second intent',
          },
        ],
      });

      // Use public method
      const systemPrompt = service.buildPrompt('Test message');

      expect(systemPrompt).toContain('Intent Parsing System Prompt');
      expect(systemPrompt).toContain('Test message');
      expect(systemPrompt).toContain('Available Intents');
    });

    it('should handle no registered robots', () => {
      const systemPrompt = service.buildPrompt('Test message');

      expect(systemPrompt).toContain('Intent Parsing System Prompt');
      expect(systemPrompt).toContain('Test message');
    });
  });

  describe('getRegisteredIntents', () => {
    it('should return empty array initially', () => {
      const registered = service.getRegisteredIntents();
      expect(registered).toEqual([]);
    });

    it('should return copy of registered intents', () => {
      const registry: RobotIntentRegistry = {
        robotName: 'TestRobot',
        supportedIntents: [{ intent: 'test', subIntents: ['sub'] }],
      };

      service.registerRobotIntents(registry);
      const registered1 = service.getRegisteredIntents();
      const registered2 = service.getRegisteredIntents();

      expect(registered1).not.toBe(registered2); // Different instances
      expect(registered1).toEqual(registered2); // Same content
    });
  });
});
