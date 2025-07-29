#!/usr/bin/env npx ts-node

/**
 * Example Script: Testing RobotChatBedrock
 *
 * This script demonstrates how to use the RobotChatBedrock robot.
 * It sends a specific test message and displays the response.
 *
 * Usage: npx ts-node docs-living/scripts/example-bedrock.ts
 *
 * Requirements:
 * - AWS credentials must be configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
 * - The robot will respond with a random number and a thought of the day
 */

import * as dotenv from 'dotenv';
import { RobotChatBedrock } from '../../src/robots/RobotChatBedrock';
import type { TConversationTextMessageEnvelope } from '../../src/robots/types';

// Load environment variables from .env.live
dotenv.config({ path: '.env.live' });

async function main() {
  console.log('RobotChatBedrock Test Script - Starting...');

  // Check for required environment variables
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error(
      'Error: AWS credentials are required. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env.live file',
    );
    process.exit(1);
  }

  try {
    const robot = new RobotChatBedrock();

    // Create test message envelope
    const testMessage: TConversationTextMessageEnvelope = {
      messageId: `take-one-${Date.now()}`,
      requestOrResponse: 'request',
      envelopePayload: {
        messageId: `msg-${Date.now()}`,
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Show me the configuration for form 5375703',
          // 'We are testing debugging - please response with random number and a thought of the day',
        },
        created_at: new Date().toISOString(),
        estimated_token_count: 20, // Rough estimate
      },
    };

    console.log('Sending test message to robot and waiting for response...');
    const response = await robot.acceptMessageImmediateResponse(testMessage);

    console.log('Robot Response:', response.envelopePayload.content.payload);
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error during robot test:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
