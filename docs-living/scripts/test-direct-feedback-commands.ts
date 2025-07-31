#!/usr/bin/env ts-node

import { SlackyAnthropicAgent } from '../../src/robots/SlackyAnthropicAgent';
import { TConversationTextMessageEnvelope } from '../../src/robots/types';

console.log('🧪 Testing Direct Feedback Commands in SlackyAnthropicAgent\n');

// Initialize the agent
const agent = new SlackyAnthropicAgent();

// Helper function to create test message
function createTestMessage(content: string): TConversationTextMessageEnvelope {
  return {
    messageId: `test-${Date.now()}`,
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: `test-msg-${Date.now()}`,
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

async function testDirectCommands() {
  console.log('📝 Testing /feedback command...');

  try {
    const feedbackMessage = createTestMessage(
      '@istack-buddy /feedback This response was very helpful but took a bit long to generate',
    );
    const feedbackResponse =
      await agent.acceptMessageImmediateResponse(feedbackMessage);
    console.log(
      'Feedback Response:',
      feedbackResponse.envelopePayload.content.payload,
    );
  } catch (error) {
    console.error('Feedback test failed:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('⭐ Testing /rating command with positive rating...');

  try {
    const ratingMessage = createTestMessage(
      '@istack-buddy /rating +4 Very helpful and accurate information!',
    );
    const ratingResponse =
      await agent.acceptMessageImmediateResponse(ratingMessage);
    console.log(
      'Rating Response:',
      ratingResponse.envelopePayload.content.payload,
    );
  } catch (error) {
    console.error('Rating test failed:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('💥 Testing /rating command with negative rating...');

  try {
    const negativeRatingMessage = createTestMessage(
      '@istack-buddy /rating -2 The information provided was incorrect',
    );
    const negativeRatingResponse = await agent.acceptMessageImmediateResponse(
      negativeRatingMessage,
    );
    console.log(
      'Negative Rating Response:',
      negativeRatingResponse.envelopePayload.content.payload,
    );
  } catch (error) {
    console.error('Negative rating test failed:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('❌ Testing invalid rating...');

  try {
    const invalidRatingMessage = createTestMessage(
      '@istack-buddy /rating +10 Too high rating',
    );
    const invalidRatingResponse =
      await agent.acceptMessageImmediateResponse(invalidRatingMessage);
    console.log(
      'Invalid Rating Response:',
      invalidRatingResponse.envelopePayload.content.payload,
    );
  } catch (error) {
    console.error('Invalid rating test failed:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('🤖 Testing normal message (should go to Claude)...');

  try {
    const normalMessage = createTestMessage(
      '@istack-buddy Hello, can you help me with a form issue?',
    );
    console.log(
      'Normal message sent - would be processed by Claude (not testing full Claude integration)',
    );
  } catch (error) {
    console.error('Normal message test failed:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('❓ Testing help command...');

  try {
    const helpMessage = createTestMessage('@istack-buddy /help');
    const helpResponse =
      await agent.acceptMessageImmediateResponse(helpMessage);
    console.log(
      'Help Response:',
      helpResponse.envelopePayload.content.payload.substring(0, 200) + '...',
    );
  } catch (error) {
    console.error('Help test failed:', error);
  }

  console.log('\n✅ Direct command tests completed!');
  console.log('📁 Check docs-living/debug-logging/feedback/ for log files.\n');
}

testDirectCommands().catch(console.error);
