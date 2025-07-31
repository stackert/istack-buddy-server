#!/usr/bin/env ts-node

/**
 * Test script for SlackyAnthropicAgent robot
 * Tests the comprehensive tool integration and Slack-specific functionality
 */

import { RobotService } from '../../src/robots/robot.service';
import { SlackyAnthropicAgent } from '../../src/robots/SlackyAnthropicAgent';
import { TConversationTextMessageEnvelope } from '../../src/robots/types';

async function testSlackyAnthropicAgent() {
  console.log('🤖 Testing SlackyAnthropicAgent Robot');
  console.log('='.repeat(50));

  // Initialize robot service
  const robotService = new RobotService();
  await robotService.onModuleInit();

  // Get SlackyAnthropicAgent
  const robot = robotService.getRobotByName<SlackyAnthropicAgent>(
    'SlackyAnthropicAgent',
  );

  if (!robot) {
    console.error('❌ SlackyAnthropicAgent robot not found!');
    console.log('Available robots:', robotService.getAvailableRobotNames());
    return;
  }

  console.log('✅ SlackyAnthropicAgent robot found');
  console.log(`📝 Version: ${robot.getVersion()}`);
  console.log(`🧠 Model: ${robot.LLModelName}`);
  console.log(
    `🔧 Context Window: ${robot.contextWindowSizeInTokens.toLocaleString()} tokens`,
  );

  // Test message envelope
  const testMessage: TConversationTextMessageEnvelope = {
    messageId: 'test-msg-1',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: 'test-payload-1',
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload:
          'Hello! Can you help me with some Forms Core troubleshooting? What tools do you have available?',
      },
      created_at: new Date().toISOString(),
      estimated_token_count: 20,
    },
  };

  console.log('\n🔄 Testing immediate response...');

  try {
    const response = await robot.acceptMessageImmediateResponse(testMessage);
    console.log('✅ Response received:');
    console.log('📄 Content:', response.envelopePayload.content.payload);
    console.log(
      `🔢 Token count: ${response.envelopePayload.estimated_token_count}`,
    );
  } catch (error) {
    console.error('❌ Error testing immediate response:', error);
  }

  // Test tool availability
  console.log('\n🔧 Testing tool availability...');

  const toolTestMessage: TConversationTextMessageEnvelope = {
    messageId: 'test-msg-2',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: 'test-payload-2',
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: 'Can you show me form information for formId: 12345?',
      },
      created_at: new Date().toISOString(),
      estimated_token_count: 15,
    },
  };

  try {
    console.log('🔄 Testing with tool request...');
    const toolResponse =
      await robot.acceptMessageImmediateResponse(toolTestMessage);
    console.log('✅ Tool response received:');
    console.log('📄 Content:', toolResponse.envelopePayload.content.payload);
  } catch (error) {
    console.error('❌ Error testing tool response:', error);
  }

  console.log('\n🎯 SlackyAnthropicAgent test completed!');
}

// Run the test
if (require.main === module) {
  testSlackyAnthropicAgent().catch(console.error);
}

export { testSlackyAnthropicAgent };
