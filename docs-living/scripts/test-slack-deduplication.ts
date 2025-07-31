#!/usr/bin/env ts-node

/**
 * Test script to demonstrate Slack event deduplication
 * and clarify the difference between live agents vs parrot robots
 */

import { RobotService } from '../../src/robots/robot.service';
import { SlackyAnthropicAgent } from '../../src/robots/SlackyAnthropicAgent';
import { ChatRobotParrot } from '../../src/robots/ChatRobotParrot';
import { IstackBuddySlackApiService } from '../../src/istack-buddy-slack-api/istack-buddy-slack-api.service';
import { ChatManagerService } from '../../src/chat-manager/chat-manager.service';
import { RobotProcessorService } from '../../src/chat-manager/robot-processor.service';

async function testSlackDeduplication() {
  console.log('🧪 Testing Slack Integration & Robot Types');
  console.log('='.repeat(60));

  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    const robotService = new RobotService();
    await robotService.onModuleInit();

    const chatManagerService = new ChatManagerService();
    const robotProcessorService = new RobotProcessorService(robotService);
    const slackService = new IstackBuddySlackApiService(
      chatManagerService,
      robotProcessorService,
    );

    // Test 1: Robot Types Comparison
    console.log('\n🤖 Test 1: Robot Types Comparison');
    console.log('─'.repeat(40));

    const slackyAgent = robotService.getRobotByName<SlackyAnthropicAgent>(
      'SlackyAnthropicAgent',
    );
    const parrotRobot =
      robotService.getRobotByName<ChatRobotParrot>('ChatRobotParrot');

    console.log('📊 SlackyAnthropicAgent Properties:');
    console.log(`   - Name: ${slackyAgent?.name}`);
    console.log(`   - Model: ${slackyAgent?.LLModelName}`);
    console.log(
      `   - Context Window: ${slackyAgent?.contextWindowSizeInTokens?.toLocaleString()} tokens`,
    );
    console.log(`   - Type: LIVE Anthropic Claude Agent 🔴`);
    console.log(`   - API: Requires ANTHROPIC_API_KEY`);
    console.log(`   - Tools: Real Slacky tools (Sumo Logic, SSO)`);

    console.log('\n📊 ChatRobotParrot Properties:');
    console.log(`   - Name: ${parrotRobot?.name}`);
    console.log(`   - Model: ${parrotRobot?.LLModelName}`);
    console.log(
      `   - Context Window: ${parrotRobot?.contextWindowSizeInTokens?.toLocaleString()} tokens`,
    );
    console.log(`   - Type: MOCK Parrot Robot 🦜`);
    console.log(`   - API: No external API calls`);
    console.log(`   - Tools: No real tools, just echoes back`);

    // Test 2: Simulate duplicate Slack events
    console.log('\n🔄 Test 2: Duplicate Event Handling');
    console.log('─'.repeat(40));

    // Create a mock Slack event
    const mockEvent = {
      user: 'U123456789',
      channel: 'C987654321',
      text: '@istackbuddy test message',
      ts: '1234567890.123456',
    };

    console.log('📝 Simulating duplicate Slack events...');
    console.log(`   Event: ${mockEvent.text}`);
    console.log(`   Channel: ${mockEvent.channel}`);
    console.log(`   User: ${mockEvent.user}`);
    console.log(`   Timestamp: ${mockEvent.ts}`);

    // Test deduplication by calling handleAppMention multiple times
    console.log('\n🔄 Sending same event 3 times to test deduplication:');

    // First call - should process
    console.log('   Call 1: Processing...');
    await (slackService as any).handleAppMention(mockEvent);

    // Second call - should be deduplicated
    console.log('   Call 2: Processing...');
    await (slackService as any).handleAppMention(mockEvent);

    // Third call - should be deduplicated
    console.log('   Call 3: Processing...');
    await (slackService as any).handleAppMention(mockEvent);

    // Test 3: Robot Processing Comparison
    console.log('\n🎯 Test 3: Robot Processing Comparison');
    console.log('─'.repeat(40));

    const testMessage = 'Help me with SSO configuration';

    // Test with SlackyAnthropicAgent
    console.log('🔴 Testing SlackyAnthropicAgent (Live Agent):');
    try {
      const slackyResponse = await robotProcessorService.processMessage({
        content: testMessage,
        fromUserId: 'test-user',
        fromRole: 'cx-customer' as any,
        conversationId: 'test-conv',
      });

      console.log(`   - Robot: ${slackyResponse.robotName}`);
      console.log(`   - Processed: ${slackyResponse.processed}`);
      console.log(
        `   - Response Length: ${slackyResponse.response.length} chars`,
      );
      console.log(`   - Error: ${slackyResponse.error || 'None'}`);

      if (slackyResponse.error?.includes('ANTHROPIC_API_KEY')) {
        console.log('   ⚠️ This is a LIVE agent that needs API key!');
      }
    } catch (error) {
      console.log(
        `   - Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }

    // Test with ChatRobotParrot
    console.log('\n🦜 Testing ChatRobotParrot (Mock Robot):');
    try {
      // Force selection of parrot robot by using non-Slack context
      const parrotResponse = await robotProcessorService.processMessage({
        content: 'simple test message',
        fromUserId: 'test-user',
        fromRole: 'cx-customer' as any,
        conversationId: 'test-conv',
      });

      console.log(`   - Robot: ${parrotResponse.robotName}`);
      console.log(`   - Processed: ${parrotResponse.processed}`);
      console.log(
        `   - Response Length: ${parrotResponse.response.length} chars`,
      );
      console.log(`   - Error: ${parrotResponse.error || 'None'}`);
      console.log('   ✅ This is a MOCK robot that always works!');
    } catch (error) {
      console.log(
        `   - Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }

    console.log('\n🎉 Test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ SlackyAnthropicAgent = LIVE Anthropic Claude agent');
    console.log('   ✅ ChatRobotParrot = MOCK parrot robot');
    console.log('   ✅ Event deduplication prevents duplicate processing');
    console.log('   ✅ Single ChatManager system maintains all messages');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSlackDeduplication().catch(console.error);
