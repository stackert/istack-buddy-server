import { SlackyOpenAiAgent } from './SlackyOpenAiAgent';
import { IntentParsingService } from '../common/services/intent-parsing.service';
import {
  IntentParsingResult,
  IntentParsingResponse,
  IntentParsingError,
} from '../common/types/intent-parsing.types';

// Mock the IntentParsingService
jest.mock('../common/services/intent-parsing.service', () => {
  return {
    IntentParsingService: jest.fn().mockImplementation(() => ({
      parsePromptIntent: jest.fn(),
      registerRobotIntents: jest.fn(),
      getRegisteredIntents: jest.fn(),
    })),
  };
});

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

// Mock other dependencies
jest.mock('../common/logger/custom-logger.service', () => ({
  CustomLoggerService: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('SlackyOpenAiAgent - parsePromptIntent', () => {
  let slackyAgent: SlackyOpenAiAgent;
  let mockIntentParsingService: jest.Mocked<IntentParsingService>;

  beforeEach(() => {
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    // Clear mocks
    jest.clearAllMocks();

    // Create instance
    slackyAgent = new SlackyOpenAiAgent();

    // Get the mocked service
    mockIntentParsingService = (slackyAgent as any)
      .intentParsingService as jest.Mocked<IntentParsingService>;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('parsePromptIntent', () => {
    it('should delegate to IntentParsingService and return result', async () => {
      const expectedResult: IntentParsingResponse = {
        robotName: 'SlackyOpenAiAgent',
        intent: 'assistUser',
        intentData: {
          originalUserPrompt: 'Help me with my form',
          subIntents: ['generalAssistance'],
          subjects: { formId: ['123'] },
        },
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        expectedResult,
      );

      const result = await slackyAgent.parsePromptIntent(
        'Help me with my form',
      );

      expect(mockIntentParsingService.parsePromptIntent).toHaveBeenCalledWith(
        'Help me with my form',
        undefined,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should pass conversation context to IntentParsingService', async () => {
      const expectedResult: IntentParsingResponse = {
        robotName: 'AnthropicMarv',
        intent: 'debugForm',
        intentData: {
          originalUserPrompt: 'Debug form 456',
          subIntents: ['checkFieldsLogic'],
          subjects: { formId: ['456'] },
        },
      };

      const conversationContext = { currentRobot: 'AnthropicMarv' };
      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        expectedResult,
      );

      const result = await slackyAgent.parsePromptIntent(
        'Debug form 456',
        conversationContext,
      );

      expect(mockIntentParsingService.parsePromptIntent).toHaveBeenCalledWith(
        'Debug form 456',
        conversationContext,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should return error result when IntentParsingService returns error', async () => {
      const expectedError: IntentParsingError = {
        error: 'Parsing failed',
        reason: 'Invalid input format',
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        expectedError,
      );

      const result = await slackyAgent.parsePromptIntent('Invalid message');

      expect(result).toEqual(expectedError);
      expect('error' in result).toBe(true);
    });

    it('should handle IntentParsingService throwing exception', async () => {
      mockIntentParsingService.parsePromptIntent.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        slackyAgent.parsePromptIntent('Test message'),
      ).rejects.toThrow('Service error');
    });

    it('should log debug message with truncated message', async () => {
      const longMessage = 'A'.repeat(100);
      const expectedResult: IntentParsingResponse = {
        robotName: 'SlackyOpenAiAgent',
        intent: 'assistUser',
        intentData: {
          originalUserPrompt: longMessage,
          subIntents: ['generalAssistance'],
          subjects: {},
        },
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        expectedResult,
      );

      await slackyAgent.parsePromptIntent(longMessage);

      // Verify the logger was called (we can't easily test the exact content due to mocking)
      const mockLogger = (slackyAgent as any).logger;
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle different intent parsing result types', async () => {
      // Test with different robot names and intents
      const testCases: IntentParsingResponse[] = [
        {
          robotName: 'AnthropicMarv',
          intent: 'debugForm',
          intentData: {
            originalUserPrompt: 'Debug my form',
            subIntents: ['checkFieldsLogic', 'checkFieldsCalculation'],
            subjects: { formId: ['123'], submissionId: ['456'] },
          },
        },
        {
          robotName: 'KnobbyOpenAiSearch',
          intent: 'searchKnowledge',
          intentData: {
            originalUserPrompt: 'Search for SSO documentation',
            subIntents: ['findContextDocumentHelpArticleSso'],
            subjects: { account: ['test-account'] },
          },
        },
        {
          robotName: 'SlackyOpenAiAgent',
          intent: 'assistUser',
          intentData: {
            originalUserPrompt: 'General help request',
            subIntents: ['generalAssistance', 'conversation'],
            subjects: {},
          },
        },
      ];

      for (const testCase of testCases) {
        mockIntentParsingService.parsePromptIntent.mockResolvedValue(testCase);

        const result = await slackyAgent.parsePromptIntent(
          testCase.intentData.originalUserPrompt,
        );

        expect(result).toEqual(testCase);
        expect('robotName' in result).toBe(true);
        if ('robotName' in result) {
          const response = result as IntentParsingResponse;
          expect(response.robotName).toBe(testCase.robotName);
          expect(response.intent).toBe(testCase.intent);
        }
      }
    });

    it('should handle empty and edge case messages', async () => {
      const edgeCases = ['', ' ', '\n', '\t', 'a', '?'];

      for (const message of edgeCases) {
        const expectedResult: IntentParsingResponse = {
          robotName: 'SlackyOpenAiAgent',
          intent: 'assistUser',
          intentData: {
            originalUserPrompt: message,
            subIntents: ['clarifyRequest'],
            subjects: {},
          },
        };

        mockIntentParsingService.parsePromptIntent.mockResolvedValue(
          expectedResult,
        );

        const result = await slackyAgent.parsePromptIntent(message);

        expect(mockIntentParsingService.parsePromptIntent).toHaveBeenCalledWith(
          message,
          undefined,
        );
        expect(result).toEqual(expectedResult);
      }
    });
  });
});
