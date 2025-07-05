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

  // Test 1: Streaming Response
  const testMessage1: TConversationTextMessageEnvelope = {
    messageId: 'test-1',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: 'msg-1',
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: 'I need help with form 12345',
      },
      created_at: new Date().toISOString(),
      estimated_token_count: 0,
    },
  };

  console.log('\n🌊 Test 1 - Streaming response:');
  try {
    await robot.acceptMessageStreamResponse(testMessage1, (chunk) =>
      process.stdout.write(chunk),
    );
    console.log('\n✅ Streaming response completed');
  } catch (error) {
    console.log('\n❌ Streaming response error:', error.message);
  }

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
  try {
    const immediateResponse = await robot.acceptMessageMultiPartResponse(
      testMessage2,
      (delayedResponse) => {
        console.log('\n⏳ Delayed response received:');
        console.log(delayedResponse.envelopePayload.content.payload);
      },
    );
    console.log('📩 Immediate response:');
    console.log(immediateResponse.envelopePayload.content.payload);
    console.log('✅ Multi-part response setup completed');
  } catch (error) {
    console.log('❌ Multi-part response error:', error.message);
  }

  // Wait for delayed response
  console.log('\n⏱️  Waiting for delayed response...');
  console.log('👋 Press Ctrl+C to exit when done observing delayed responses');

  // Wait indefinitely until user exits
  await new Promise(() => {}); // Never resolves - user must Ctrl+C
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🔌 Disconnecting...');
  console.log('✅ Done');
  process.exit(0);
});

// Run the connection test
(async () => {
  await main().catch(console.error);
})();
