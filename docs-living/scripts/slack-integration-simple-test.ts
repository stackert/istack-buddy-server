#!/usr/bin/env tsx

/**
 * Simple test to verify the Slack integration with ChatManagerService
 *
 * This test directly tests the integration without starting the full application
 */

import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiService } from '../../src/istack-buddy-slack-api/istack-buddy-slack-api.service';
import { ChatManagerService } from '../../src/chat-manager/chat-manager.service';
import { ConversationListSlackAppService } from '../../src/ConversationLists';
import { RobotService } from '../../src/robots/robot.service';
import { RobotChatAnthropic } from '../../src/robots/RobotChatAnthropic';

// Mock the robot service and its dependencies
const mockRobotService = {
  getRobotByName: jest.fn().mockReturnValue({
    acceptMessageImmediateResponse: jest.fn().mockResolvedValue({
      messageId: 'robot-response-123',
      requestOrResponse: 'response',
      envelopePayload: {
        messageId: 'robot-response-123',
        author_role: 'robot',
        content: {
          type: 'text/plain',
          payload:
            'Hello! I received your message about form ID 12345. How can I help you?',
        },
        created_at: new Date().toISOString(),
        estimated_token_count: 50,
      },
    }),
  }),
};

// Mock the gateway for ChatManagerService
const mockGateway = {
  broadcastToDashboard: jest.fn(),
  broadcastToConversation: jest.fn(),
};

async function testSlackIntegration() {
  console.log('🧪 Starting Simple Slack Integration Test...\n');

  // Create a test module
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      IstackBuddySlackApiService,
      ChatManagerService,
      ConversationListSlackAppService,
      {
        provide: RobotService,
        useValue: mockRobotService,
      },
    ],
  }).compile();

  const slackService = module.get<IstackBuddySlackApiService>(
    IstackBuddySlackApiService,
  );
  const chatManagerService = module.get<ChatManagerService>(ChatManagerService);

  // Set up the gateway mock
  chatManagerService.setGateway(mockGateway);

  console.log('✅ Services initialized');

  // Get initial stats
  const initialStats = await chatManagerService.getDashboardStats();
  console.log('📊 Initial Dashboard Stats:');
  console.log(`   Active Conversations: ${initialStats.activeConversations}`);
  console.log(`   Total Messages: ${initialStats.totalMessages}`);
  console.log(`   Active Users: ${initialStats.activeUsers}\n`);

  // Get initial conversations
  const initialConversations = await chatManagerService.getConversations();
  console.log(`📋 Initial Conversations: ${initialConversations.length}`);
  initialConversations.forEach((conv, index) => {
    console.log(
      `   ${index + 1}. ${conv.id} (${conv.participantIds.length} participants)`,
    );
  });

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
      json: (data: any) => {
        console.log(`📤 Response: ${code} - ${JSON.stringify(data)}`);
        return { json: () => {} };
      },
    }),
  };

  console.log('🔄 Processing Slack app mention...');

  // Process the Slack event
  await slackService.handleSlackEvent(mockReq, mockRes);

  console.log('✅ Slack event processed\n');

  // Check what dashboard events were called
  console.log('📡 Dashboard Events Called:');
  console.log(
    `   broadcastToDashboard called ${mockGateway.broadcastToDashboard.mock.calls.length} times`,
  );

  mockGateway.broadcastToDashboard.mock.calls.forEach((call, index) => {
    const [eventType, data] = call;
    console.log(`   ${index + 1}. Event: ${eventType}`);
    if (eventType === 'conversation_created') {
      console.log(`      Conversation ID: ${data.conversation.id}`);
      console.log(`      Created by: ${data.createdBy}`);
      console.log(`      Source: ${data.source}`);
      console.log(`      Display Name: ${data.displayName}`);
    } else if (eventType === 'conversation_updated') {
      console.log(`      Conversation ID: ${data.conversationId}`);
      console.log(`      Message Count: ${data.changes.messageCount}`);
    }
  });

  console.log(
    `   broadcastToConversation called ${mockGateway.broadcastToConversation.mock.calls.length} times`,
  );
  mockGateway.broadcastToConversation.mock.calls.forEach((call, index) => {
    const [conversationId, eventType, data] = call;
    console.log(
      `   ${index + 1}. Conversation: ${conversationId}, Event: ${eventType}`,
    );
  });

  // Get updated stats
  const updatedStats = await chatManagerService.getDashboardStats();
  console.log('\n📊 Updated Dashboard Stats:');
  console.log(`   Active Conversations: ${updatedStats.activeConversations}`);
  console.log(`   Total Messages: ${updatedStats.totalMessages}`);
  console.log(`   Active Users: ${updatedStats.activeUsers}`);

  // Get updated conversations
  const updatedConversations = await chatManagerService.getConversations();
  console.log(`\n📋 Updated Conversations: ${updatedConversations.length}`);
  updatedConversations.forEach((conv, index) => {
    console.log(
      `   ${index + 1}. ${conv.id} (${conv.participantIds.length} participants, ${conv.messageCount} messages)`,
    );
  });

  // Look for the Slack conversation
  const slackConversation = updatedConversations.find((conv) =>
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

    // Get messages for this conversation
    const messages = await chatManagerService.getMessages(
      slackConversation.id,
      { limit: 10 },
    );
    console.log(`   Messages in conversation: ${messages.length}`);
    messages.forEach((msg, index) => {
      console.log(
        `      ${index + 1}. From: ${msg.fromUserId}, Role: ${msg.fromRole} -> ${msg.toRole}`,
      );
      console.log(
        `         Content: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`,
      );
    });
  } else {
    console.log('\n❌ FAILED: Slack conversation not found in dashboard');
  }

  console.log('\n🏁 Test completed');
}

// Run the test
testSlackIntegration().catch(console.error);
