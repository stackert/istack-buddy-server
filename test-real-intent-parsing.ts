#!/usr/bin/env ts-node

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.live' });

import { ChatConversationListService } from './src/ConversationLists/ChatConversationListService';
import { RobotService } from './src/robots/robot.service';
import { IntentRouterService } from './src/common/services/intent-router.service';
import { ChatManagerService } from './src/chat-manager/chat-manager.service';

async function testRealIntentParsing() {
  console.log('=== TESTING REAL INTENT PARSING ===');

  // Create services
  const conversationListService = new ChatConversationListService();
  const robotService = new RobotService();
  const intentRouterService = new IntentRouterService();

  const chatManager = new ChatManagerService(
    conversationListService,
    robotService,
    intentRouterService,
  );

  const conversationId = 'test-conversation-123';

  console.log('\n1. Adding first intent message...');
  await chatManager.addMessageSystemNotification(conversationId, {
    type: 'system/user-intent',
    payload: {
      intent: 'getContextDynamic',
      intentData: {
        originalUserPrompt: 'bring into context 5375703',
        subIntents: ['getFormContext'],
        subjects: { formId: ['5375703'] },
        isConversationContinuation: false,
      },
      devDebugRecommendedExecutor: 'ContextDynamicJobExecutor',
      devDebugRecommendedRobot: 'SlackyOpenAiAgent',
    },
  });

  console.log('\n2. Testing REAL parseIntentFromUserMessage...');
  const conversationContext = {
    currentRobot: '',
    lastRobotMessageText: 'Form context retrieved successfully.',
    conversationId: conversationId,
  };

  const intentResult = await chatManager.parseIntentFromUserMessage(
    'run submission report',
    conversationContext,
  );

  console.log('\n=== REAL LLM RESULT ===');
  console.log('Intent Result:', JSON.stringify(intentResult, null, 2));

  // Check if it worked
  const isSuccess =
    !('error' in intentResult) &&
    intentResult.intentData?.isConversationContinuation === true &&
    intentResult.intentData?.subjects?.formId?.[0] === '5375703';

  console.log('\n=== TEST RESULT ===');
  if (isSuccess) {
    console.log(
      '✅ SUCCESS: Real LLM detects continuation and passes through formId!',
    );
    console.log('✅ Continuation detected: true');
    console.log('✅ FormId passed through: 5375703');
  } else {
    console.log(
      '❌ FAILED: Real LLM does not detect continuation or pass through formId',
    );
    console.log(
      'Expected: isConversationContinuation=true, subjects.formId=["5375703"]',
    );
    if ('error' in intentResult) {
      console.log('Actual: ERROR -', intentResult.error);
      console.log(
        'This means the LLM API call failed (API key, network, etc.)',
      );
    } else {
      console.log('Actual:', {
        isConversationContinuation:
          intentResult.intentData?.isConversationContinuation,
        subjects: intentResult.intentData?.subjects,
      });
      console.log(
        'This means the LLM API worked but did not detect continuation correctly',
      );
    }
  }

  console.log('\n=== TEST COMPLETE ===');
}

// Run the test
testRealIntentParsing().catch(console.error);
