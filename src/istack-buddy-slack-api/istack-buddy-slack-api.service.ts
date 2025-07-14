import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotProcessorService } from '../chat-manager/robot-processor.service';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';
import { StartConversationDto } from '../chat-manager/dto/start-conversation.dto';

/**
 * Slack API Service
 * Handles webhook events from Slack workspace
 * Uses single ChatManager system for conversation management
 */
@Injectable()
export class IstackBuddySlackApiService {
  private readonly logger = new Logger(IstackBuddySlackApiService.name);

  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly robotProcessorService: RobotProcessorService,
  ) {
    this.logger.log('🚀 Initializing Slack service...');
  }

  /**
   * Handle incoming Slack events
   * Main entry point for all Slack webhook events
   */
  async handleSlackEvent(req: any, res: any): Promise<void> {
    try {
      const body = req.body;

      // Handle URL verification challenge
      if (body.challenge) {
        this.logger.log('🔐 Received URL verification challenge');
        res.status(200).json({ challenge: body.challenge });
        return;
      }

      // Handle app mention events
      if (body.event && body.event.type === 'app_mention') {
        this.logger.log('📢 Received app mention event');
        await this.handleAppMention(body.event);
        res.status(200).json({ status: 'ok' });
        return;
      }

      // Handle other event types
      this.logger.log(
        `📋 Received event type: ${body.event?.type || 'unknown'}`,
      );
      res.status(200).json({ status: 'ok' });
    } catch (error) {
      this.logger.error('❌ Error handling Slack event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Slack app mentions (@istackbuddy)
   * Implements the new single-system flow:
   * 1. Add immediate reaction acknowledgment
   * 2. Create/get conversation in ChatManager
   * 3. Add user message to conversation
   * 4. Process message with robot (external)
   * 5. Add robot response to conversation
   * 6. Send robot response to Slack
   */
  private async handleAppMention(event: any): Promise<void> {
    try {
      this.logger.log(
        `🎯 Received mention from user ${event.user} in channel ${event.channel}`,
      );
      this.logger.log(`📄 Message text: "${event.text}"`);

      // 🚀 IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
      this.logger.log('⚡ Adding immediate acknowledgment reaction...');
      await this.addSlackReaction('thinking_face', event.channel, event.ts);

      // 🏠 STEP 1: Create/get conversation in ChatManager
      this.logger.log('🏠 Creating/getting conversation...');
      const conversation =
        await this.chatManagerService.getOrCreateExternalConversation(
          event.channel, // Use channel as conversation ID
          event.user, // User who mentioned the bot
          'slack',
          `#${event.channel}`, // Channel name for display
        );

      // 📝 STEP 2: Add user message to conversation
      this.logger.log('📝 Adding user message to conversation...');
      const userMessage = await this.chatManagerService.addExternalMessage(
        conversation.id,
        event.user,
        event.text,
        MessageType.TEXT,
        UserRole.CUSTOMER,
        UserRole.AGENT,
      );

      this.logger.log(`✅ User message added: ${userMessage.id}`);

      // 🤖 STEP 3: Process message with robot (external)
      this.logger.log('🤖 Processing message with robot...');
      const robotResponse =
        await this.robotProcessorService.processSlackMention(
          event.text,
          event.user,
          conversation.id,
        );

      this.logger.log(
        `🎯 Robot response: ${robotResponse.robotName} (${robotResponse.processed ? 'success' : 'failed'})`,
      );

      // 📤 STEP 4: Add robot response to conversation
      this.logger.log('📤 Adding robot response to conversation...');
      const robotMessage = await this.chatManagerService.addExternalMessage(
        conversation.id,
        robotResponse.robotName,
        robotResponse.response,
        MessageType.TEXT,
        UserRole.AGENT,
        UserRole.CUSTOMER,
      );

      this.logger.log(`✅ Robot message added: ${robotMessage.id}`);

      // 📲 STEP 5: Send robot response to Slack
      this.logger.log('📲 Sending response to Slack...');
      await this.sendSlackMessage(
        robotResponse.response,
        event.channel,
        event.ts,
      );

      this.logger.log('🎉 App mention processing completed successfully');
    } catch (error) {
      this.logger.error('❌ Error handling app mention:', error);

      // Send error message to Slack
      try {
        await this.sendSlackMessage(
          `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
          event.channel,
          event.ts,
        );
      } catch (sendError) {
        this.logger.error(
          '❌ Failed to send error message to Slack:',
          sendError,
        );
      }
    }
  }

  /**
   * Send a message to Slack channel
   */
  private async sendSlackMessage(
    message: string,
    channelId: string,
    thread_ts: string,
  ) {
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          text: message,
          thread_ts: thread_ts,
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.ok) {
          this.logger.log(`✅ Message sent to Slack channel ${channelId}`);
        } else {
          this.logger.error(`❌ Slack API error: ${responseData.error}`);
        }
      } else {
        this.logger.error(
          `❌ HTTP error: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      this.logger.error('❌ Error sending message to Slack:', error);
    }
  }

  /**
   * Add an emoji reaction to a Slack message
   */
  private async addSlackReaction(
    emojiName: string,
    channelId: string,
    timestamp: string,
  ) {
    try {
      this.logger.log(
        `🎭 Adding reaction :${emojiName}: to message ${timestamp} in channel ${channelId}`,
      );

      const response = await fetch('https://slack.com/api/reactions.add', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          name: emojiName, // emoji name without colons
          timestamp: timestamp,
        }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.ok) {
        this.logger.log(
          `✅ Added reaction :${emojiName}: to message in channel ${channelId}`,
        );
      } else {
        this.logger.error(
          `❌ Failed to add reaction: ${responseData.error || 'Unknown error'}`,
        );
        this.logger.error(`❌ Response status: ${response.status}`);
        this.logger.error(`❌ Response data:`, responseData);
      }
    } catch (error) {
      this.logger.error('❌ Error adding reaction:', error);
    }
  }

  /**
   * Test method to debug reaction functionality
   */
  async testReaction(channelId: string, timestamp: string, emojiName: string) {
    this.logger.log(
      `🧪 Testing reaction API with channel: ${channelId}, timestamp: ${timestamp}, emoji: ${emojiName}`,
    );

    try {
      await this.addSlackReaction(emojiName, channelId, timestamp);
      return {
        success: true,
        message: `Attempted to add :${emojiName}: reaction. Check server logs for details.`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Estimate token count for a text string
   */
  private estimateTokenCount(text: string): number {
    // Simple estimation: roughly 4 characters per token
    return Math.ceil(text.length / 4);
  }
}
