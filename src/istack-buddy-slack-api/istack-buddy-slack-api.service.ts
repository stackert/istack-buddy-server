import { Injectable, Logger } from '@nestjs/common';
import { ConversationListSlackAppService } from '../ConversationLists';
import type {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  TConversationMessageContentString,
} from '../ConversationLists/types';
import { RobotService } from '../robots/robot.service';
import { RobotChatAnthropic } from '../robots/RobotChatAnthropic';

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
      requestOrResponse: 'request',
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
      requestOrResponse: 'response',
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

      const robot =
        this.robotService.getRobotByName<RobotChatAnthropic>(
          'RobotChatAnthropic',
        );
      if (!robot) {
        this.logger.error('❌ Robot not found');
        return;
      }

      const messageEnvelope: TConversationTextMessageEnvelope =
        this.slackMessageToMessageEnvelope(userMessage);

      // Use immediate response for better integration with Anthropic
      try {
        const response =
          await robot.acceptMessageImmediateResponse(messageEnvelope);

        // Send the response to Slack
        await this.sendSlackMessage(
          response.envelopePayload.content.payload,
          event.channel,
          event.ts,
        );

        // Add response to conversation
        conversation.addTextMessageEnvelope(response);

        this.logger.log(
          `✅ Successfully processed message and sent response. Total messages: ${conversation.getMessageCount()}`,
        );
      } catch (error) {
        this.logger.error('❌ Error getting robot response:', error);
        await this.sendSlackMessage(
          '❌ Sorry, I encountered an error processing your request.',
          event.channel,
          event.ts,
        );
      }
    } catch (error) {
      this.logger.error('❌ Error handling app mention:', error);
    }
  }

  private slackMessageToMessageEnvelope(
    message: TConversationTextMessageEnvelope,
  ): TConversationTextMessageEnvelope {
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
