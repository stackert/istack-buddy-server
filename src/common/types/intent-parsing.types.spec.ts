import {
  IntentParsingResponse,
  IntentData,
  IntentParsingError,
  IntentParsingResult,
  isIntentParsingError,
  RobotIntent,
  RobotIntentRegistry,
  PreviousConversationContext,
} from './intent-parsing.types';

describe('IntentParsingResponse', () => {
  it('should create a valid IntentParsingResponse', () => {
    const response: IntentParsingResponse = {
      intent: 'generateSumoReport',
      intentData: {
        conversationId: 'conv-123',
        originalUserPrompt: 'Show me form submissions',
        subIntents: ['submissionCreatedForForm'],
        isConversationContinuation: false,
        subjects: {
          formId: ['12345'],
        },
        dateRange: {
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-31T23:59:59Z',
        },
      },
      devDebugRecommendedExecutor: 'SumoReportSingleJobExecutor',
      devDebugRecommendedRobot: 'SlackyOpenAiAgent',
    };

    expect(response.intent).toBe('generateSumoReport');
    expect(response.intentData.conversationId).toBe('conv-123');
    expect(response.intentData.originalUserPrompt).toBe(
      'Show me form submissions',
    );
    expect(response.intentData.subIntents).toEqual([
      'submissionCreatedForForm',
    ]);
    expect(response.intentData.isConversationContinuation).toBe(false);
    expect(response.intentData.subjects?.formId).toEqual(['12345']);
    expect(response.intentData.dateRange?.startDate).toBe(
      '2023-01-01T00:00:00Z',
    );
    expect(response.intentData.dateRange?.endDate).toBe('2023-01-31T23:59:59Z');
    expect(response.devDebugRecommendedExecutor).toBe(
      'SumoReportSingleJobExecutor',
    );
    expect(response.devDebugRecommendedRobot).toBe('SlackyOpenAiAgent');
  });
});

describe('IntentData', () => {
  it('should create IntentData with minimal required fields', () => {
    const intentData: IntentData = {
      conversationId: 'conv-123',
      originalUserPrompt: 'Hello',
      subIntents: ['generalAssistance'],
      isConversationContinuation: false,
    };

    expect(intentData.conversationId).toBe('conv-123');
    expect(intentData.originalUserPrompt).toBe('Hello');
    expect(intentData.subIntents).toEqual(['generalAssistance']);
    expect(intentData.isConversationContinuation).toBe(false);
    expect(intentData.subjects).toBeUndefined();
    expect(intentData.dateRange).toBeUndefined();
  });

  it('should create IntentData with all optional fields', () => {
    const intentData: IntentData = {
      conversationId: 'conv-123',
      originalUserPrompt: 'Show me form submissions',
      subIntents: ['submissionCreatedForForm'],
      isConversationContinuation: true,
      subjects: {
        formId: ['12345', '67890'],
        submissionId: ['sub-1'],
        submitActionId: ['action-1'],
        submitActionType: ['Salesforce'],
        accountId: ['acc-1'],
        authProviderId: ['auth-1'],
        case: ['case-1'],
        jira: ['PROJ-123'],
        customField: ['custom-value'],
      },
      dateRange: {
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-31T23:59:59Z',
      },
      customProperty: 'custom-value',
    };

    expect(intentData.conversationId).toBe('conv-123');
    expect(intentData.subjects?.formId).toEqual(['12345', '67890']);
    expect(intentData.subjects?.customField).toEqual(['custom-value']);
    expect(intentData.dateRange?.startDate).toBe('2023-01-01T00:00:00Z');
    expect(intentData.customProperty).toBe('custom-value');
  });
});

describe('IntentParsingError', () => {
  it('should create a valid IntentParsingError', () => {
    const error: IntentParsingError = {
      error: 'AI execution failed',
      reason: 'Invalid JSON response',
    };

    expect(error.error).toBe('AI execution failed');
    expect(error.reason).toBe('Invalid JSON response');
  });
});

describe('isIntentParsingError', () => {
  it('should return true for IntentParsingError', () => {
    const error: IntentParsingError = {
      error: 'AI execution failed',
      reason: 'Invalid JSON response',
    };

    expect(isIntentParsingError(error)).toBe(true);
  });

  it('should return false for IntentParsingResponse', () => {
    const response: IntentParsingResponse = {
      intent: 'generateSumoReport',
      intentData: {
        conversationId: 'conv-123',
        originalUserPrompt: 'Show me form submissions',
        subIntents: ['submissionCreatedForForm'],
        isConversationContinuation: false,
      },
    };

    expect(isIntentParsingError(response)).toBe(false);
  });
});

describe('RobotIntent', () => {
  it('should create a RobotIntent with all properties', () => {
    const robotIntent: RobotIntent = {
      intent: 'generateSumoReport',
      subIntents: ['submissionCreatedForForm', 'submitActionReport'],
      requiredSubjects: ['formId'],
      description: 'Generate Sumo Logic reports',
      priority: 1,
    };

    expect(robotIntent.intent).toBe('generateSumoReport');
    expect(robotIntent.subIntents).toEqual([
      'submissionCreatedForForm',
      'submitActionReport',
    ]);
    expect(robotIntent.requiredSubjects).toEqual(['formId']);
    expect(robotIntent.description).toBe('Generate Sumo Logic reports');
    expect(robotIntent.priority).toBe(1);
  });

  it('should create a RobotIntent with minimal properties', () => {
    const robotIntent: RobotIntent = {
      intent: 'assistUser',
      subIntents: ['generalAssistance'],
    };

    expect(robotIntent.intent).toBe('assistUser');
    expect(robotIntent.subIntents).toEqual(['generalAssistance']);
    expect(robotIntent.requiredSubjects).toBeUndefined();
    expect(robotIntent.description).toBeUndefined();
    expect(robotIntent.priority).toBeUndefined();
  });
});

describe('RobotIntentRegistry', () => {
  it('should create a RobotIntentRegistry', () => {
    const registry: RobotIntentRegistry = {
      robotName: 'SlackyOpenAiAgent',
      supportedIntents: [
        {
          intent: 'generateSumoReport',
          subIntents: ['submissionCreatedForForm'],
          requiredSubjects: ['formId'],
          description: 'Generate Sumo Logic reports',
          priority: 1,
        },
        {
          intent: 'assistUser',
          subIntents: ['generalAssistance'],
        },
      ],
    };

    expect(registry.robotName).toBe('SlackyOpenAiAgent');
    expect(registry.supportedIntents).toHaveLength(2);
    expect(registry.supportedIntents[0].intent).toBe('generateSumoReport');
    expect(registry.supportedIntents[1].intent).toBe('assistUser');
  });
});

describe('PreviousConversationContext', () => {
  it('should create PreviousConversationContext with all properties', () => {
    const context: PreviousConversationContext = {
      lastRobotMessageText: 'I found 5 form submissions',
      lastIntent: {
        intent: 'generateSumoReport',
        intentData: {
          conversationId: 'conv-123',
          originalUserPrompt: 'Show me form submissions',
          subIntents: ['submissionCreatedForForm'],
          isConversationContinuation: false,
        },
      },
    };

    expect(context.lastRobotMessageText).toBe('I found 5 form submissions');
    expect(context.lastIntent?.intent).toBe('generateSumoReport');
    expect(context.lastIntent?.intentData.conversationId).toBe('conv-123');
  });

  it('should create PreviousConversationContext with minimal properties', () => {
    const context: PreviousConversationContext = {};

    expect(context.lastRobotMessageText).toBeUndefined();
    expect(context.lastIntent).toBeUndefined();
  });
});
