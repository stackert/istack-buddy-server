#!/usr/bin/env ts-node

import { RobotChatAnthropic } from '../../src/robots/RobotChatAnthropic';
import { RobotChatAnthropicToolSet } from '../../src/robots/tool-definitions/RobotChatAnthropicTools';
import { TConversationTextMessageEnvelope } from '../../src/robots/types';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY =
  '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';

async function demonstrateProperToolFlow() {
  console.log('🤖 Setting up Anthropic Robot...');

  const robot = new RobotChatAnthropic();
  console.log(`✅ Robot created: ${robot.name} v${robot.version}`);
  console.log(
    `🔧 Available tools: ${RobotChatAnthropicToolSet.toolDefinitions.length}`,
  );

  // Create Anthropic client directly to demonstrate proper flow
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  console.log('\n📝 A) Initial user prompt:');
  const userMessage = 'Please create logic stash on form 5603242';
  console.log(`"${userMessage}"`);

  // Create the conversation messages
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: 'user',
      content: userMessage,
    },
  ];

  console.log(
    '\n🌊 B) Robot streams initial response (may include tool calls):',
  );
  console.log('='.repeat(60));

  // First call - this might return tool calls
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system:
      'You are an iStackBuddy robot specializing in Intellistack Forms Core troubleshooting.',
    messages: messages,
    tools: RobotChatAnthropicToolSet.toolDefinitions,
  });

  // Display the response and collect tool uses
  let assistantContent: any[] = [];
  let toolUseBlocks: any[] = [];

  for (const content of response.content) {
    if (content.type === 'text') {
      console.log(content.text);
      assistantContent.push(content);
    } else if (content.type === 'tool_use') {
      console.log(`\n[Tool Call: ${content.name}]`);
      toolUseBlocks.push(content);
      assistantContent.push(content);
    }
  }

  console.log('\n' + '='.repeat(60));

  // If we have tool calls, execute them
  if (toolUseBlocks.length > 0) {
    console.log('\n🔧 C) Tool calls detected, executing tools:');

    // First, add the assistant's response to the conversation
    messages.push({
      role: 'assistant',
      content: assistantContent,
    });

    const toolResults: any[] = [];

    for (const toolUse of toolUseBlocks) {
      console.log(`   - Executing: ${toolUse.name}`);

      try {
        const toolResult = RobotChatAnthropicToolSet.executeToolCall(
          toolUse.name,
          toolUse.input,
        );

        toolResults.push({
          tool_use_id: toolUse.id,
          type: 'tool_result',
          content: toolResult,
        });

        console.log(`   ✅ Tool completed: ${toolUse.name}`);
      } catch (error) {
        console.log(
          `   ❌ Tool failed: ${toolUse.name} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        );

        toolResults.push({
          tool_use_id: toolUse.id,
          type: 'tool_result',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    console.log(
      '\n💬 D) Sending tool results back to Claude as user message...',
    );

    // Add tool results to conversation as user message
    messages.push({
      role: 'user',
      content: toolResults,
    });

    console.log('\n🌊 E) Streaming final response from Claude:');
    console.log('='.repeat(60));

    // Get final response from Claude
    const finalStream = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system:
        'You are an iStackBuddy robot specializing in Intellistack Forms Core troubleshooting.',
      messages: messages,
      tools: RobotChatAnthropicToolSet.toolDefinitions,
      stream: true,
    });

    for await (const chunk of finalStream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        process.stdout.write(chunk.delta.text);
      }
    }

    console.log('\n' + '='.repeat(60));
  }

  console.log('\n✅ Complete tool flow demonstrated!');
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n✅ Done');
  process.exit(0);
});

// Run the demonstration
demonstrateProperToolFlow().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
