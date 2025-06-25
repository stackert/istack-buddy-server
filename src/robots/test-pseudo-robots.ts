import {
  PseudoRobotRouterSuggestions,
  PseudoRobotRouter,
  PseudoRobotDocumentationSuggestions,
  TMessageEnvelope,
  TRobotMessage,
} from './index';

/**
 * Test script to demonstrate the pseudo robots functionality
 */
async function testPseudoRobots() {
  console.log('🤖 Testing Pseudo Robots\n');

  // Test message envelope
  const testMessage: TRobotMessage = {
    role: 'user',
    content:
      'I need help with robot development and want to see available documentation',
    message: 'Help me with robot development',
    sender: 'user',
    receiver: 'robot',
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const testEnvelope: TMessageEnvelope = {
    routerId: 'test-router-001',
    messageType: 'message',
    message: testMessage,
  };

  console.log('📨 Test Message:', testMessage.content);
  console.log('='.repeat(80));

  // Test 1: PseudoRobotRouterSuggestions
  console.log('\n1️⃣ Testing PseudoRobotRouterSuggestions');
  console.log('-'.repeat(50));

  const suggestionRobot = new PseudoRobotRouterSuggestions();
  console.log('Robot Name:', suggestionRobot.getName());
  console.log(
    'Description:',
    suggestionRobot.constructor['descriptionShort']?.trim(),
  );

  await suggestionRobot.acceptMessageMultiPartResponse(
    testEnvelope,
    (response) => {
      console.log(
        '💡 Delayed Suggestion Response:',
        response.message?.content?.substring(0, 200) + '...',
      );
    },
  );

  // Wait a moment for the delayed response
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Test 2: PseudoRobotRouter
  console.log('\n\n2️⃣ Testing PseudoRobotRouter');
  console.log('-'.repeat(50));

  const routerRobot = new PseudoRobotRouter();
  console.log('Robot Name:', routerRobot.getName());
  console.log(
    'Description:',
    routerRobot.constructor['descriptionShort']?.trim(),
  );

  await routerRobot.acceptMessageMultiPartResponse(testEnvelope, (response) => {
    console.log(
      '🔀 Router Response:',
      response.message?.message ||
        response.message?.content?.substring(0, 100) + '...',
    );
  });

  // Wait for router to complete all phases
  await new Promise((resolve) => setTimeout(resolve, 4000));

  // Test 3: PseudoRobotDocumentationSuggestions
  console.log('\n\n3️⃣ Testing PseudoRobotDocumentationSuggestions');
  console.log('-'.repeat(50));

  const docRobot = new PseudoRobotDocumentationSuggestions();
  console.log('Robot Name:', docRobot.getName());
  console.log('Description:', docRobot.constructor['descriptionShort']?.trim());

  await docRobot.acceptMessageMultiPartResponse(testEnvelope, (response) => {
    console.log('📚 Documentation Response:', response.message?.message);
    if (response.message?.content?.includes('https://')) {
      const urls = response.message.content.match(/https:\/\/[^\s\)]+/g);
      console.log('🔗 Found URLs:', urls?.slice(0, 3));
    }
  });

  // Wait for documentation responses
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('\n' + '='.repeat(80));
  console.log('✅ All pseudo robots tested successfully!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Multi-part response patterns with delayed callbacks');
  console.log('• Robot suggestion and routing logic');
  console.log('• Documentation link generation');
  console.log('• Robot orchestration and coordination');
}

// Export for use in tests or direct execution
export { testPseudoRobots };

// Allow direct execution with: npx ts-node src/robots/test-pseudo-robots.ts
if (require.main === module) {
  testPseudoRobots().catch(console.error);
}
