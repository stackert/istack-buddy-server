#!/usr/bin/env ts-node

import { RobotChatAnthropic } from '../../src/robots/RobotChatAnthropic';
import { TConversationTextMessageEnvelope } from '../../src/robots/types';

async function testFormstackTools() {
  console.log('🧪 Testing Formstack Tools with Anthropic Robot...');
  console.log('='.repeat(60));

  const robot = new RobotChatAnthropic();
  console.log(`✅ Robot created: ${robot.name} v${robot.version}`);

  // Test message that should trigger Formstack tool usage
  const testMessage: TConversationTextMessageEnvelope = {
    messageId: 'formstack-test',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: 'formstack-msg',
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload:
          'Please create a contact form with name field, email field, and message field. Name the form "Customer Contact Form".',
      },
      created_at: new Date().toISOString(),
      estimated_token_count: 0,
    },
  };

  console.log('\n🎯 Testing form creation request...');
  console.log(`Input: "${testMessage.envelopePayload.content.payload}"`);
  console.log('\n🌊 Streaming response:');

  try {
    await robot.acceptMessageStreamResponse(testMessage, (chunk) => {
      process.stdout.write(chunk);
    });

    console.log('\n\n✅ Formstack tools test completed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error ? error.message : error,
    );
  }
}

// Run the test
testFormstackTools();
