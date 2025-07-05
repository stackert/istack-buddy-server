#!/usr/bin/env ts-node

import { RobotChatAnthropic } from '../../src/robots/RobotChatAnthropic';
import { RobotChatAnthropicToolSet } from '../../src/robots/tool-definitions/RobotChatAnthropicTools';
import { TConversationTextMessageEnvelope } from '../../src/robots/types';

async function main() {
  console.log('🤖 Setting up Anthropic Robot...');

  // Create robot instance
  const robot = new RobotChatAnthropic();
  console.log(`✅ Robot created: ${robot.name} v${robot.version}`);

  // Show available tools
  console.log(
    `🔧 Available tools: ${RobotChatAnthropicToolSet.toolDefinitions.length}`,
  );

  // Test 2: Multi-part Response
  const testMessage2: TConversationTextMessageEnvelope = {
    messageId: 'test-2',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: 'msg-2',
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload:
          'I would like to find submitAction log items for submission 12345',
      },
      created_at: new Date().toISOString(),
      estimated_token_count: 0,
    },
  };

  console.log('\n\n🔄 Test 2 - Multi-part response:');
  console.log('🐛 DEBUG: About to call acceptMessageMultiPartResponse...');

  let delayedResponseCount = 0;

  try {
    const immediateResponse = await robot.acceptMessageMultiPartResponse(
      testMessage2,
      (delayedResponse) => {
        delayedResponseCount++;
        console.log(
          `\n⏳ Delayed response received (#${delayedResponseCount}):`,
        );
        console.log(
          '🐛 DEBUG: Delayed callback fired at:',
          new Date().toISOString(),
        );
        console.log(
          '🐛 DEBUG: Delayed response object:',
          JSON.stringify(delayedResponse, null, 2),
        );
        console.log(
          'Content:',
          delayedResponse.envelopePayload.content.payload,
        );
      },
    );

    console.log(
      '🐛 DEBUG: acceptMessageMultiPartResponse returned successfully',
    );
    console.log('📩 Immediate response:');
    console.log(immediateResponse.envelopePayload.content.payload);
    console.log('✅ Multi-part response setup completed');
    console.log(`🐛 DEBUG: Current time: ${new Date().toISOString()}`);
  } catch (error) {
    console.log('❌ Multi-part response error:', error.message);
    console.log('🐛 DEBUG: Full error:', error);
  }

  // Wait for delayed response
  console.log('\n⏱️  Waiting for delayed response...');
  console.log('👋 Press Ctrl+C to exit when done observing delayed responses');
  console.log('🐛 DEBUG: Entering infinite wait loop...');

  // Add a timer to show we're still running
  const intervalId = setInterval(() => {
    console.log(
      `🕐 Still waiting... (${delayedResponseCount} delayed responses received)`,
    );
  }, 5000);

  // Wait indefinitely until user exits
  await new Promise(() => {}); // Never resolves - user must Ctrl+C
}

// Handle any uncaught promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log('🐛 DEBUG: Unhandled Promise Rejection at:', promise);
  console.log('🐛 DEBUG: Reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.log('🐛 DEBUG: Uncaught Exception:', error);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🔌 Disconnecting...');
  console.log('✅ Done');
  process.exit(0);
});

// Run the connection test
(async () => {
  console.log('🐛 DEBUG: Starting main function...');
  await main().catch((error) => {
    console.error('🐛 DEBUG: Main function error:', error);
  });
})();
