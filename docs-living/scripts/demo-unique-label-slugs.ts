#!/usr/bin/env ts-node

import { RobotChatAnthropic } from '../../src/robots/RobotChatAnthropic';
import { RobotChatAnthropicToolSet } from '../../src/robots/tool-definitions/RobotChatAnthropicTools';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY =
  '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';

async function executeFormstackTool(action: string, formId: string) {
  console.log(`\n🔧 Executing: ${action} on form ${formId}`);
  console.log('-'.repeat(50));

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const userMessage = `Please ${action} on form ${formId}`;

  // Get initial response
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system:
      'You are an iStackBuddy robot. Execute the requested Formstack operation without extra explanation.',
    messages: [{ role: 'user', content: userMessage }],
    tools: RobotChatAnthropicToolSet.toolDefinitions,
  });

  // Process response and execute tools
  let assistantContent: any[] = [];
  let toolUseBlocks: any[] = [];

  for (const content of response.content) {
    if (content.type === 'text') {
      assistantContent.push(content);
    } else if (content.type === 'tool_use') {
      console.log(`📋 Tool: ${content.name}`);
      toolUseBlocks.push(content);
      assistantContent.push(content);
    }
  }

  // Execute tools if any
  if (toolUseBlocks.length > 0) {
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
        'You are an iStackBuddy robot. Provide a brief summary of what was accomplished.',
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: toolResults },
      ],
      tools: RobotChatAnthropicToolSet.toolDefinitions,
    });

    console.log('\n📋 Result:');
    for (const content of finalResponse.content) {
      if (content.type === 'text') {
        console.log(content.text);
      }
    }
  }
}

async function main() {
  console.log('🏷️  UNIQUE LABEL SLUG DEMONSTRATION');
  console.log('='.repeat(60));
  console.log('');
  console.log('This demo shows how to add and remove unique identifier slugs');
  console.log('from form field labels. Slugs help developers identify fields');
  console.log('by their ID when working with forms.');
  console.log('');
  console.log('Slug format: |{last4digits}| + original label');
  console.log('Example: "Email" becomes "|2597|Email"');
  console.log('');

  const formId = '5603242';

  try {
    // Step 1: Add unique slugs
    console.log('🚀 STEP 1: Adding unique slugs to field labels');
    await executeFormstackTool('add unique label slugs', formId);

    console.log('\n\n⏰ Waiting 3 seconds before next step...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 2: Remove unique slugs
    console.log('\n\n🚀 STEP 2: Removing unique slugs from field labels');
    await executeFormstackTool('remove unique label slugs', formId);

    console.log('\n\n✅ DEMONSTRATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('');
    console.log('💡 What just happened:');
    console.log(
      '1. Added unique ID slugs to all field labels (|2597|, |2598|, etc.)',
    );
    console.log(
      '2. Field labels became easier to identify by their internal ID',
    );
    console.log('3. Removed the slugs to restore original clean labels');
    console.log('');
    console.log('🎯 Use cases:');
    console.log('• Debugging form logic that references field IDs');
    console.log('• Identifying fields when building integrations');
    console.log('• Temporarily making field IDs visible to developers');
    console.log('• Troubleshooting field mapping issues');
  } catch (error) {
    console.error(
      '\n❌ Demo failed:',
      error instanceof Error ? error.message : error,
    );
  }
}

main().catch(console.error);
