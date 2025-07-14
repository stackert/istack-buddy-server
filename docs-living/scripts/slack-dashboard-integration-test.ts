#!/usr/bin/env tsx

/**
 * Test script to verify that Slack conversations appear in the dashboard
 *
 * This script simulates a Slack app mention and verifies that:
 * 1. A conversation is created in the ChatManagerService
 * 2. Dashboard events are properly emitted
 * 3. The conversation appears in dashboard stats
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { IstackBuddySlackApiService } from '../../src/istack-buddy-slack-api/istack-buddy-slack-api.service';
import { ChatManagerService } from '../../src/chat-manager/chat-manager.service';
import { ChatManagerGateway } from '../../src/chat-manager/chat-manager.gateway';
import { io } from 'socket.io-client';

async function testSlackDashboardIntegration() {
  console.log('🧪 Starting Slack Dashboard Integration Test...\n');

  const app = await NestFactory.create(AppModule);
  await app.init();

  // Get services
  const slackService = app.get(IstackBuddySlackApiService);
  const chatManagerService = app.get(ChatManagerService);
  const gateway = app.get(ChatManagerGateway);

  // Start the server
  const server = await app.listen(3000);
  console.log('🚀 Server started on port 3000');

  // Connect to WebSocket to listen for dashboard events
  const socket = io('http://localhost:3500');

  // Join dashboard room to receive events
  socket.emit('join_dashboard');

  // Listen for dashboard events
  socket.on('conversation_created', (data) => {
    console.log('🎉 DASHBOARD EVENT: Conversation Created');
    console.log(`   ID: ${data.conversation.id}`);
    console.log(`   Created by: ${data.createdBy}`);
    console.log(`   Source: ${data.source}`);
    console.log(`   Display Name: ${data.displayName}`);
    console.log(`   Participants: ${data.conversation.participantIds.length}`);
    console.log(`   Timestamp: ${data.timestamp}`);
  });

  socket.on('conversation_updated', (data) => {
    console.log('📝 DASHBOARD EVENT: Conversation Updated');
    console.log(`   ID: ${data.conversationId}`);
    console.log(`   Message Count: ${data.changes.messageCount}`);
    console.log(`   Last Message: ${data.changes.lastMessageAt}`);
    console.log(`   Timestamp: ${data.timestamp}`);
  });

  socket.on('message_received', (data) => {
    console.log('💬 DASHBOARD EVENT: Message Received');
    console.log(`   From: ${data.message.fromUserId}`);
    console.log(`   Content: ${data.message.content}`);
    console.log(`   Conversation: ${data.message.conversationId}`);
    console.log(`   Timestamp: ${data.timestamp}`);
  });

  // Wait for connection
  await new Promise((resolve) =>
    socket.on('connect', () => resolve(undefined)),
  );
  console.log('✅ Connected to dashboard WebSocket\n');

  // Get initial dashboard stats
  const initialStats = await chatManagerService.getDashboardStats();
  console.log('📊 Initial Dashboard Stats:');
  console.log(`   Active Conversations: ${initialStats.activeConversations}`);
  console.log(`   Total Messages: ${initialStats.totalMessages}`);
  console.log(`   Active Users: ${initialStats.activeUsers}\n`);

  // Simulate a Slack app mention event
  console.log('🔄 Simulating Slack app mention...');

  // Mock Slack event
  const mockSlackEvent = {
    type: 'app_mention',
    user: 'U123456789',
    channel: 'C987654321',
    text: '<@U0BOTUSER> Hello from Slack! Can you help me with form ID 12345?',
    ts: '1642781234.000100',
    thread_ts: undefined,
  };

  // Mock request and response objects
  const mockReq = {
    body: {
      type: 'event_callback',
      event: mockSlackEvent,
    },
  };

  const mockRes = {
    status: (code: number) => ({
      json: (data: any) =>
        console.log(`📤 Response: ${code} - ${JSON.stringify(data)}`),
    }),
  };

  // Process the Slack event
  await slackService.handleSlackEvent(mockReq, mockRes);

  // Wait a bit for async processing
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Get updated dashboard stats
  const updatedStats = await chatManagerService.getDashboardStats();
  console.log('\n📊 Updated Dashboard Stats:');
  console.log(`   Active Conversations: ${updatedStats.activeConversations}`);
  console.log(`   Total Messages: ${updatedStats.totalMessages}`);
  console.log(`   Active Users: ${updatedStats.activeUsers}`);

  // Get conversations to verify the Slack conversation is included
  const conversations = await chatManagerService.getConversations();
  console.log('\n📋 All Conversations:');
  conversations.forEach((conv, index) => {
    console.log(
      `   ${index + 1}. ${conv.id} (${conv.participantIds.length} participants, ${conv.messageCount} messages)`,
    );
  });

  // Look for the Slack conversation specifically
  const slackConversation = conversations.find((conv) =>
    conv.id.startsWith('slack-channel-'),
  );
  if (slackConversation) {
    console.log('\n✅ SUCCESS: Slack conversation found in dashboard!');
    console.log(`   Conversation ID: ${slackConversation.id}`);
    console.log(
      `   Participants: ${slackConversation.participantIds.join(', ')}`,
    );
    console.log(`   Message Count: ${slackConversation.messageCount}`);
    console.log(`   Last Message: ${slackConversation.lastMessageAt}`);
    console.log(`   Is Active: ${slackConversation.isActive}`);
  } else {
    console.log('\n❌ FAILED: Slack conversation not found in dashboard');
  }

  // Cleanup
  socket.disconnect();
  await server.close();
  await app.close();

  console.log('\n🏁 Test completed');
}

// Run the test
testSlackDashboardIntegration().catch(console.error);
