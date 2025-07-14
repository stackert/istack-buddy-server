npx#!/usr/bin/env tsx

/**
 * Script to check current conversations in the dashboard
 * This will show all conversations including any from Slack
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { ChatManagerService } from '../../src/chat-manager/chat-manager.service';

async function checkDashboardConversations() {
  console.log('🔍 Checking Dashboard Conversations...\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  try {
    const chatManagerService = app.get(ChatManagerService);

    // Get dashboard stats
    const stats = await chatManagerService.getDashboardStats();
    console.log('📊 Current Dashboard Stats:');
    console.log(`   Active Conversations: ${stats.activeConversations}`);
    console.log(`   Total Messages: ${stats.totalMessages}`);
    console.log(`   Active Users: ${stats.activeUsers}`);
    console.log(`   Queued Conversations: ${stats.queuedConversations}\n`);

    // Get all conversations
    const conversations = await chatManagerService.getConversations();
    console.log(`📋 All Conversations (${conversations.length} total):`);

    conversations.forEach((conv, index) => {
      const isSlackConversation = conv.id.startsWith('slack-channel-');
      const prefix = isSlackConversation ? '🔗 [SLACK]' : '💬';

      console.log(`   ${index + 1}. ${prefix} ${conv.id}`);
      console.log(
        `      Participants: ${conv.participantIds.length} (${conv.participantIds.join(', ')})`,
      );
      console.log(`      Messages: ${conv.messageCount}`);
      console.log(`      Last Activity: ${conv.lastMessageAt}`);
      console.log(`      Active: ${conv.isActive ? '✅' : '❌'}`);
      console.log(`      Created: ${conv.createdAt}`);
      console.log('');
    });

    // Focus on Slack conversations
    const slackConversations = conversations.filter((conv) =>
      conv.id.startsWith('slack-channel-'),
    );
    if (slackConversations.length > 0) {
      console.log(`🔗 Slack Conversations Found: ${slackConversations.length}`);

      for (const slackConv of slackConversations) {
        console.log(`\n📱 Slack Channel: ${slackConv.id}`);
        console.log(
          `   Channel ID: ${slackConv.id.replace('slack-channel-', '')}`,
        );
        console.log(`   Participants: ${slackConv.participantIds.join(', ')}`);
        console.log(`   Message Count: ${slackConv.messageCount}`);
        console.log(`   Last Message: ${slackConv.lastMessageAt}`);

        // Get messages for this conversation
        try {
          const messages = await chatManagerService.getMessages(slackConv.id, {
            limit: 5,
          });
          console.log(`   Recent Messages (${messages.length}):`);
          messages.forEach((msg, msgIndex) => {
            console.log(
              `      ${msgIndex + 1}. ${msg.fromUserId} (${msg.fromRole} → ${msg.toRole}):`,
            );
            console.log(
              `         "${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}"`,
            );
            console.log(`         ${msg.createdAt}`);
          });
        } catch (error) {
          console.log(`   ❌ Error getting messages: ${error.message}`);
        }
      }
    } else {
      console.log('❌ No Slack conversations found in dashboard');
      console.log('\n🔧 Troubleshooting:');
      console.log(
        '   1. Check that Slack bot is properly configured with environment variables',
      );
      console.log(
        '   2. Verify that the Slack service is properly integrated with ChatManagerService',
      );
      console.log(
        '   3. Check server logs for any errors during Slack event processing',
      );
    }
  } catch (error) {
    console.error('❌ Error checking dashboard:', error);
  } finally {
    await app.close();
  }
}

// Run the check
checkDashboardConversations().catch(console.error);
