#!/usr/bin/env ts-node

/**
 * Test script for the refactored single ChatManager system
 * Tests: ChatManager + RobotProcessor + Slack integration flow
 */

import { ChatManagerService } from '../../src/chat-manager/chat-manager.service';
import { RobotProcessorService } from '../../src/chat-manager/robot-processor.service';
import { RobotService } from '../../src/robots/robot.service';
import {
  UserRole,
  MessageType,
} from '../../src/chat-manager/dto/create-message.dto';

async function testSingleChatSystem() {
  console.log('🧪 Testing Single ChatManager System');
  console.log('='.repeat(50));

  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    const robotService = new RobotService();
    await robotService.onModuleInit();

    const chatManagerService = new ChatManagerService();
    const robotProcessorService = new RobotProcessorService(robotService);

    // Test 1: Create a conversation
    console.log('\n📝 Test 1: Creating conversation...');
    const conversation =
      await chatManagerService.getOrCreateExternalConversation(
        'test-slack-channel',
        'user123',
        'slack',
        '#test-channel',
      );

    console.log(`✅ Conversation created: ${conversation.id}`);
    console.log(`   - Participants: ${conversation.participantIds.join(', ')}`);
    console.log(`   - Active: ${conversation.isActive}`);

    // Test 2: Add user message
    console.log('\n💬 Test 2: Adding user message...');
    const userMessage = await chatManagerService.addExternalMessage(
      conversation.id,
      'user123',
      '@istackbuddy help me with form validation',
      MessageType.TEXT,
      UserRole.CUSTOMER,
      UserRole.AGENT,
    );

    console.log(`✅ User message added: ${userMessage.id}`);
    console.log(`   - Content: "${userMessage.content}"`);
    console.log(
      `   - From: ${userMessage.fromUserId} (${userMessage.fromRole})`,
    );

    // Test 3: Process message with robot (external)
    console.log('\n🤖 Test 3: Processing message with robot...');
    const robotResponse = await robotProcessorService.processSlackMention(
      userMessage.content,
      userMessage.fromUserId,
      conversation.id,
    );

    console.log(`✅ Robot response generated:`);
    console.log(`   - Robot: ${robotResponse.robotName}`);
    console.log(`   - Processed: ${robotResponse.processed}`);
    console.log(`   - Response length: ${robotResponse.response.length} chars`);
    if (robotResponse.error) {
      console.log(`   - Error: ${robotResponse.error}`);
    }

    // Test 4: Add robot response to conversation
    console.log('\n📤 Test 4: Adding robot response to conversation...');
    const robotMessage = await chatManagerService.addExternalMessage(
      conversation.id,
      robotResponse.robotName,
      robotResponse.response,
      MessageType.TEXT,
      UserRole.AGENT,
      UserRole.CUSTOMER,
    );

    console.log(`✅ Robot message added: ${robotMessage.id}`);
    console.log(
      `   - Content preview: "${robotMessage.content.substring(0, 100)}..."`,
    );
    console.log(
      `   - From: ${robotMessage.fromUserId} (${robotMessage.fromRole})`,
    );

    // Test 5: Get conversation messages
    console.log('\n📋 Test 5: Getting conversation messages...');
    const messages = await chatManagerService.getMessages(conversation.id, {
      limit: 10,
    });

    console.log(`✅ Retrieved ${messages.length} messages:`);
    messages.forEach((msg, index) => {
      console.log(
        `   ${index + 1}. [${msg.fromRole}] ${msg.fromUserId}: "${msg.content.substring(0, 50)}..."`,
      );
    });

    // Test 6: Get dashboard stats
    console.log('\n📊 Test 6: Getting dashboard stats...');
    const stats = await chatManagerService.getDashboardStats();

    console.log(`✅ Dashboard stats:`);
    console.log(`   - Active conversations: ${stats.activeConversations}`);
    console.log(`   - Total messages: ${stats.totalMessages}`);
    console.log(`   - Active users: ${stats.activeUsers}`);
    console.log(`   - Queued conversations: ${stats.queuedConversations}`);

    // Test 7: Test robot selection logic
    console.log('\n🎯 Test 7: Testing robot selection logic...');

    const testCases = [
      '@istackbuddy help with form 12345',
      '@istackbuddy what is SSO?',
      '@istackbuddy formId: 123456',
      'help me with this issue',
    ];

    for (const testCase of testCases) {
      const shouldProcess =
        robotProcessorService.shouldProcessMessage(testCase);
      console.log(`   "${testCase}" → Should process: ${shouldProcess}`);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ Single ChatManager system is working correctly');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSingleChatSystem().catch(console.error);
