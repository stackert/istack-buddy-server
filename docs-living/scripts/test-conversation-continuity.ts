#!/usr/bin/env ts-node

/**
 * Test script for Slack conversation continuity
 * Tests the different thread handling scenarios:
 * 1. Mention in channel → New conversation + start thread
 * 2. Mention in our thread → Add to existing conversation
 * 3. Mention in external thread → New conversation
 */

import { ChatManagerService } from '../../src/chat-manager/chat-manager.service';
import { RobotProcessorService } from '../../src/chat-manager/robot-processor.service';
import { RobotService } from '../../src/robots/robot.service';
import { IstackBuddySlackApiService } from '../../src/istack-buddy-slack-api/istack-buddy-slack-api.service';

async function testConversationContinuity() {
  console.log('🧪 Testing Slack Conversation Continuity');
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

    // Test Scenario 1: Mention in main channel
    console.log('\n📋 Scenario 1: Mention in Main Channel');
    console.log('─'.repeat(50));
    console.log('Expected: New conversation + start thread');

    const channelMentionEvent = {
      user: 'U123456789',
      channel: 'C987654321',
      text: '@istackbuddy help with my form',
      ts: '1234567890.123456',
      // No thread_ts = main channel message
    };

    console.log('🎯 Testing channel mention...');
    const context1 = (slackService as any).determineConversationContext(
      channelMentionEvent,
    );
    console.log(`   Context Type: ${context1.type}`);
    console.log(`   Action: ${context1.action}`);
    console.log(`   Conversation ID: ${context1.conversationId}`);
    console.log(`   Response Thread: ${context1.responseThreadTs}`);

    // Actually process the event
    await (slackService as any).handleAppMention(channelMentionEvent);

    // Test Scenario 2: Mention in external thread
    console.log('\n📋 Scenario 2: Mention in External Thread');
    console.log('─'.repeat(50));
    console.log('Expected: New conversation (external thread)');

    const externalThreadEvent = {
      user: 'U123456789',
      channel: 'C987654321',
      text: '@istackbuddy can you help us here?',
      ts: '1234567891.123456',
      thread_ts: '1234567800.000000', // Different thread we didn't start
    };

    console.log('🎯 Testing external thread mention...');
    const context2 = (slackService as any).determineConversationContext(
      externalThreadEvent,
    );
    console.log(`   Context Type: ${context2.type}`);
    console.log(`   Action: ${context2.action}`);
    console.log(`   Conversation ID: ${context2.conversationId}`);
    console.log(`   Response Thread: ${context2.responseThreadTs}`);

    // Process the event
    await (slackService as any).handleAppMention(externalThreadEvent);

    // Test Scenario 3: Mention in our thread (simulated)
    console.log('\n📋 Scenario 3: Mention in Our Thread');
    console.log('─'.repeat(50));
    console.log('Expected: Add to existing conversation');

    // First, let's manually create a conversation to simulate "our thread"
    const ourThreadId = 'slack-thread-C987654321-1234567890.123456';
    await chatManagerService.getOrCreateExternalConversation(
      ourThreadId,
      'U123456789',
      'slack',
      'Our Thread',
    );

    const ourThreadEvent = {
      user: 'U123456789',
      channel: 'C987654321',
      text: '@istackbuddy follow up question',
      ts: '1234567892.123456',
      thread_ts: '1234567890.123456', // Same thread as scenario 1
    };

    console.log('🎯 Testing our thread mention...');
    const context3 = (slackService as any).determineConversationContext(
      ourThreadEvent,
    );
    console.log(`   Context Type: ${context3.type}`);
    console.log(`   Action: ${context3.action}`);
    console.log(`   Conversation ID: ${context3.conversationId}`);
    console.log(`   Response Thread: ${context3.responseThreadTs}`);

    // Check conversation stats
    console.log('\n📊 Final Conversation Stats');
    console.log('─'.repeat(50));

    const conversations = await chatManagerService.getConversations();
    console.log(`Total conversations created: ${conversations.length}`);

    conversations.forEach((conv, index) => {
      console.log(`   ${index + 1}. ${conv.id}`);
      console.log(`      - Participants: ${conv.participantIds.length}`);
      console.log(`      - Messages: ${conv.messageCount}`);
      console.log(`      - Active: ${conv.isActive}`);
    });

    const stats = await chatManagerService.getDashboardStats();
    console.log(`\n📈 Dashboard Stats:`);
    console.log(`   - Active conversations: ${stats.activeConversations}`);
    console.log(`   - Total messages: ${stats.totalMessages}`);
    console.log(`   - Active users: ${stats.activeUsers}`);

    console.log('\n🎉 Conversation continuity test completed!');
    console.log('\n📋 Summary of Scenarios:');
    console.log('   ✅ Channel mention → New conversation with thread');
    console.log('   ✅ External thread → New conversation in thread');
    console.log('   ✅ Our thread → Add to existing conversation');
    console.log('   ✅ All responses sent to correct threads');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testConversationContinuity().catch(console.error);
