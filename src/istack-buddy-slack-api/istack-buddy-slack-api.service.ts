import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SlackyAnthropicAgent } from '../robots/SlackyAnthropicAgent';
import { RobotService } from '../robots/robot.service';
import { v4 as uuidv4 } from 'uuid';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';
import { TConversationTextMessageEnvelope } from '../robots/types';
import type { IConversationMessage } from '../chat-manager';

// Interface for storing Slack conversation mapping and callback
interface TSlackInterfaceRecord {
  internalConversationId: string;
  slackConversationId: string; // Slack thread timestamp
  sendConversationResponseToSlack: (
    delayedResponse: TConversationTextMessageEnvelope,
  ) => Promise<void>;
}

/**
 * Slack API Service
 *
 * Handles integration between Slack events and the internal conversation system.
 * Manages conversation mapping, event deduplication, and robot responses.
 */
@Injectable()
export class IstackBuddySlackApiService implements OnModuleDestroy {
  private readonly logger = new Logger(IstackBuddySlackApiService.name);

  private uniqueEventList: Record<string, any> = {};
  private readonly eventCleanupInterval = 60000; // 1 minute
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  // Map Slack thread timestamps to conversation records with callbacks
  private readonly slackThreadToConversationMap: Record<
    string,
    TSlackInterfaceRecord
  > = {};

  public constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly robotService: RobotService,
  ) {
    // Clean up old processed events and slack mappings every minute
    this.cleanupIntervalId = setInterval(() => {
      this.routineGarbageCollection();
    }, this.eventCleanupInterval);
  }

  /**
   * Cleanup resources when module is destroyed
   */
  public onModuleDestroy() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      this.logger.log('Cleaned up garbage collection interval');
    }
  }

  private makeSimplifiedEvent(event: any): {
    eventType: string;
    conversationId: string;
    message: string;
    eventTs: string;
  } {
    if (!event.thread_ts) {
      return {
        eventType: 'conversation_start',
        conversationId: event.ts,
        message: event.text,
        eventTs: event.ts,
      };
    } else {
      return {
        eventType: 'thread_reply',
        conversationId: event.thread_ts,
        message: event.text,
        eventTs: event.ts,
      };
    }
  }

  /**
   * Handle incoming Slack events
   * Main entry point for all Slack webhook events
   */
  public async handleSlackEvent(req: any, res: any): Promise<void> {
    const simpleEvent = this.makeSimplifiedEvent(req.body.event);

    const body = req.body;
    if (this.uniqueEventList[simpleEvent.eventTs]) {
      this.logger.log(`Duplicate event detected: ${body.event_id}`);
      res.status(200).json({ status: 'ok' });
      return;
    }
    this.uniqueEventList[simpleEvent.eventTs] = body;

    try {
      // Handle URL verification challenge (Slack App setup)
      if (body.challenge) {
        // Slack initiation/setup requirement to verify URL
        res.status(200).json({ challenge: body.challenge });
        return;
      }

      // Handle app mention events
      if (body.event && body.event.type === 'app_mention') {
        this.logger.log('Received app mention event');
        await this.handleAppMention(body.event);
        res.status(200).json({ status: 'ok' });
        return;
      }

      // it wasn't a mention - we're done, goodbye
      res.status(200).json({ status: 'ok' });
    } catch (error) {
      this.logger.error('Error handling Slack event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Slack app mentions (@istackbuddy)
   * Implements conversation continuity with smart thread handling:
   * - Mention in channel → New conversation + start thread
   * - Mention in our thread → Add to existing conversation
   * - Mention in external thread → New conversation
   */
  private async handleAppMention(event: any): Promise<void> {
    const simpleEvent = this.makeSimplifiedEvent(event);

    try {
      if (simpleEvent.eventType === 'conversation_start') {
        // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
        await this.addSlackReaction('thinking_face', event.channel, event.ts);

        const conversation = await this.chatManagerService.startConversation({
          createdBy: event.user,
          createdByRole: UserRole.CUSTOMER,
          title: 'Slack Channel Conversation',
          description: `Slack conversation from channel mention`,
          initialParticipants: [event.user],
        });

        const userMessage = await this.chatManagerService.addMessage({
          conversationId: conversation.id,
          fromUserId: 'cx-slack-robot', // Generic Slack robot user - actual Slack user not tracked
          content: event.text,
          messageType: MessageType.TEXT,
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
        });

        // Create callback function for this specific conversation
        const sendConversationResponseToSlack = async (
          delayedResponse: TConversationTextMessageEnvelope,
        ) => {
          // Add robot response to conversation history
          await this.chatManagerService.addMessage({
            conversationId: conversation.id,
            fromUserId: 'cx-slack-robot',
            content: delayedResponse.envelopePayload.content.payload,
            messageType: MessageType.ROBOT,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.CUSTOMER,
          });

          // Send message to Slack
          await this.sendSlackMessage(
            delayedResponse.envelopePayload.content.payload,
            event.channel,
            event.ts, // this is what creates the thread
          );
        };

        // Map the Slack thread to conversation record with callback for future lookups
        this.slackThreadToConversationMap[event.ts] = {
          internalConversationId: conversation.id,
          slackConversationId: event.ts,
          sendConversationResponseToSlack,
        };

        // --------------------
        const robot = this.robotService.getRobotByName<SlackyAnthropicAgent>(
          'SlackyAnthropicAgent',
        )!;

        // this creates the first message in the thread
        const messageEnvelope = await this.createMessageEnvelopeWithHistory({
          conversationId: conversation.id,
          fromUserId: event.user,
          content: event.text,
        });

        const response = await robot.acceptMessageMultiPartResponse(
          messageEnvelope,
          sendConversationResponseToSlack,
        );
        // ----------------------

        return;
      } else if (simpleEvent.eventType === 'thread_reply') {
        // Thread message with existing mapping - ADD message to conversation
        const conversationRecord =
          this.slackThreadToConversationMap[event.thread_ts];

        if (!conversationRecord) {
          // Unknown scenario - log and ignore
          this.logger.log(
            `Ignoring event - thread_ts: ${event.thread_ts}, no mapping found or unrecognized pattern`,
          );
          return;
        }

        const userMessage = await this.chatManagerService.addMessage({
          conversationId: conversationRecord.internalConversationId,
          fromUserId: 'cx-slack-robot', // Generic Slack robot user - actual Slack user not tracked
          content: event.text,
          messageType: MessageType.TEXT,
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
        });

        // --------------------
        const robot = this.robotService.getRobotByName<SlackyAnthropicAgent>(
          'SlackyAnthropicAgent',
        )!;

        const messageEnvelope = await this.createMessageEnvelopeWithHistory({
          conversationId: conversationRecord.internalConversationId,
          fromUserId: event.user,
          content: event.text,
        });

        const response = await robot.acceptMessageMultiPartResponse(
          messageEnvelope,
          conversationRecord.sendConversationResponseToSlack,
        );
        // ----------------------
      } else {
        // looks like it was not a channel or thread mention - we're done, goodbye
        // Unknown scenario - log and ignore
        this.logger.log(
          `Ignoring event - thread_ts: ${event.thread_ts}, no mapping found or unrecognized pattern`,
        );
      }
    } catch (error) {
      this.logger.error('Error handling app mention:', error);

      // Send error message to Slack (in correct thread)
      try {
        const responseThreadTs = event.thread_ts || event.ts;
        await this.sendSlackMessage(
          `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
          event.channel,
          responseThreadTs,
        );
      } catch (sendError) {
        this.logger.error('Failed to send error message to Slack:', sendError);
      }
      throw error;
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
          this.logger.log(`Message sent to Slack channel ${channelId}`);
        } else {
          this.logger.error(`Slack API error: ${responseData.error}`);
        }
      } else {
        this.logger.error(
          `HTTP error: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      this.logger.error('Error sending message to Slack:', error);
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
        `Adding reaction :${emojiName}: to message ${timestamp} in channel ${channelId}`,
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
          `Added reaction :${emojiName}: to message in channel ${channelId}`,
        );
      } else {
        this.logger.error(
          `Failed to add reaction: ${responseData.error || 'Unknown error'}`,
        );
        this.logger.error(`Response status: ${response.status}`);
        this.logger.error(`Response data:`, responseData);
      }
    } catch (error) {
      this.logger.error('Error adding reaction:', error);
    }
  }

  /**
   * Test method to debug reaction functionality
   */
  public async testReaction(
    channelId: string,
    timestamp: string,
    emojiName: string,
  ) {
    this.logger.log(
      `Testing reaction API with channel: ${channelId}, timestamp: ${timestamp}, emoji: ${emojiName}`,
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

  private routineGarbageCollection(): void {
    // Clean up old conversation mappings that are no longer needed
    const now = Date.now();
    const cutoffTime = now - 24 * 60 * 60 * 1000; // 24 hours ago

    // Remove old unique events (older than 24 hours)
    Object.keys(this.uniqueEventList).forEach((eventTs) => {
      const eventTime = parseFloat(eventTs) * 1000; // Convert to milliseconds
      if (eventTime < cutoffTime) {
        delete this.uniqueEventList[eventTs];
      }
    });

    this.logger.log(`Garbage collection completed. Cleaned up old events.`);
  }

  /**
   * Create message envelope with full conversation history
   * This replaces the simple createMessageEnvelope method
   */
  private async createMessageEnvelopeWithHistory(request: {
    conversationId: string;
    fromUserId: string;
    content: string;
  }): Promise<TConversationTextMessageEnvelope> {
    // Get conversation history - get last 20 messages to provide context
    const filteredHistory = await this.chatManagerService.getLastMessages(
      request.conversationId,
      20,
    );

    // Log trimmed conversation history for dev/debug
    filteredHistory.forEach((msg: any, index: number) => {
      const trimmedContent = msg.content;
      this.logger.log(
        `Message ${index + 1}: [${msg.fromRole}] ${trimmedContent}`,
      );
    });

    // Create the envelope with the current message
    const messageEnvelope: TConversationTextMessageEnvelope = {
      messageId: uuidv4(),
      requestOrResponse: 'request',
      envelopePayload: {
        messageId: uuidv4(),
        author_role: request.fromUserId,
        content: {
          type: 'text/plain',
          payload: request.content,
        },
        created_at: new Date().toISOString(),
        estimated_token_count: -1,
      },
    };

    return messageEnvelope;
  }
}
