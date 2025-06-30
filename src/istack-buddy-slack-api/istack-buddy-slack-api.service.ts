import { Injectable, Logger } from '@nestjs/common';
import { ConversationListSlackAppService } from '../ConversationLists';
import type {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  TConversationMessageContentString,
} from '../ConversationLists/types';
import { RobotService } from 'src/robots/robot.service';
import { SlackAgentCoreFormsParrot } from 'src/robots/SlackAgents/SlackAgentCoreFormsParrot';
import { TMessageEnvelope } from 'src/robots';

// Factory for creating conversation messages
class ConversationMessageFactory {
  static createCustomerMessage(
    messageId: string,
    authorRole: string,
    text: string,
    estimatedTokenCount: number,
  ): TConversationTextMessageEnvelope {
    const textContent: TConversationMessageContentString = {
      type: 'text/plain',
      payload: text,
    };

    const textMessage: TConversationTextMessage = {
      messageId,
      author_role: authorRole,
      content: textContent,
      created_at: new Date().toISOString(),
      estimated_token_count: estimatedTokenCount,
    };

    return {
      messageId,
      envelopePayload: textMessage,
    };
  }

  static createRobotMessage(
    messageId: string,
    authorRole: string,
    content: { type: string; payload: string },
    estimatedTokenCount: number,
  ): TConversationTextMessageEnvelope {
    const textContent: TConversationMessageContentString = {
      type: 'text/plain',
      payload: content.payload,
    };

    const textMessage: TConversationTextMessage = {
      messageId,
      author_role: authorRole,
      content: textContent,
      created_at: new Date().toISOString(),
      estimated_token_count: estimatedTokenCount,
    };

    return {
      messageId,
      envelopePayload: textMessage,
    };
  }
}

@Injectable()
export class IstackBuddySlackApiService {
  private readonly logger = new Logger(IstackBuddySlackApiService.name);

  constructor(
    private readonly conversationService: ConversationListSlackAppService,
    private readonly robotService: RobotService,
  ) {
    this.logger.log('🚀 Initializing Slack service...');
    this.logger.log(
      `SLACK_BOT_TOKEN present: ${!!process.env.SLACK_BOT_TOKEN}`,
    );
    this.logger.log(
      `SLACK_SIGNING_SECRET present: ${!!process.env.SLACK_SIGNING_SECRET}`,
    );
    this.logger.log('✅ Slack service initialized for direct event handling');
  }

  // Handle Slack events directly through the controller
  async handleSlackEvent(req: any, res: any): Promise<void> {
    this.logger.log('🎯 Handling Slack event through controller');
    this.logger.log(`Event type: ${req.body?.type || 'unknown'}`);

    try {
      // Handle URL verification challenge
      if (req.body?.type === 'url_verification') {
        this.logger.log(`🔐 URL Verification challenge: ${req.body.challenge}`);
        res.status(200).json({ challenge: req.body.challenge });
        return;
      }

      // Handle event callbacks
      if (req.body?.type === 'event_callback') {
        const event = req.body.event;
        this.logger.log(`📨 Event callback: ${event?.type}`);

        if (event?.type === 'app_mention') {
          await this.handleAppMention(event);
        }

        res.status(200).json({ ok: true });
        return;
      }

      // Default response
      res.status(200).json({ ok: true });
    } catch (error) {
      this.logger.error('❌ Error handling Slack event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleAppMention(event: any): Promise<void> {
    try {
      this.logger.log(
        `🎯 Received mention from user ${event.user} in channel ${event.channel}`,
      );
      this.logger.log(`📄 Message text: "${event.text}"`);
      this.logger.debug(`event json: "${JSON.stringify(event)}"`);

      // Create conversation ID from channel
      const conversationId = `slack-channel-${event.channel}`;

      // Get or create conversation for this Slack channel
      const conversation = this.conversationService.getConversationOrCreate(
        conversationId,
        `Slack Channel ${event.channel}`,
        `Slack conversation for channel ${event.channel}`,
      );

      // Add the user's message to the conversation
      const userMessage = ConversationMessageFactory.createCustomerMessage(
        `slack-msg-${event.ts}`,
        event.user,
        event.text,
        this.estimateTokenCount(event.text),
      );
      conversation.addTextMessageEnvelope(userMessage);

      const robot = this.robotService.getRobotByName<SlackAgentCoreFormsParrot>(
        'SlackAgentCoreFormsParrot',
      );
      if (!robot) {
        this.logger.error('❌ Robot not found');
        return;
      }

      const messageEnvelope: TMessageEnvelope =
        this.slackMessageToMessageEnvelope(userMessage);

      robot.acceptMessageMultiPartResponse(messageEnvelope, (response) => {
        this.logger.log(`🤖 Robot response: ${response}`);
        //        conversation.addMessage(response); //
        this.sendSlackMessage(
          response.envelopePayload.content.payload || '__EMPTY_MESSAGE__',
          event.channel,
          event.ts,
        );
      });

      this.logger.log(
        `💬 Added user message to conversation ${conversationId} (total messages: ${conversation.getMessageCount()})`,
      );

      // Get current time for response
      const currentTime = new Date().toLocaleString();
      const botResponseText = `🤖 Current time: ${currentTime}\n\n📊 Conversation stats:\n- Total messages: ${conversation.getMessageCount()}\n- Conversation ID: ${conversationId}`;

      // Use Slack Web API to respond
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: event.channel,
          text: botResponseText,
          thread_ts: event.ts, // Reply in thread
        }),
      });

      if (response.ok) {
        // Add the bot's response to the conversation
        const botMessage = ConversationMessageFactory.createRobotMessage(
          `slack-bot-msg-${Date.now()}`,
          'slack-bot',
          { type: 'text/plain', payload: botResponseText },
          this.estimateTokenCount(botResponseText),
        );
        conversation.addTextMessageEnvelope(botMessage);

        this.logger.log(
          `✅ Responded and added bot message to conversation. Total messages: ${conversation.getMessageCount()}`,
        );
      } else {
        const errorData = await response.text();
        this.logger.error(`❌ Failed to send message: ${errorData}`);
      }
    } catch (error) {
      this.logger.error('❌ Error handling app mention:', error);
    }
  }

  private slackMessageToMessageEnvelope(
    message: TConversationTextMessageEnvelope,
  ): TMessageEnvelope {
    return message; // The message is already in the correct format
  }

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
          thread_ts: thread_ts, // Reply in thread
        }),
      });

      if (response.ok) {
        this.logger.log(
          `✅ Responded and added bot message to conversation. message sent to Slack channelId: '${channelId}', thread_ts '${thread_ts}}'.`,
        );
      } else {
        const errorData = await response.text();
        this.logger.error(`❌ Failed to send message: ${errorData}`);
      }
    } catch (error) {
      this.logger.error('❌ Error handling app mention:', error);
    }
  }

  private estimateTokenCount(text: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(text.length / 4);
  }
}
