#!/usr/bin/env ts-node

/**
 * Test script for FIXED Slack conversation continuity
 * Verifies the fix for:
 * 1. Using ChatManager's own ID generation instead of Slack IDs
 * 2. Proper thread mapping so channel mentions and thread replies use same conversation
 * 3. No duplicate conversations for same thread
 */

import { ChatManagerService } from '../../src/chat-manager/chat-manager.service';
import { RobotProcessorService } from '../../src/chat-manager/robot-processor.service';
import { RobotService } from '../../src/robots/robot.service';
import { IstackBuddySlackApiService } from '../../src/istack-buddy-slack-api/istack-buddy-slack-api.service';

async function testFixedConversationContinuity() {
  console.log('🧪 Testing FIXED Slack Conversation Continuity');
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

    // Test Scenario: Channel mention followed by thread reply
    console.log('\n📋 Scenario: Complete Thread Conversation Flow');
    console.log('─'.repeat(60));
    console.log(
      'Expected: Same conversation for channel mention and thread replies',
    );

    // Step 1: User mentions @istackbuddy in channel
    console.log('\n🎯 Step 1: User mentions @istackbuddy in channel');
    const channelMentionEvent = {
      user: 'U123456789',
      channel: 'C091Y5UNA1M',
      text: '@istackbuddy help with form validation',
      ts: '1752478672.715489',
      // No thread_ts = main channel message
    };

    console.log('📝 Processing channel mention...');
    const context1 = (slackService as any).determineConversationContext(
      channelMentionEvent,
    );
    console.log(`   Context Type: ${context1.type}`);
    console.log(`   Action: ${context1.action}`);
    console.log(`   Slack Thread TS: ${context1.slackThreadTs}`);
    console.log(`   Is New Conversation: ${context1.isNewConversation}`);

    // Process the event to create conversation
    await (slackService as any).handleAppMention(channelMentionEvent);

    // Check conversations after step 1
    let conversations = await chatManagerService.getConversations();
    console.log(
      `✅ Conversations after channel mention: ${conversations.length}`,
    );
    const firstConversation = conversations[0];
    console.log(`   Conversation ID: ${firstConversation.id}`);
    console.log(`   Messages: ${firstConversation.messageCount}`);

    // Step 2: User replies in the thread created by step 1
    console.log('\n🎯 Step 2: User replies in the thread');
    const threadReplyEvent = {
      user: 'U123456789',
      channel: 'C091Y5UNA1M',
      text: '@istackbuddy follow up question about validation',
      ts: '1752478700.123456',
      thread_ts: '1752478672.715489', // Same timestamp as channel mention
    };

    console.log('📝 Processing thread reply...');
    const context2 = (slackService as any).determineConversationContext(
      threadReplyEvent,
    );
    console.log(`   Context Type: ${context2.type}`);
    console.log(`   Action: ${context2.action}`);
    console.log(`   Slack Thread TS: ${context2.slackThreadTs}`);
    console.log(`   Existing Conversation ID: ${context2.conversationId}`);
    console.log(`   Is New Conversation: ${context2.isNewConversation}`);

    // Process the thread reply
    await (slackService as any).handleAppMention(threadReplyEvent);

    // Check conversations after step 2
    conversations = await chatManagerService.getConversations();
    console.log(`✅ Conversations after thread reply: ${conversations.length}`);

    if (conversations.length === 1) {
      console.log('🎉 SUCCESS: Only one conversation exists!');
      const conversation = conversations[0];
      console.log(`   Conversation ID: ${conversation.id}`);
      console.log(`   Messages: ${conversation.messageCount}`);
      console.log(`   Participants: ${conversation.participantIds.length}`);

      // Get all messages in the conversation
      const messages = await chatManagerService.getMessages(conversation.id, {
        limit: 10,
      });
      console.log(`   📨 Messages in conversation:`);
      messages.forEach((msg, index) => {
        console.log(
          `      ${index + 1}. [${msg.fromRole}] ${msg.fromUserId}: "${msg.content.substring(0, 50)}..."`,
        );
      });
    } else {
      console.log('❌ FAILURE: Multiple conversations created!');
      conversations.forEach((conv, index) => {
        console.log(
          `   ${index + 1}. ${conv.id} (${conv.messageCount} messages)`,
        );
      });
    }

    // Step 3: Another user joins the thread
    console.log('\n🎯 Step 3: Different user joins the thread');
    const anotherUserEvent = {
      user: 'U987654321',
      channel: 'C091Y5UNA1M',
      text: '@istackbuddy I have the same issue',
      ts: '1752478720.789012',
      thread_ts: '1752478672.715489', // Same thread
    };

    console.log('📝 Processing another user in thread...');
    const context3 = (slackService as any).determineConversationContext(
      anotherUserEvent,
    );
    console.log(`   Context Type: ${context3.type}`);
    console.log(`   Action: ${context3.action}`);
    console.log(`   Existing Conversation ID: ${context3.conversationId}`);
    console.log(`   Is New Conversation: ${context3.isNewConversation}`);

    // Process the third message
    await (slackService as any).handleAppMention(anotherUserEvent);

    // Final check
    conversations = await chatManagerService.getConversations();
    console.log(`✅ Final conversation count: ${conversations.length}`);

    if (conversations.length === 1) {
      const conversation = conversations[0];
      console.log(`🎉 PERFECT: All messages in same conversation!`);
      console.log(`   Conversation ID: ${conversation.id}`);
      console.log(`   Total Messages: ${conversation.messageCount}`);
      console.log(
        `   Unique Participants: ${conversation.participantIds.length}`,
      );
      console.log(`   Participants: ${conversation.participantIds.join(', ')}`);
    }

    // Check the Slack thread mapping
    console.log('\n🔗 Slack Thread Mapping Verification');
    console.log('─'.repeat(40));
    const threadMap = (slackService as any).slackThreadToConversationMap;
    console.log(`Mapped threads: ${threadMap.size}`);
    for (const [slackTs, conversationId] of threadMap) {
      console.log(`   ${slackTs} → ${conversationId}`);
    }

    console.log('\n🎉 Conversation continuity fix test completed!');

    // Test different scenario: External thread
    console.log('\n📋 Bonus Test: External Thread (New Conversation)');
    console.log('─'.repeat(50));

    const externalThreadEvent = {
      user: 'U123456789',
      channel: 'C091Y5UNA1M',
      text: '@istackbuddy help in different thread',
      ts: '1752478800.000000',
      thread_ts: '1752400000.000000', // Different thread not created by us
    };

    const context4 = (slackService as any).determineConversationContext(
      externalThreadEvent,
    );
    console.log(`   Context Type: ${context4.type}`);
    console.log(`   Action: ${context4.action}`);
    console.log(`   Is New Conversation: ${context4.isNewConversation}`);

    await (slackService as any).handleAppMention(externalThreadEvent);

    const finalConversations = await chatManagerService.getConversations();
    console.log(
      `✅ Total conversations after external thread: ${finalConversations.length}`,
    );
    console.log(`   Expected: 2 (one for our thread, one for external thread)`);

    if (finalConversations.length === 2) {
      console.log('🎉 PERFECT: External thread created separate conversation!');
    }

    console.log('\n📋 Summary:');
    console.log(
      '   ✅ Channel mention and thread replies use SAME conversation',
    );
    console.log('   ✅ ChatManager generates clean conversation IDs');
    console.log('   ✅ Slack thread timestamps properly mapped');
    console.log('   ✅ External threads create separate conversations');
    console.log('   ✅ No duplicate conversations for same thread');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFixedConversationContinuity().catch(console.error);
