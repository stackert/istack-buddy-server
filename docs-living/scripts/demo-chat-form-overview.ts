#!/usr/bin/env ts-node

/**
 * Demo: RobotChatAnthropic Form Overview Tool
 *
 * This script demonstrates the new form overview functionality integrated
 * into RobotChatAnthropic as a tool. Shows real-time chat interaction
 * with the robot requesting form information.
 */

import { RobotChatAnthropic } from '../../src/robots/RobotChatAnthropic';
import { RobotChatAnthropicToolSet } from '../../src/robots/tool-definitions/RobotChatAnthropicTools';
import { TConversationTextMessageEnvelope } from '../../src/robots/types';

// Helper function to create message envelope
function createMessage(
  payload: string,
  messageId: string,
): TConversationTextMessageEnvelope {
  return {
    messageId: messageId,
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: `msg-${messageId}`,
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: payload,
      },
      created_at: new Date().toISOString(),
      estimated_token_count: 0,
    },
  };
}

// Helper to create separator
function showSeparator(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`🎯 ${title}`);
  console.log('='.repeat(70));
}

async function demoFormOverviewChat() {
  console.log('🤖 Anthropic Robot Form Overview Chat Demo');
  console.log('='.repeat(70));

  // Create robot instance
  const robot = new RobotChatAnthropic();
  console.log(`✅ Robot: ${robot.name} v${robot.version}`);
  console.log(
    `🔧 Tools available: ${RobotChatAnthropicToolSet.toolDefinitions.length}`,
  );

  // Check if form overview tool is available
  const formTool = RobotChatAnthropicToolSet.toolDefinitions.find(
    (tool) => tool.name === 'form_and_related_entity_overview',
  );
  console.log(
    `📋 Form Overview Tool: ${formTool ? '✅ Available' : '❌ Not Found'}`,
  );

  // Demo 1: Ask for form overview
  showSeparator('Demo 1: Request Form Overview');
  const message1 = createMessage(
    'Can you give me a complete overview of form 5603242? I need to see all its configuration, statistics, and related entities.',
    'demo-1',
  );

  console.log('👤 User: ' + message1.envelopePayload.content.payload);
  console.log('\n🤖 Robot (streaming):');

  try {
    await robot.acceptMessageStreamResponse(message1, (chunk) => {
      process.stdout.write(chunk);
    });
    console.log('\n✅ Demo 1 completed');
  } catch (error) {
    console.log(
      '\n❌ Demo 1 error:',
      error instanceof Error ? error.message : error,
    );
  }

  // Demo 2: Ask about specific aspects with form ID
  showSeparator('Demo 2: Ask About Form Configuration');
  const message2 = createMessage(
    "I'm troubleshooting form 5603242. Can you show me its current configuration including webhooks, notifications, and field count?",
    'demo-2',
  );

  console.log('👤 User: ' + message2.envelopePayload.content.payload);
  console.log('\n🤖 Robot (immediate response):');

  try {
    const response = await robot.acceptMessageImmediateResponse(message2);
    console.log(response.envelopePayload.content.payload);
    console.log('\n✅ Demo 2 completed');
  } catch (error) {
    console.log(
      '\n❌ Demo 2 error:',
      error instanceof Error ? error.message : error,
    );
  }

  // Demo 3: Ask about form without specifying ID directly
  showSeparator('Demo 3: General Form Question');
  const message3 = createMessage(
    'What tools do you have available for analyzing form configuration and setup?',
    'demo-3',
  );

  console.log('👤 User: ' + message3.envelopePayload.content.payload);
  console.log('\n🤖 Robot (streaming):');

  try {
    await robot.acceptMessageStreamResponse(message3, (chunk) => {
      process.stdout.write(chunk);
    });
    console.log('\n✅ Demo 3 completed');
  } catch (error) {
    console.log(
      '\n❌ Demo 3 error:',
      error instanceof Error ? error.message : error,
    );
  }

  // Demo 4: Test with multi-part response
  showSeparator('Demo 4: Multi-part Response with Form Analysis');
  const message4 = createMessage(
    'I need help understanding form 5603242 configuration and any potential issues.',
    'demo-4',
  );

  console.log('👤 User: ' + message4.envelopePayload.content.payload);
  console.log('\n🤖 Robot (multi-part):');

  try {
    const immediateResponse = await robot.acceptMessageMultiPartResponse(
      message4,
      (delayedResponse) => {
        console.log('\n⏳ Delayed follow-up:');
        console.log(delayedResponse.envelopePayload.content.payload);
      },
    );

    console.log('📩 Immediate response:');
    console.log(immediateResponse.envelopePayload.content.payload);
    console.log('\n✅ Demo 4 immediate response completed');

    // Wait for delayed response
    console.log('\n⏱️  Waiting for delayed response (2 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error) {
    console.log(
      '\n❌ Demo 4 error:',
      error instanceof Error ? error.message : error,
    );
  }

  // Summary
  showSeparator('Demo Summary');
  console.log('🎉 All demos completed!');
  console.log('');
  console.log('📋 What was demonstrated:');
  console.log('   ✅ Form overview tool integration');
  console.log('   ✅ Streaming responses with tool calls');
  console.log('   ✅ Immediate responses with form data');
  console.log('   ✅ Multi-part responses with follow-up');
  console.log('   ✅ Natural language form analysis requests');
  console.log('');
  console.log('🔧 The robot can now:');
  console.log('   • Analyze form configuration and statistics');
  console.log('   • Show webhooks, notifications, and confirmations');
  console.log('   • Provide troubleshooting assistance with real data');
  console.log(
    '   • Respond in multiple formats (streaming, immediate, multi-part)',
  );
  console.log('');
  console.log('✨ Demo completed successfully!');
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🔌 Stopping demo...');
  console.log('✅ Done');
  process.exit(0);
});

// Run the demo
demoFormOverviewChat().catch(console.error);
