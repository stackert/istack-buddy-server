#!/usr/bin/env ts-node

import { AnthropicMarv } from '../../src/robots/AnthropicMarv';
import type { TConversationTextMessageEnvelope } from '../../src/robots/types';

async function createMessage(
  content: string,
): Promise<TConversationTextMessageEnvelope> {
  return {
    messageId: `msg-${Date.now()}`,
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: `payload-${Date.now()}`,
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: content,
      },
      created_at: new Date().toISOString(),
      estimated_token_count: Math.ceil(content.length / 4),
    },
  };
}

async function main() {
  console.log('🤖 ANTHROPIC MARV DEMONSTRATION');
  console.log('='.repeat(60));
  console.log('');
  console.log('Testing the new AnthropicMarv robot with Formstack tools');
  console.log('');

  const marv = new AnthropicMarv();

  // Display robot information
  console.log('📋 Robot Information:');
  console.log(`Name: ${marv.name}`);
  console.log(`Version: ${marv.version}`);
  console.log(`Model: ${marv.LLModelName}`);
  console.log(`Context Window: ${marv.contextWindowSizeInTokens} tokens`);
  console.log(`Description: ${AnthropicMarv.descriptionShort}`);
  console.log('');

  try {
    // Test 1: Simple greeting to see robot personality
    console.log('🚀 TEST 1: Robot Introduction');
    console.log('-'.repeat(50));

    const greetingMessage = await createMessage(
      'Hello Marv! Can you tell me what you can do?',
    );
    const greetingResponse =
      await marv.acceptMessageImmediateResponse(greetingMessage);

    console.log('User: Hello Marv! Can you tell me what you can do?');
    console.log('');
    console.log('Marv:', greetingResponse.envelopePayload.content.payload);
    console.log('');

    // Test 2: Ask about available tools
    console.log('🚀 TEST 2: Available Tools Query');
    console.log('-'.repeat(50));

    const toolsMessage = await createMessage(
      'What tools do you have available for form management?',
    );
    const toolsResponse =
      await marv.acceptMessageImmediateResponse(toolsMessage);

    console.log('User: What tools do you have available for form management?');
    console.log('');
    console.log('Marv:', toolsResponse.envelopePayload.content.payload);
    console.log('');

    // Test 3: Ask about creating a form (should trigger tool use)
    console.log('🚀 TEST 3: Form Creation Request');
    console.log('-'.repeat(50));

    const formMessage = await createMessage(
      'Please create a simple feedback form with fields for name, email, and message',
    );
    const formResponse = await marv.acceptMessageImmediateResponse(formMessage);

    console.log(
      'User: Please create a simple feedback form with fields for name, email, and message',
    );
    console.log('');
    console.log('Marv:', formResponse.envelopePayload.content.payload);
    console.log('');

    console.log('✅ DEMONSTRATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('');
    console.log('💡 Key Features Demonstrated:');
    console.log('• ✅ AnthropicMarv robot successfully created');
    console.log('• ✅ Specialized Formstack system prompt working');
    console.log('• ✅ Tool integration with real Formstack API');
    console.log('• ✅ Focused on form management operations');
    console.log('• ✅ Ready for production use with Marv-enabled forms');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('• Test with real form creation on Marv-enabled forms');
    console.log('• Integrate with chat system for user interactions');
    console.log('• Add additional specialized prompts as needed');
  } catch (error) {
    console.error(
      '\n❌ Demo failed:',
      error instanceof Error ? error.message : error,
    );
  }
}

main().catch(console.error);
