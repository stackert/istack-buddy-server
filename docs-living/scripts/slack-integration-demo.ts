#!/usr/bin/env tsx

/**
 * Simple demonstration of the Slack integration with ChatManagerService
 *
 * This shows how Slack conversations are integrated into the dashboard
 */

import { ChatManagerService } from '../../src/chat-manager/chat-manager.service';
import { ConversationListSlackAppService } from '../../src/ConversationLists';
import {
  UserRole,
  MessageType,
} from '../../src/chat-manager/dto/create-message.dto';

// Mock gateway for demonstration
const mockGateway = {
  broadcastToDashboard: (event: string, data: any) => {
    console.log(`🎉 DASHBOARD EVENT: ${event}`);
    if (event === 'conversation_created') {
      console.log(`   ID: ${data.conversation.id}`);
      console.log(`   Created by: ${data.createdBy}`);
      console.log(`   Source: ${data.source}`);
      console.log(`   Display Name: ${data.displayName}`);
      console.log(
        `   Participants: ${data.conversation.participantIds.length}`,
      );
      console.log(`   Timestamp: ${data.timestamp}`);
    } else if (event === 'conversation_updated') {
      console.log(`   ID: ${data.conversationId}`);
      console.log(`   Message Count: ${data.changes.messageCount}`);
      console.log(`   Last Message: ${data.changes.lastMessageAt}`);
      console.log(`   Timestamp: ${data.timestamp}`);
    }
  },
  broadcastToConversation: (
    conversationId: string,
    event: string,
    data: any,
  ) => {
    console.log(`💬 CONVERSATION EVENT: ${event} in ${conversationId}`);
    if (event === 'message_received') {
      console.log(`   From: ${data.message.fromUserId}`);
      console.log(
        `   Role: ${data.message.fromRole} -> ${data.message.toRole}`,
      );
      console.log(
        `   Content: ${data.message.content.substring(0, 50)}${data.message.content.length > 50 ? '...' : ''}`,
      );
    }
  },
};

async function demonstrateSlackIntegration() {
  console.log('🎬 Demonstrating Slack Integration with Dashboard\n');

  // Create services
  const conversationListService = new ConversationListSlackAppService();
  const chatManagerService = new ChatManagerService(null as any); // Mock robot service

  // Set up the gateway
  chatManagerService.setGateway(mockGateway);

  console.log('✅ Services initialized');

  // Get initial stats
  const initialStats = await chatManagerService.getDashboardStats();
  console.log('📊 Initial Dashboard Stats:');
  console.log(`   Active Conversations: ${initialStats.activeConversations}`);
  console.log(`   Total Messages: ${initialStats.totalMessages}`);
  console.log(`   Active Users: ${initialStats.activeUsers}\n`);

  // Simulate Slack user mentioning the bot
  console.log('🔄 Simulating Slack user mentioning @istackbuddy...');

  const slackChannel = 'C987654321';
  const slackUser = 'U123456789';
  const conversationId = `slack-channel-${slackChannel}`;

  // Step 1: Create conversation from Slack
  console.log('\n📝 Creating conversation from Slack...');
  const slackConversation =
    await chatManagerService.getOrCreateExternalConversation(
      conversationId,
      slackUser,
      'Slack',
      slackChannel,
    );

  console.log('✅ Conversation created in dashboard');

  // Step 2: Add user's message
  console.log('\n💬 Adding user message...');
  await chatManagerService.addExternalMessage(
    conversationId,
    slackUser,
    'Hello @istackbuddy! Can you help me with form ID 12345?',
    MessageType.TEXT,
    UserRole.CUSTOMER,
    UserRole.AGENT,
  );

  // Step 3: Add bot response
  console.log('\n🤖 Adding bot response...');
  await chatManagerService.addExternalMessage(
    conversationId,
    'istackbuddy-bot',
    'Hello! I received your message about form ID 12345. Let me help you with that. What specific issue are you experiencing?',
    MessageType.ROBOT,
    UserRole.ROBOT,
    UserRole.CUSTOMER,
  );

  // Step 4: Add follow-up message
  console.log('\n💬 Adding follow-up message...');
  await chatManagerService.addExternalMessage(
    conversationId,
    slackUser,
    "I'm having trouble with form submissions not going through.",
    MessageType.TEXT,
    UserRole.CUSTOMER,
    UserRole.AGENT,
  );

  // Step 5: Show updated stats
  console.log('\n📊 Updated Dashboard Stats:');
  const updatedStats = await chatManagerService.getDashboardStats();
  console.log(`   Active Conversations: ${updatedStats.activeConversations}`);
  console.log(`   Total Messages: ${updatedStats.totalMessages}`);
  console.log(`   Active Users: ${updatedStats.activeUsers}`);

  // Step 6: Show all conversations
  console.log('\n📋 All Conversations:');
  const conversations = await chatManagerService.getConversations();
  conversations.forEach((conv, index) => {
    console.log(
      `   ${index + 1}. ${conv.id} (${conv.participantIds.length} participants, ${conv.messageCount} messages)`,
    );
    console.log(`      Last message: ${conv.lastMessageAt}`);
    console.log(`      Is active: ${conv.isActive}`);
  });

  // Step 7: Show messages in the Slack conversation
  console.log('\n💬 Messages in Slack conversation:');
  const messages = await chatManagerService.getMessages(conversationId, {
    limit: 10,
  });
  messages.forEach((msg, index) => {
    console.log(
      `   ${index + 1}. ${msg.fromUserId} (${msg.fromRole} -> ${msg.toRole}):`,
    );
    console.log(`      "${msg.content}"`);
    console.log(`      ${msg.createdAt}`);
  });

  console.log('\n🎉 Integration demonstration complete!');
  console.log('\n🔍 Key Points:');
  console.log('   ✅ Slack conversations are created in the dashboard');
  console.log('   ✅ Dashboard events are properly emitted');
  console.log('   ✅ Messages are tracked and counted');
  console.log('   ✅ Conversation stats are updated in real-time');
  console.log('   ✅ External conversations integrate seamlessly');
}

// Run the demonstration
demonstrateSlackIntegration().catch(console.error);
