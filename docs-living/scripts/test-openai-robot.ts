#!/usr/bin/env ts-node

import { RobotChatOpenAI } from '../../src/robots/RobotChatOpenAI';
import { TMessageEnvelope } from '../../src/robots/types';

/**
 * Test script for RobotChatAnthropic
 *
 * This script creates an instance of RobotChatAnthropic and tests the
 * sendTestMessageToRobot method with a fixed test message.
 *
 * Usage: npm run robot:openai:test
 */

async function testOpenAIRobot(): Promise<void> {
  const iStackMessageEnvelope: TMessageEnvelope = {
    payload: {
      messages: [
        {
          role: 'user',
          // content:
          //   'I can see have submission, I see them in the submissionTable, but also I get notification emails.. However my zapier integration never fires',
          content: 'What is the weather like in Pattaya, celsius please',
          content_type: 'text',
          created_at: new Date().toISOString(),
        },
      ],
    },

    routerId: 'test',
    messageType: 'response',
  };

  const responseChunkCallback = (chunk: string) => {
    process.stdout.write(chunk);
  };

  console.log('🤖 Starting Anthropic Robot Test...');
  console.log('='.repeat(50));

  try {
    // Create an instance of RobotChatAnthropic
    const robot = new RobotChatOpenAI();

    // Log robot information
    console.log(`Robot Name: ${robot.name}`);
    console.log(`Robot Version: ${robot.version}`);
    console.log(`LLM Model: ${robot.LLModelName}`);
    console.log(`LLM Version: ${robot.LLModelVersion}`);
    console.log('');

    console.log('📤 Sending test message to robot...');
    console.log({ iStackMessageEnvelope });
    console.log('');
    console.log('🔄 Waiting for response...');
    console.log('─'.repeat(50));

    // Call sendTestMessageToRobot and wait for completion
    const startTime = Date.now();
    const result = await robot.sendTestMessageToRobot(
      iStackMessageEnvelope,
      responseChunkCallback,
    );
    // const result = await robot.acceptMessageImmediateResponse(
    //   iStackMessageEnvelope,
    // );
    // const result = await robot.getWeatherWithTool(iStackMessageEnvelope);
    // getWeatherWithTool
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('─'.repeat(50));
    console.log('✅ Test completed successfully!');
    console.log('');
    console.log({ result: JSON.stringify(result, null, 2) });
    console.log(`⏱️  Total processing time: ${duration}ms`);
    console.log(
      `📨 Response envelope created with Router ID: ${result.routerId}`,
    );
    console.log(`📝 Message type: ${result.messageType}`);
    console.log('');
    console.log({ robotResponse: result.payload?.messages.slice(-1) });
  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error('─'.repeat(50));

    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      if (error.stack) {
        console.error('Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('Unknown error:', error);
    }

    console.error('─'.repeat(50));
    process.exit(1);
  }

  console.log('🎉 Anthropic Robot Test completed successfully!');
  console.log('='.repeat(50));
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

(async () => {
  await testOpenAIRobot();
})();
// Run the test
// if (require.main === module) {
//   testOpenAIRobot()
//     .then(() => {
//       console.log('✨ Script execution completed.');
//       process.exit(0);
//     })
//     .catch((error) => {
//       console.error('💥 Script execution failed:', error);
//       process.exit(1);
//     });
// }
