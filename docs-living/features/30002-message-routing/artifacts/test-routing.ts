import { config } from 'dotenv';
import { join } from 'path';
import { IntentParsingService } from '../../../../src/common/services/intent-parsing.service';
import { IntentParsingResult } from '../../../../src/common/types/intent-parsing.types';

// Load environment variables from .env.live (same as server)
config({ path: join(process.cwd(), '.env.live') });

// Main execution - run all tests
async function runAllTests() {
  console.log('Starting Intent Parsing Test Suite...\n');

  // Uncomment the scenario you want to test
  await testGeneralAssistanceNewConversation();
  //   await testGeneralAssistancePreviousConversation();
  //   await testGenerateSumoReportNewConversation();
  //   await testGenerateSumoReportPreviousConversation();
  //   await testSearchKnowledgeBaseNewConversation();
  //   await testSearchKnowledgeBasePreviousConversation();
  //   await testGetContextDynamicNewConversation();
  //   await testGetContextDynamicPreviousConversation();
  //   await testSubjectMergingContinuation();
  //   await testSubjectMergingWithNewSubjects();
  //   await testSumSubmissionThenDynamicContext();

  console.log('\nTest suite completed!');
}

/**
 * Test script for message routing functionality
 *
 * This script demonstrates how the routing system works by:
 * 1. Setting up the intent parsing service
 * 2. Testing 8 different routing scenarios
 * 3. Showing the intent parsing results
 *
 * Run from project root: npx ts-node docs-living/features/30002-message-routing/artifacts/test-routing.ts
 *
 * Note: Uses the same .env.live file as the server for environment variables.
 */

const intentParsingService = new IntentParsingService();

// Test Scenario 9: Subject Merging for Continuation (No New Subjects)
async function testSubjectMergingContinuation() {
  console.log(
    '\n=== Scenario 9: Subject Merging for Continuation (No New Subjects) ===',
  );
  const message =
    'Now I would like you to use that to search for anything related';
  //  const message = 'I need that same report for form 99099';
  const previousContext = {
    previousRobot: 'SlackyOpenAiAgent',
    lastRobotMessageText:
      'Here is your submissions report for form 5375703 from the past 36 hours.',
    lastIntent: {
      intent: 'generateSumoReport',
      intentData: {
        conversationId: 'test-conversation-subject-merge',
        originalUserPrompt: 'I need the same report for weekending September 1',
        subIntents: ['submissionCreatedForForm'],
        subjects: { formId: ['5375703'] },
        dateRange: {
          startDate: '2025-09-19T00:00:00-04:00',
          endDate: '2025-09-21T23:59:59-04:00',
        },
        isConversationContinuation: false,
      },
    },
  };

  const promptText = intentParsingService.buildPrompt(message, previousContext);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify(
      { scenario: 'subjectMerging-continuation', result },
      null,
      2,
    ),
  );
}

async function testSumSubmissionThenDynamicContext() {
  console.log('\n=== testSumSubmissionThenDynamicContext ===');
  // iStackBuddyChatApp - now can you get me the dynamic context
  const message = 'now can you get me the dynamic context';
  //  const message = 'I need that same report for form 99099';
  const previousContext = {
    lastRobotMessageText:
      'Here is your submissions report for form 5375703 from the past 36 hours.',
    lastIntent: {
      intent: 'generateSumoReport',
      intentData: {
        conversationId: 'test-conversation-subject-merge',
        originalUserPrompt:
          'I need a SubmitAction analysis for form 5894350 and submitAction type - "default"',
        subIntents: ['submitActionReport'],
        subjects: { formId: ['5894350'] },
        dateRange: {
          startDate: '2025-09-19T00:00:00-04:00',
          endDate: '2025-09-21T23:59:59-04:00',
        },
        isConversationContinuation: false,
      },
      devDebugRecommendedExecutor: 'SumoReportSingleJobExecutor',
      devDebugRecommendedRobot: 'SlackyOpenAiAgent',
    },
  };

  const result = await intentParsingService.parsePromptIntent(
    message,
    previousContext,
  );

  console.log(
    JSON.stringify(
      { scenario: 'subjectMerging-continuation', result },
      null,
      2,
    ),
  );
}

// Test Scenario 10: Subject Merging for Continuation (With New Subjects)
async function testSubjectMergingWithNewSubjects() {
  console.log(
    '\n=== Scenario 10: Subject Merging for Continuation (With New Subjects) ===',
  );
  const message =
    'I need a submissions report for form 999999 for the past week';
  const previousContext = {
    previousRobot: 'SlackyOpenAiAgent',
    lastRobotMessageText:
      'Here is your submissions report for form 5375703 from the past 36 hours.',
    lastIntent: {
      intent: 'generateSumoReport',
      intentData: {
        conversationId: 'test-conversation-subject-merge-new',
        originalUserPrompt:
          'I need a submissions report for form 5375703 past 36 hours',
        subIntents: ['submissionCreatedForForm'],
        subjects: { formId: ['5375703'] },
        dateRange: {
          startDate: '2025-09-19T00:00:00-04:00',
          endDate: '2025-09-21T23:59:59-04:00',
        },
        isConversationContinuation: false,
      },
    },
  };

  const promptText = intentParsingService.buildPrompt(message, previousContext);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify(
      { scenario: 'subjectMerging-withNewSubjects', result },
      null,
      2,
    ),
  );
}

// Test Scenario 1: General Assistance - New Conversation
async function testGeneralAssistanceNewConversation() {
  console.log('\n=== Scenario 1: General Assistance - New Conversation ===');

  const message = 'Hello, how are you today?';
  const promptText = intentParsingService.buildPrompt(message, undefined);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify({ scenario: 'generalAssistance-new', result }, null, 2),
  );
}

// Test Scenario 2: General Assistance - Previous Conversation
async function testGeneralAssistancePreviousConversation() {
  console.log(
    '\n=== Scenario 2: General Assistance - Previous Conversation ===',
  );

  const message = 'That sounds good, thank you!';
  const previousContext = {
    previousRobot: 'SlackyOpenAiAgent',
    lastRobotMessageText:
      'I can help you with that. What would you like to know?',
    lastIntent: {
      intent: 'assistUser',
      intentData: {
        conversationId: 'test-conversation-456',
        originalUserPrompt: 'Can you help me understand something?',
        subIntents: ['generalAssistance'],
        isConversationContinuation: false,
      },
    },
  };

  const promptText = intentParsingService.buildPrompt(message, previousContext);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify({ scenario: 'generalAssistance-previous', result }, null, 2),
  );
}

// Test Scenario 3: Generate Sumo Report - New Conversation
async function testGenerateSumoReportNewConversation() {
  console.log('\n=== Scenario 3: Generate Sumo Report - New Conversation ===');

  const message =
    'Can you generate a submission report for form 12345 from the past week?';
  const promptText = intentParsingService.buildPrompt(message, undefined);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify({ scenario: 'generateSumoReport-new', result }, null, 2),
  );
}

// Test Scenario 4: Generate Sumo Report - Previous Conversation
async function testGenerateSumoReportPreviousConversation() {
  console.log(
    '\n=== Scenario 4: Generate Sumo Report - Previous Conversation ===',
  );

  const message = 'For the past week';
  const previousContext = {
    previousRobot: 'SlackyOpenAiAgent',
    lastRobotMessageText:
      'I can help you generate a Sumo report. What time period would you like?',
    lastIntent: {
      intent: 'generateSumoReport',
      intentData: {
        conversationId: 'test-conversation-789',
        originalUserPrompt:
          'Can you generate a submission report for form 12345?',
        subIntents: ['submissionCreatedForForm'],
        subjects: { formId: ['12345'] },
        isConversationContinuation: false,
      },
    },
  };

  const promptText = intentParsingService.buildPrompt(message, previousContext);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify(
      { scenario: 'generateSumoReport-previous', result },
      null,
      2,
    ),
  );
}

// Test Scenario 5: Search Knowledge Base - New Conversation
async function testSearchKnowledgeBaseNewConversation() {
  console.log('\n=== Scenario 5: Search Knowledge Base - New Conversation ===');

  const message = 'How do I set up form validation rules?';
  const promptText = intentParsingService.buildPrompt(message, undefined);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify({ scenario: 'searchKnowledgeBase-new', result }, null, 2),
  );
}

// Test Scenario 6: Search Knowledge Base - Previous Conversation
async function testSearchKnowledgeBasePreviousConversation() {
  console.log(
    '\n=== Scenario 6: Search Knowledge Base - Previous Conversation ===',
  );

  const message = 'What about conditional logic?';
  const previousContext = {
    previousRobot: 'KnobbyOpenAiSearch',
    lastRobotMessageText:
      'Here are the validation rules documentation. What else would you like to know?',
    lastIntent: {
      intent: 'searchKnowledgeBase',
      intentData: {
        conversationId: 'test-conversation-101',
        originalUserPrompt: 'How do I set up form validation rules?',
        subIntents: ['topResults'],
        isConversationContinuation: false,
      },
    },
  };

  const promptText = intentParsingService.buildPrompt(message, previousContext);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify(
      { scenario: 'searchKnowledgeBase-previous', result },
      null,
      2,
    ),
  );
}

// Test Scenario 7: Get Context Dynamic - New Conversation
async function testGetContextDynamicNewConversation() {
  console.log('\n=== Scenario 7: Get Context Dynamic - New Conversation ===');

  const message = 'Show me the configuration for form 67890';
  const promptText = intentParsingService.buildPrompt(message, undefined);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify({ scenario: 'getContextDynamic-new', result }, null, 2),
  );
}

// Test Scenario 8: Get Context Dynamic - Previous Conversation
async function testGetContextDynamicPreviousConversation() {
  console.log(
    '\n=== Scenario 8: Get Context Dynamic - Previous Conversation ===',
  );

  const message = 'What about the account settings?';
  const previousContext = {
    previousRobot: 'SlackyOpenAiAgent',
    lastRobotMessageText:
      'Here is the form configuration. Would you like to see account settings too?',
    lastIntent: {
      intent: 'getContextDynamic',
      intentData: {
        conversationId: 'test-conversation-202',
        originalUserPrompt: 'Show me the configuration for form 67890',
        subIntents: ['getFormContext'],
        subjects: { formId: ['67890'] },
        isConversationContinuation: false,
      },
    },
  };

  const promptText = intentParsingService.buildPrompt(message, previousContext);
  const result = await intentParsingService.executePrompt(promptText);

  console.log(
    JSON.stringify({ scenario: 'getContextDynamic-previous', result }, null, 2),
  );
}

// Run the tests
runAllTests().catch(console.error);
