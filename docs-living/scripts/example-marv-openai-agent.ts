import { config } from 'dotenv';
import { MarvOpenAiAgent } from '../../src/robots/MarvOpenAiAgent';
import type { TConversationTextMessageEnvelope } from '../../src/robots/types';

// Load environment variables from .env.live
config({ path: '.env.live' });

async function testMarvOpenAiAgent() {
  console.log('Testing MarvOpenAiAgent...');

  const robot = new MarvOpenAiAgent();
  const testMessage =
    "We are testing and debuging. Please respond with a random number and a 'thought of the day' (no more than 2 or 3 sentence).";

  const messageEnvelope: TConversationTextMessageEnvelope = {
    messageId: `test-${Date.now()}`,
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: `test-msg-${Date.now()}`,
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: testMessage,
      },
      created_at: new Date().toISOString(),
      estimated_token_count: robot.estimateTokens(testMessage),
    },
  };

  console.log('\n=== Testing acceptMessageImmediateResponse ===');
  try {
    const immediateResponse =
      await robot.acceptMessageImmediateResponse(messageEnvelope);
    console.log(
      'Immediate Response:',
      immediateResponse.envelopePayload.content.payload,
    );
  } catch (error) {
    console.error('Immediate Response Error:', error);
  }

  console.log('\n=== Testing acceptMessageStreamResponse ===');
  try {
    await robot.acceptMessageStreamResponse(
      messageEnvelope,
      (chunk: string) => {
        process.stdout.write(chunk);
      },
    );
    console.log('\n');
  } catch (error) {
    console.error('Stream Response Error:', error);
  }

  console.log('\n=== Testing acceptMessageMultiPartResponse ===');
  try {
    const multiPartResponse = await robot.acceptMessageMultiPartResponse(
      messageEnvelope,
      (delayedResponse: TConversationTextMessageEnvelope) => {
        console.log(
          'Delayed Response:',
          delayedResponse.envelopePayload.content.payload,
        );
      },
    );
    console.log(
      'Multi-Part Response:',
      multiPartResponse.envelopePayload.content.payload,
    );
  } catch (error) {
    console.error('Multi-Part Response Error:', error);
  }

  console.log('\nMarvOpenAiAgent test completed.');
}

testMarvOpenAiAgent().catch(console.error);
