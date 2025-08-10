import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SlackyOpenAiAgent } from '../robots/SlackyOpenAiAgent';
import { RobotService } from '../robots/robot.service';
import { v4 as uuidv4 } from 'uuid';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';
import { TConversationTextMessageEnvelope } from '../robots/types';
import * as jwt from 'jsonwebtoken';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { UserProfileService } from '../user-profile/user-profile.service';

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
    private readonly authorizationPermissionsService: AuthorizationPermissionsService,
    private readonly userProfileService: UserProfileService,
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
    const body = req.body;

    try {
      // Handle URL verification challenge (Slack App setup)
      if (body.challenge) {
        this.logger.log('Handling Slack URL verification challenge');
        res.status(200).json({ challenge: body.challenge });
        return;
      }

      // Handle app mention events
      if (body.event && body.event.type === 'app_mention') {
        this.logger.log('Received app mention event');

        // Create simplified event for app mention events only
        const simpleEvent = this.makeSimplifiedEvent(body.event);

        if (this.uniqueEventList[simpleEvent.eventTs]) {
          this.logger.log(`Duplicate event detected: ${body.event_id}`);
          res.status(200).json({ status: 'ok' });
          return;
        }
        this.uniqueEventList[simpleEvent.eventTs] = body;

        await this.handleAppMention(body.event);
        res.status(200).json({ status: 'ok' });
        return;
      }

      // Handle message events (for command interception)
      if (body.event && body.event.type === 'message') {
        this.logger.log('Received message event');

        // Create simplified event for message events
        const simpleEvent = this.makeSimplifiedEvent(body.event);

        if (this.uniqueEventList[simpleEvent.eventTs]) {
          this.logger.log(`Duplicate event detected: ${body.event_id}`);
          res.status(200).json({ status: 'ok' });
          return;
        }
        this.uniqueEventList[simpleEvent.eventTs] = body;

        await this.handleMessageEvent(body.event);
        res.status(200).json({ status: 'ok' });
        return;
      }

      // Handle other event types (ignore for now)
      this.logger.log(
        `Received unhandled event type: ${body.event?.type || 'unknown'}`,
      );
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
      // Check if this is a /marv-session command (for both conversation_start and thread_reply)
      this.logger.log(
        `DEBUG: Event text: "${event.text}", trimmed: "${event.text?.trim()}"`,
      );

      // Check for /marv-session command (with or without bot mention)
      const trimmedText = event.text?.trim();
      if (
        trimmedText === '/marv-session' ||
        trimmedText?.endsWith(' /marv-session')
      ) {
        this.logger.log('Received /marv-session command via app mention');

        try {
          // Get the existing conversation ID from the Slack thread mapping
          const conversationId = event.thread_ts || event.ts;
          const conversationRecord =
            this.slackThreadToConversationMap[conversationId];

          this.logger.log(`DEBUG: Slack conversationId: ${conversationId}`);
          this.logger.log(
            `DEBUG: Conversation record: ${JSON.stringify(conversationRecord)}`,
          );
          this.logger.log(
            `DEBUG: Internal conversation ID: ${conversationRecord?.internalConversationId}`,
          );

          if (!conversationRecord) {
            // No existing conversation found - this shouldn't happen in a thread
            await this.sendSlackMessage(
              'session link: http://localhost:3500/public/form-marv/_CONVERSATION_ID_UNKNOWN_/_FORM_ID_UNKNOWN_?jwtToken=_JWT_TOKEN_UNKNOWN_',
              event.channel,
              event.thread_ts || event.ts,
            );
            return;
          }

          // Create a new form-marv session
          const tempUserId = conversationRecord.internalConversationId; // Use conversation ID as user ID

          // Create a JWT token for the temporary user
          const jwtToken = jwt.sign(
            {
              userId: tempUserId,
              email: `form-marv-${Date.now()}@example.com`,
              username: tempUserId,
              accountType: 'TEMPORARY',
            },
            'istack-buddy-secret-key-2024',
            { expiresIn: '8h' },
          );

          // Add user to permissions system
          this.authorizationPermissionsService.addUser(
            tempUserId,
            ['cx-agent:form-marv:read', 'cx-agent:form-marv:write'],
            [],
          );

          // Create temporary user profile
          this.userProfileService.addTemporaryUser(tempUserId, {
            email: `form-marv-${Date.now()}@example.com`,
            username: tempUserId,
            account_type_informal: 'TEMPORARY',
            first_name: 'Form',
            last_name: 'Marv',
          });

          // Extract form ID from conversation history
          const formId = await this.extractFormIdFromConversation(
            conversationRecord.internalConversationId,
          );

          // Generate the session URL using the internal conversation ID and extracted form ID
          const baseUrl = this.getBaseUrl();
          const sessionUrl = `${baseUrl}/public/form-marv/${conversationRecord.internalConversationId}/${formId}?jwtToken=${jwtToken}`;

          // Send immediate response to Slack with the session link
          await this.sendSlackMessage(
            `session link: ${sessionUrl}`,
            event.channel,
            event.thread_ts || event.ts, // Use thread_ts if available, otherwise ts
          );
        } catch (error) {
          this.logger.error('Error creating marv session:', error);
          await this.sendSlackMessage(
            'Error creating marv session. Please try again.',
            event.channel,
            event.thread_ts || event.ts,
          );
        }

        return;
      }

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
          const messageContent =
            delayedResponse.envelopePayload.content.payload;

          // Only send to Slack if we have actual content
          if (messageContent && messageContent.trim()) {
            // Add robot response to conversation history
            await this.chatManagerService.addMessage({
              conversationId: conversation.id,
              fromUserId: 'cx-slack-robot',
              content: messageContent,
              messageType: MessageType.ROBOT,
              fromRole: UserRole.ROBOT,
              toRole: UserRole.CUSTOMER,
            });

            // Send message to Slack
            await this.sendSlackMessage(
              messageContent,
              event.channel,
              event.ts, // this is what creates the thread
            );
          } else {
            this.logger.warn('Skipping empty message response to Slack');
          }
        };

        // Map the Slack thread to conversation record with callback for future lookups
        this.slackThreadToConversationMap[event.ts] = {
          internalConversationId: conversation.id,
          slackConversationId: event.ts,
          sendConversationResponseToSlack,
        };

        // --------------------
        const robot =
          this.robotService.getRobotByName<SlackyOpenAiAgent>(
            'SlackyOpenAiAgent',
          )!;

        // this creates the first message in the thread
        const { messageEnvelope, conversationHistory } =
          await this.createMessageEnvelopeWithHistory({
            conversationId: conversation.id,
            fromUserId: event.user,
            content: event.text,
          });

        const response = await robot.acceptMessageMultiPartResponse(
          messageEnvelope,
          sendConversationResponseToSlack,
          () => conversationHistory, // Pass getHistory callback
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

        // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction for thread replies
        await this.addSlackReaction('thinking_face', event.channel, event.ts);

        const userMessage = await this.chatManagerService.addMessage({
          conversationId: conversationRecord.internalConversationId,
          fromUserId: 'cx-slack-robot', // Generic Slack robot user - actual Slack user not tracked
          content: event.text,
          messageType: MessageType.TEXT,
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.AGENT,
        });

        // --------------------
        const robot =
          this.robotService.getRobotByName<SlackyOpenAiAgent>(
            'SlackyOpenAiAgent',
          )!;

        const { messageEnvelope, conversationHistory } =
          await this.createMessageEnvelopeWithHistory({
            conversationId: conversationRecord.internalConversationId,
            fromUserId: event.user,
            content: event.text,
          });

        const response = await robot.acceptMessageMultiPartResponse(
          messageEnvelope,
          conversationRecord.sendConversationResponseToSlack,
          () => conversationHistory, // Pass getHistory callback
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
   * Handle Slack message events (for command interception)
   * Currently handles /marv-session command in thread messages only
   */
  private async handleMessageEvent(event: any): Promise<void> {
    const simpleEvent = this.makeSimplifiedEvent(event);

    try {
      // Only handle thread messages (not channel messages)
      if (simpleEvent.eventType !== 'thread_reply') {
        this.logger.log('Ignoring non-thread message event');
        return;
      }

      // Check if this is a /marv-session command
      if (event.text && event.text.trim() === '/marv-session') {
        this.logger.log('Received /marv-session command in thread');

        try {
          // Get the existing conversation ID from the Slack thread mapping
          const conversationId = event.thread_ts;
          const conversationRecord =
            this.slackThreadToConversationMap[conversationId];

          if (!conversationRecord) {
            // No existing conversation found - this shouldn't happen in a thread
            await this.sendSlackMessage(
              'session link: http://localhost:3500/public/form-marv/_CONVERSATION_ID_UNKNOWN_/_FORM_ID_UNKNOWN_?jwtToken=_JWT_TOKEN_UNKNOWN_',
              event.channel,
              event.thread_ts,
            );
            return;
          }

          // Create a new form-marv session
          const tempUserId = conversationRecord.internalConversationId; // Use conversation ID as user ID

          // Create a JWT token for the temporary user
          const jwtToken = jwt.sign(
            {
              userId: tempUserId,
              email: `form-marv-${Date.now()}@example.com`,
              username: tempUserId,
              accountType: 'TEMPORARY',
            },
            'istack-buddy-secret-key-2024',
            { expiresIn: '8h' },
          );

          // Add user to permissions system
          this.authorizationPermissionsService.addUser(
            tempUserId,
            ['cx-agent:form-marv:read', 'cx-agent:form-marv:write'],
            [],
          );

          // Create temporary user profile
          this.userProfileService.addTemporaryUser(tempUserId, {
            email: `form-marv-${Date.now()}@example.com`,
            username: tempUserId,
            account_type_informal: 'TEMPORARY',
            first_name: 'Form',
            last_name: 'Marv',
          });

          // Generate the session URL using the internal conversation ID
          const sessionUrl = `http://localhost:3500/public/form-marv/${conversationRecord.internalConversationId}/5375703?jwtToken=${jwtToken}`;

          // Send immediate response to Slack with the session link
          await this.sendSlackMessage(
            `session link: ${sessionUrl}`,
            event.channel,
            event.thread_ts,
          );
        } catch (error) {
          this.logger.error('Error creating marv session:', error);
          await this.sendSlackMessage(
            'Error creating marv session. Please try again.',
            event.channel,
            event.thread_ts,
          );
        }

        return;
      }

      // For other messages in threads, continue with normal conversation flow
      const conversationRecord =
        this.slackThreadToConversationMap[event.thread_ts];

      if (!conversationRecord) {
        // Unknown scenario - log and ignore
        this.logger.log(
          `Ignoring event - thread_ts: ${event.thread_ts}, no mapping found or unrecognized pattern`,
        );
        return;
      }

      // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction for thread replies
      await this.addSlackReaction('thinking_face', event.channel, event.ts);

      const userMessage = await this.chatManagerService.addMessage({
        conversationId: conversationRecord.internalConversationId,
        fromUserId: 'cx-slack-robot', // Generic Slack robot user - actual Slack user not tracked
        content: event.text,
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      // --------------------
      const robot =
        this.robotService.getRobotByName<SlackyOpenAiAgent>(
          'SlackyOpenAiAgent',
        )!;

      const { messageEnvelope, conversationHistory } =
        await this.createMessageEnvelopeWithHistory({
          conversationId: conversationRecord.internalConversationId,
          fromUserId: event.user,
          content: event.text,
        });

      const response = await robot.acceptMessageMultiPartResponse(
        messageEnvelope,
        conversationRecord.sendConversationResponseToSlack,
        () => conversationHistory, // Pass getHistory callback
      );
      // ----------------------
    } catch (error) {
      this.logger.error('Error handling message event:', error);

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
    // Skip sending if message is empty or undefined
    if (!message || !message.trim()) {
      this.logger.warn('Attempted to send empty message to Slack, skipping');
      return;
    }

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
   * Get the base URL for generating links with proper fallbacks
   */
  private getBaseUrl(): string {
    // Priority 1: NGROK_URL environment variable
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL.replace(/\/$/, ''); // Remove trailing slash if present
    }

    // Priority 2: ISTACK_BUDDY_FRONT_END_HOST environment variable
    if (process.env.ISTACK_BUDDY_FRONT_END_HOST) {
      return process.env.ISTACK_BUDDY_FRONT_END_HOST.replace(/\/$/, ''); // Remove trailing slash if present
    }

    // Priority 3: Fallback to relative path
    return '';
  }

  /**
   * Extract form ID from conversation history by looking for form ID patterns
   */
  private async extractFormIdFromConversation(
    conversationId: string,
  ): Promise<string> {
    try {
      // Get recent messages from the conversation
      const messages = await this.chatManagerService.getMessages(
        conversationId,
        {
          limit: 20, // Look at last 20 messages
          offset: 0,
        },
      );

      // Look for form ID patterns in the conversation
      for (const message of messages) {
        const content = message.content?.payload || message.content || '';
        const contentStr =
          typeof content === 'string' ? content : String(content);

        // Look for patterns like "form 6201623", "form ID 6201623", etc.
        const formIdMatch = contentStr.match(/form\s+(?:id\s+)?(\d{6,7})/i);
        if (formIdMatch) {
          this.logger.log(
            `Extracted form ID ${formIdMatch[1]} from conversation message`,
          );
          return formIdMatch[1];
        }

        // Also look for just 6-7 digit numbers that might be form IDs
        const numberMatch = contentStr.match(/(\d{6,7})/);
        if (numberMatch) {
          // Additional validation: check if it's likely a form ID (not a timestamp, etc.)
          const num = parseInt(numberMatch[1]);
          if (num > 100000 && num < 9999999) {
            this.logger.log(
              `Extracted potential form ID ${numberMatch[1]} from conversation message`,
            );
            return numberMatch[1];
          }
        }
      }

      // If no form ID found, return a default
      this.logger.warn(
        `No form ID found in conversation ${conversationId}, using default`,
      );
      return '5375703'; // Default fallback
    } catch (error) {
      this.logger.error(
        `Error extracting form ID from conversation ${conversationId}:`,
        error,
      );
      return '5375703'; // Default fallback
    }
  }

  /**
   * Create message envelope with full conversation history
   * This replaces the simple createMessageEnvelope method
   */
  private async createMessageEnvelopeWithHistory(request: {
    conversationId: string;
    fromUserId: string;
    content: string;
  }): Promise<{
    messageEnvelope: TConversationTextMessageEnvelope;
    conversationHistory: any[];
  }> {
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

    return { messageEnvelope, conversationHistory: filteredHistory };
  }
}
