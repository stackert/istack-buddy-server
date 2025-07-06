#!/usr/bin/env ts-node

import { RobotChatAnthropic } from '../../src/robots/RobotChatAnthropic';
import { AnthropicMarv } from '../../src/robots/AnthropicMarv';
import { TConversationTextMessageEnvelope } from '../../src/robots/types';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY =
  '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';

async function testStashFunction(action: string) {
  console.log(`🧪 Testing: ${action}`);
  console.log('='.repeat(60));

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const userMessage = `Please ${action} on form 5603242`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system:
      'You are an iStackBuddy robot specializing in Intellistack Forms Core troubleshooting.',
    messages: [{ role: 'user', content: userMessage }],
    tools: RobotChatAnthropicToolSet.toolDefinitions,
  });

  // Process response
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

  // Execute tools
  if (toolUseBlocks.length > 0) {
    console.log('\n🔧 Executing tools...');

    const toolResults: any[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolResult = RobotChatAnthropicToolSet.executeToolCall(
        toolUse.name,
        toolUse.input,
      );
      toolResults.push({
        tool_use_id: toolUse.id,
        type: 'tool_result',
        content: toolResult,
      });
    }

    // Get final response
    const finalResponse = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system:
        'You are an iStackBuddy robot specializing in Intellistack Forms Core troubleshooting.',
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: toolResults },
      ],
      tools: RobotChatAnthropicToolSet.toolDefinitions,
    });

    console.log('\n📋 Final result:');
    for (const content of finalResponse.content) {
      if (content.type === 'text') {
        console.log(content.text);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
}

async function main() {
  console.log('🔧 Testing Logic Stash Functions\n');

  // Test apply stash
  await testStashFunction('apply logic stash');

  console.log('\n');

  // Test remove stash
  await testStashFunction('remove logic stash');
}

main().catch(console.error);
