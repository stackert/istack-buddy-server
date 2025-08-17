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
import { KnowledgeBaseService } from './knowledge-base.service';
import * as fs from 'fs';
import * as path from 'path';

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
    private readonly knowledgeBaseService: KnowledgeBaseService,
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

  /**
   * Extract all short codes from event text
   * @param text The event text to parse
   * @returns Array of short codes found in the text
   */
  private getShortCodes(text: string): string[] {
    const shortCodes: string[] = [];

    // Remove bot mentions and clean the text
    const cleanText = text.replace(/@istack-buddy|<@[^>]+>/g, '').trim();

    // Extract /marv-session command with formId parameter
    if (cleanText.match(/\/marv-session\s+formId:(\d+)/i)) {
      shortCodes.push('/marv-session');
    }

    // Extract /kb command
    if (cleanText.match(/\/kb(?::slack:(.+?))?\s+(.*)/i)) {
      shortCodes.push('/kb');
    }

    // Extract /feedback command
    if (cleanText.match(/\/feedback\s+(.+)/i)) {
      shortCodes.push('/feedback');
    }

    // Extract /rating command
    if (cleanText.match(/\/rating\s+([+-]?\d+)(?:\s+(.+))?/i)) {
      shortCodes.push('/rating');
    }

    return shortCodes;
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

      const shortCodes = this.getShortCodes(event.text || '');

      shortCodes.forEach((shortCode) => {
        this.logger.log(`Received short code: ${shortCode}`);
        switch (shortCode) {
          case '/marv-session':
            this.handleShortCodeMarvSession(event);
            break;
          case '/kb':
            this.handleShortCodeKb(event);
            break;
          case '/feedback':
            this.handleShortCodeFeedback(event);
            break;
          case '/rating':
            this.handleShortCodeRating(event);
            break;
          default:
            this.logger.log(`Unknown short code: ${shortCode}`);
            break;
        }
      });

      if (shortCodes.length > 0) {
        return;
      }

      // Get or create conversation for app mention events
      const conversationRecord = await this.getOrCreateConversation(event);

      // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
      await this.addSlackReaction('thinking_face', event.channel, event.ts);

      // Add message to conversation
      await this.chatManagerService.addMessage({
        conversationId: conversationRecord.internalConversationId,
        fromUserId: 'cx-slack-robot',
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

      // this creates the first message in the thread
      const { messageEnvelope, conversationHistory } =
        await this.createMessageEnvelopeWithHistory({
          conversationId: conversationRecord.internalConversationId,
          fromUserId: event.user,
          content: event.text,
        });

      await robot.acceptMessageMultiPartResponse(
        messageEnvelope,
        conversationRecord.sendConversationResponseToSlack,
        () => conversationHistory, // Pass getHistory callback
      );
      // ----------------------
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

      // Check if this is a /marv-session command with formId
      const marvMatch = event.text?.match(/\/marv-session\s+formId:(\d+)/i);
      if (marvMatch) {
        this.logger.log('Received /marv-session command in thread');

        // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
        await this.addSlackReaction('thinking_face', event.channel, event.ts);

        try {
          const formId = marvMatch[1];
          this.logger.log(`Extracted formId: ${formId} from command`);

          // Get the existing conversation ID from the Slack thread mapping
          const conversationId = event.thread_ts;
          const conversationRecord =
            this.slackThreadToConversationMap[conversationId];

          if (!conversationRecord) {
            // No existing conversation found - this shouldn't happen in a thread
            await this.sendSlackMessage(
              '❌ **No conversation found**\n\nPlease start a conversation with @istack-buddy first, then use `/marv-session formId:123456` in the thread.',
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

          // Set the formId in the conversation metadata
          this.chatManagerService.setConversationFormId(
            conversationRecord.internalConversationId,
            formId,
          );

          // Generate the session URL using the internal conversation ID and formId
          const baseUrl = this.getBaseUrl();
          const sessionUrl = `${baseUrl}/public/form-marv/${conversationRecord.internalConversationId}/${formId}?jwtToken=${jwtToken}`;

          // Send immediate response to Slack with the session link
          await this.sendSlackMessage(
            `✅ **Form Marv Session Created**\n\n📋 **Form ID:** ${formId}\n🔗 **Session Link:** ${sessionUrl}\n\nClick the link above to access the form session.`,
            event.channel,
            event.thread_ts,
          );
        } catch (error) {
          this.logger.error('Error creating marv session:', error);
          await this.sendSlackMessage(
            '❌ **Error creating marv session**\n\nPlease try again or contact support if the problem persists.',
            event.channel,
            event.thread_ts,
          );
        }

        return;
      }

      // Check for /kb commands in thread messages
      const kbMatch = event.text?.match(/\/kb(?::slack:(.+?))?\s+(.*)/i);
      if (kbMatch) {
        let specifiedChannel = kbMatch[1]; // e.g., "all" or "channel-name"
        const searchQuery = kbMatch[2]?.trim() || ''; // The search query after /kb

        // Handle Slack's <#CHANNELID|alias> format
        if (
          specifiedChannel?.includes('<#') &&
          specifiedChannel.includes('|')
        ) {
          const channelMatch = specifiedChannel.match(/<#([^|]+)\|([^>]*)>/);
          if (channelMatch) {
            const channelId = channelMatch[1];
            const alias = channelMatch[2];

            specifiedChannel = channelMatch[1]; // Just use the channel ID: C3LQ7KNFN
          }
        }

        this.logger.log(
          `Thread - Parsed channel: "${specifiedChannel}", query: "${searchQuery}"`,
        );

        // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
        await this.addSlackReaction('thinking_face', event.channel, event.ts);

        try {
          let channels: string[] | string;
          if (specifiedChannel === 'all') {
            channels = 'all';
          } else if (specifiedChannel) {
            channels = [specifiedChannel]; // Send channel ID directly
          } else {
            channels = 'all';
          }

          if (!searchQuery) {
            await this.sendSlackMessage(
              `📚 **Knowledge Base Help**\n• \`/kb query\` - Search all channels\n• \`/kb:slack:channel-alias query\` - Search specific channel\n• \`/kb:slack:all query\` - Search all channels`,
              event.channel,
              event.thread_ts,
            );
            return;
          }

          const searchResults =
            await this.knowledgeBaseService.getSearchResults({
              q: searchQuery,
              channels: channels,
            });
          this.logger.log(`KB search returned ${searchResults.length} results`);

          if (searchResults.length > 0) {
            const resultsText = searchResults
              .map((result, index) => {
                const date = result.original_post_date
                  ? new Date(result.original_post_date).toLocaleDateString()
                  : 'Unknown date';

                // Clean up the excerpt - remove timestamps and user IDs, keep only the actual content
                let cleanExcerpt = result.excerpt_text || '';
                // Remove timestamp patterns like [2025-01-31T03:11:42.424Z]
                cleanExcerpt = cleanExcerpt.replace(/\[[\d\-T:.Z]+\]\s*/g, '');
                // Remove user ID patterns like U07RCTLM69Z:
                cleanExcerpt = cleanExcerpt.replace(/[A-Z0-9]{11}:\s*/g, '');
                // Remove multiple --- separators and replace with simple breaks
                cleanExcerpt = cleanExcerpt.replace(/\s*---\s*/g, '\n• ');
                // Limit length to first ~200 characters for readability
                if (cleanExcerpt.length > 200) {
                  cleanExcerpt = cleanExcerpt.substring(0, 200) + '...';
                }

                return `${index + 1}. **<${result.message_link}|View Message>** (${date}) - *${Math.round(result.relevance_score * 100)}% relevance*
   ${cleanExcerpt}`;
              })
              .join('\n\n');

            const responseMessage = `📚 **Knowledge Base Results**

**Query:** "${searchQuery}"

${resultsText}

*Found ${searchResults.length} relevant results*`;

            await this.sendSlackMessage(
              responseMessage,
              event.channel,
              event.thread_ts,
            );
          } else {
            const responseMessage = `📚 **Knowledge Base**

**Query:** "${searchQuery}"

No relevant results found. Try:
• Using different keywords
• \`/kb:slack:all ${searchQuery}\` to search all channels
• Check spelling and try broader terms`;

            await this.sendSlackMessage(
              responseMessage,
              event.channel,
              event.thread_ts,
            );
          }
        } catch (error) {
          this.logger.error('Error retrieving knowledge base:', error);

          // Check if this is a knowledge buddy offline error
          if (error.message === 'KNOWLEDGE_BUDDY_OFFLINE') {
            await this.sendSlackMessage(
              '⚠️ **Knowledge Buddy Offline**\n\nThe knowledge-buddy is currently offline. Please try again later or contact support.',
              event.channel,
              event.thread_ts,
            );
          } else {
            await this.sendSlackMessage(
              'Error retrieving knowledge base. Please try again.',
              event.channel,
              event.thread_ts,
            );
          }
        }

        return;
      }

      // Check for /feedback commands in thread messages
      const feedbackMatch = event.text?.match(/\/feedback\s+(.+)/i);
      if (feedbackMatch) {
        this.logger.log('Received /feedback command in thread');

        // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
        await this.addSlackReaction('thinking_face', event.channel, event.ts);

        try {
          const feedbackContent = feedbackMatch[1].trim();
          const responseMessage = await this.handleFeedbackCommand(
            event,
            feedbackContent,
          );

          await this.sendSlackMessage(
            responseMessage,
            event.channel,
            event.thread_ts,
          );
        } catch (error) {
          this.logger.error('Error processing feedback:', error);
          await this.sendSlackMessage(
            'Error processing feedback. Please try again.',
            event.channel,
            event.thread_ts,
          );
        }

        return;
      }

      // Check for /rating commands in thread messages
      const ratingMatch = event.text?.match(
        /\/rating\s+([+-]?\d+)(?:\s+(.+))?/i,
      );
      if (ratingMatch) {
        this.logger.log('Received /rating command in thread');

        // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
        await this.addSlackReaction('thinking_face', event.channel, event.ts);

        try {
          const rating = parseInt(ratingMatch[1]);
          const comment = ratingMatch[2]?.trim();
          const responseMessage = await this.handleRatingCommand(
            event,
            rating,
            comment,
          );

          await this.sendSlackMessage(
            responseMessage,
            event.channel,
            event.thread_ts,
          );
        } catch (error) {
          this.logger.error('Error processing rating:', error);
          await this.sendSlackMessage(
            'Error processing rating. Please try again.',
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

      await this.chatManagerService.addMessage({
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

    return {
      messageEnvelope,
      conversationHistory: filteredHistory,
    };
  }

  /**
   * Get knowledge base content for a specific channel
   * This method retrieves channel-specific knowledge base information
   */
  private async getKnowledgeBaseContent(channelId: string): Promise<string> {
    // Map channel IDs to their knowledge base content
    const knowledgeBases: Record<string, string> = {
      'cx-formstack': `**Core Forms Knowledge Base**

**Common Issues & Solutions:**
• **Form Logic Problems** - Field visibility, conditional logic, calculations
• **Form Configuration** - Field setup, sections, validation rules
• **Form Integration** - Submit actions, webhooks, notifications
• **Form Rendering** - Display issues, styling problems

**Available Tools:**
• Form Logic Validation - Detect logic errors and configuration issues
• Form Calculation Validation - Check for circular references
• Form Overview - Get comprehensive form statistics and configuration
• Sumo Logic Queries - Analyze submission logs and trace data

**Quick Commands:**
• \`@istack-buddy /help\` - Get detailed help
• \`@istack-buddy /feedback [message]\` - Provide feedback
• \`@istack-buddy /rating [+5 to -5] [comment]\` - Rate the service`,

      'forms-sso-autofill': `**SSO & Auto-fill Knowledge Base**

**SSO Troubleshooting:**
• **SSO Configuration** - Setup and configuration issues
• **Auto-fill Mapping** - Field mapping problems
• **Authentication Issues** - Login and access problems
• **Integration Problems** - SSO provider connectivity

**Available Tools:**
• SSO Auto-fill Assistance - Diagnose SSO configuration issues
• Form Overview - Check SSO-related form settings
• Sumo Logic Queries - Analyze SSO authentication logs

**Quick Commands:**
• \`@istack-buddy /help\` - Get detailed help
• \`@istack-buddy /feedback [message]\` - Provide feedback
• \`@istack-buddy /rating [+5 to -5] [comment]\` - Rate the service`,

      'cx-f4sf': `**F4SF Knowledge Base**

**F4SF-Specific Issues:**
• **F4SF Configuration** - Setup and configuration problems
• **F4SF Integration** - Integration with other systems
• **F4SF Workflows** - Workflow and automation issues
• **F4SF Data** - Data handling and processing problems

**Available Tools:**
• Form Overview - Check F4SF-related form settings
• Sumo Logic Queries - Analyze F4SF logs and data

**Quick Commands:**
• \`@istack-buddy /help\` - Get detailed help
• \`@istack-buddy /feedback [message]\` - Provide feedback
• \`@istack-buddy /rating [+5 to -5] [comment]\` - Rate the service`,
    };

    // Remove # prefix if present for lookup
    const cleanChannelId = channelId.replace(/^#/, '');

    // Return channel-specific content or default
    return (
      knowledgeBases[cleanChannelId] ||
      `**Knowledge Base - ${channelId}**

**General Forms Support:**
• Form troubleshooting and configuration
• SSO and integration issues
• Data analysis and logging

**Quick Commands:**
• \`@istack-buddy /help\` - Get detailed help
• \`@istack-buddy /feedback [message]\` - Provide feedback
• \`@istack-buddy /rating [+5 to -5] [comment]\` - Rate the service`
    );
  }

  /**
   * Handle feedback command
   */
  private async handleFeedbackCommand(
    event: any,
    feedbackContent: string,
  ): Promise<string> {
    try {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Append feedback to file
      const feedbackFile = path.join(logsDir, 'feedback.json');
      const feedbackEntry = {
        channel: event.channel,
        author: event.user,
        date: new Date().toISOString(),
        feedback: feedbackContent,
      };

      // Read existing entries or start with empty array
      let entries = [];
      if (fs.existsSync(feedbackFile)) {
        const content = fs.readFileSync(feedbackFile, 'utf8');
        entries = JSON.parse(content);
      }

      // Add new entry and write back
      entries.push(feedbackEntry);
      fs.writeFileSync(feedbackFile, JSON.stringify(entries, null, 2));

      this.logger.log(`Feedback logged for ${event.user} in ${event.channel}`);
      return `Thank you for your feedback! We appreciate your input to help improve our service.`;
    } catch (error) {
      this.logger.error('Error processing feedback:', error);
      return `Thank you for your feedback! We appreciate your input to help improve our service.`;
    }
  }

  /**
   * Handle rating command
   */
  private async handleRatingCommand(
    event: any,
    rating: number,
    comment?: string,
  ): Promise<string> {
    try {
      // Validate rating range
      if (rating < -5 || rating > 5) {
        return `**Invalid Rating**

Ratings must be between -5 and +5. Please provide a rating in this range.

**Examples:**
• \`@istack-buddy /rating +4 Very helpful!\`
• \`@istack-buddy /rating -2 Information was wrong\`
• \`@istack-buddy /rating 0\`

**Rating Scale:**
• -5: World War III bad  
• -2: Misleading or just wrong  
• -1: Information had inaccuracies
• 0: Not good/not bad
• +1: A little helpful
• +2: Helpful, will use again
• +5: Nominate iStackBuddy for world peace prize`;
      }

      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Append rating to file
      const ratingFile = path.join(logsDir, 'rating.json');
      const ratingEntry = {
        channel: event.channel,
        author: event.user,
        date: new Date().toISOString(),
        rating: rating,
        comment: comment,
      };

      // Read existing entries or start with empty array
      let entries = [];
      if (fs.existsSync(ratingFile)) {
        const content = fs.readFileSync(ratingFile, 'utf8');
        entries = JSON.parse(content);
      }

      // Add new entry and write back
      entries.push(ratingEntry);
      fs.writeFileSync(ratingFile, JSON.stringify(entries, null, 2));

      this.logger.log(
        `Rating logged for ${event.user} in ${event.channel}: ${rating}/5`,
      );
      return `Thank you for your rating of ${rating >= 0 ? '+' : ''}${rating}/5! We appreciate your feedback to help us improve our service.`;
    } catch (error) {
      this.logger.error('Error processing rating:', error);
      return `Thank you for your rating! We appreciate your feedback to help us improve our service.`;
    }
  }

  /**
   * Get or create conversation for Slack event
   */
  private async getOrCreateConversation(
    event: any,
  ): Promise<TSlackInterfaceRecord> {
    const simpleEvent = this.makeSimplifiedEvent(event);

    if (simpleEvent.eventType === 'conversation_start') {
      // Create new conversation
      const conversation = await this.chatManagerService.startConversation({
        createdBy: event.user,
        createdByRole: UserRole.CUSTOMER,
        title: 'Slack Channel Conversation',
        description: `Slack conversation from channel mention`,
        initialParticipants: [event.user],
      });

      // Create callback function for this specific conversation
      const sendConversationResponseToSlack = async (
        delayedResponse: TConversationTextMessageEnvelope,
      ) => {
        const messageContent = delayedResponse.envelopePayload.content.payload;

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
      const conversationRecord: TSlackInterfaceRecord = {
        internalConversationId: conversation.id,
        slackConversationId: event.ts,
        sendConversationResponseToSlack,
      };

      this.slackThreadToConversationMap[event.ts] = conversationRecord;
      return conversationRecord;
    } else {
      // Get existing conversation
      const conversationRecord =
        this.slackThreadToConversationMap[event.thread_ts];
      if (!conversationRecord) {
        throw new Error(
          `No conversation found for thread_ts: ${event.thread_ts}`,
        );
      }
      return conversationRecord;
    }
  }

  private async handleShortCodeMarvSession(event: any): Promise<void> {
    this.logger.log('Received /marv-session command via app mention');

    // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
    await this.addSlackReaction('thinking_face', event.channel, event.ts);

    try {
      // Extract formId from the command
      const trimmedText = event.text?.trim();
      const marvMatch = trimmedText?.match(/\/marv-session\s+formId:(\d+)/i);

      if (!marvMatch) {
        await this.sendSlackMessage(
          '❌ **Invalid command format**\n\nPlease use: `/marv-session formId:123456`\n\nExample: `/marv-session formId:6201623`',
          event.channel,
          event.thread_ts || event.ts,
        );
        return;
      }

      const formId = marvMatch[1];
      this.logger.log(`Extracted formId: ${formId} from command`);

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
          '❌ **No conversation found**\n\nPlease start a conversation with @istack-buddy first, then use `/marv-session formId:123456` in the thread.',
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

      // Set the formId in the conversation metadata
      this.chatManagerService.setConversationFormId(
        conversationRecord.internalConversationId,
        formId,
      );

      // Generate the session URL using the internal conversation ID and formId
      const baseUrl = this.getBaseUrl();
      const sessionUrl = `${baseUrl}/public/form-marv/${conversationRecord.internalConversationId}/${formId}?jwtToken=${jwtToken}`;

      // Send immediate response to Slack with the session link
      await this.sendSlackMessage(
        `✅ **Form Marv Session Created**\n\n📋 **Form ID:** ${formId}\n🔗 **Session Link:** ${sessionUrl}\n\nClick the link above to access the form session.`,
        event.channel,
        event.thread_ts || event.ts, // Use thread_ts if available, otherwise ts
      );
    } catch (error) {
      this.logger.error('Error creating marv session:', error);
      await this.sendSlackMessage(
        '❌ **Error creating marv session**\n\nPlease try again or contact support if the problem persists.',
        event.channel,
        event.thread_ts || event.ts,
      );
    }
  }

  private async handleShortCodeKb(event: any): Promise<void> {
    const trimmedText = event.text?.trim();
    const kbMatch = trimmedText?.match(/\/kb(?::slack:(.+?))?\s+(.*)/i);
    if (kbMatch) {
      let specifiedChannel = kbMatch[1];
      const searchQuery = kbMatch[2]?.trim() || '';

      // Handle Slack's <#CHANNELID|alias> format
      if (specifiedChannel?.includes('<#') && specifiedChannel.includes('|')) {
        const channelMatch = specifiedChannel.match(/<#([^|]+)\|([^>]*)>/);
        if (channelMatch) {
          const channelId = channelMatch[1];
          const alias = channelMatch[2];

          specifiedChannel = channelMatch[1]; // Just use the channel ID: C3LQ7KNFN
        }
      }

      this.logger.log(
        `Parsed channel: "${specifiedChannel}", query: "${searchQuery}"`,
      );

      await this.addSlackReaction('thinking_face', event.channel, event.ts);

      if (!searchQuery) {
        await this.sendSlackMessage(
          `📚 **Knowledge Base Help**\n• \`/kb query\` - Search all channels\n• \`/kb:slack:channel-alias query\` - Search specific channel\n• \`/kb:slack:all query\` - Search all channels`,
          event.channel,
          event.ts,
        );
        return;
      }

      try {
        let channels: string[] | string;
        if (specifiedChannel === 'all') {
          channels = 'all';
        } else if (specifiedChannel) {
          channels = [specifiedChannel]; // Send channel ID directly
        } else {
          channels = 'all';
        }

        const searchResults = await this.knowledgeBaseService.getSearchResults({
          q: searchQuery,
          channels: channels,
        });

        if (searchResults.length > 0) {
          const resultsText = searchResults
            .map((result, index) => {
              const date = result.original_post_date
                ? new Date(result.original_post_date).toLocaleDateString()
                : 'Unknown date';

              // Clean up the excerpt - remove timestamps and user IDs, keep only the actual content
              let cleanExcerpt = result.excerpt_text || '';
              // Remove timestamp patterns like [2025-01-31T03:11:42.424Z]
              cleanExcerpt = cleanExcerpt.replace(/\[[\d\-T:.Z]+\]\s*/g, '');
              // Remove user ID patterns like U07RCTLM69Z:
              cleanExcerpt = cleanExcerpt.replace(/[A-Z0-9]{11}:\s*/g, '');
              // Remove multiple --- separators and replace with simple breaks
              cleanExcerpt = cleanExcerpt.replace(/\s*---\s*/g, '\n• ');
              // Limit length to first ~200 characters for readability
              if (cleanExcerpt.length > 200) {
                cleanExcerpt = cleanExcerpt.substring(0, 200) + '...';
              }

              return `${index + 1}. **<${result.message_link}|View Message>** (${date}) - *${Math.round(result.relevance_score * 100)}% relevance*
   ${cleanExcerpt}`;
            })
            .join('\n\n');

          const responseMessage = `📚 **Knowledge Base Results**

**Query:** "${searchQuery}"

${resultsText}

*Found ${searchResults.length} relevant results*`;

          await this.sendSlackMessage(responseMessage, event.channel, event.ts);
        } else {
          const responseMessage = `📚 **Knowledge Base**

**Query:** "${searchQuery}"

No relevant results found. Try:
• Using different keywords
• \`@iStackBuddy /kb:slack:all ${searchQuery}\` to search all channels
• Check spelling and try broader terms`;

          await this.sendSlackMessage(responseMessage, event.channel, event.ts);
        }
      } catch (error) {
        this.logger.error('Error retrieving knowledge base:', error);
        await this.sendSlackMessage(
          'Knowledge-buddy is offline',
          event.channel,
          event.ts,
        );
      }
    }
  }

  private async handleShortCodeFeedback(event: any): Promise<void> {
    this.logger.log('Received /feedback command via app mention');

    // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
    await this.addSlackReaction('thinking_face', event.channel, event.ts);

    try {
      const trimmedText = event.text?.trim();
      const feedbackMatch = trimmedText?.match(
        /(?:@istack-buddy|<@[^>]+>)\s+\/feedback\s+(.+)/i,
      );
      const feedbackContent = feedbackMatch[1].trim();
      const responseMessage = await this.handleFeedbackCommand(
        event,
        feedbackContent,
      );

      await this.sendSlackMessage(
        responseMessage,
        event.channel,
        event.thread_ts || event.ts,
      );
    } catch (error) {
      this.logger.error('Error processing feedback:', error);
      await this.sendSlackMessage(
        'Error processing feedback. Please try again.',
        event.channel,
        event.thread_ts || event.ts,
      );
    }
  }

  private async handleShortCodeRating(event: any): Promise<void> {
    this.logger.log('Received /rating command via app mention');

    // IMMEDIATE ACKNOWLEDGMENT - Add thinking emoji reaction
    await this.addSlackReaction('thinking_face', event.channel, event.ts);

    try {
      const trimmedText = event.text?.trim();
      const ratingMatch = trimmedText?.match(
        /(?:@istack-buddy|<@[^>]+>)\s+\/rating\s+([+-]?\d+)(?:\s+(.+))?/i,
      );
      const rating = parseInt(ratingMatch[1]);
      const comment = ratingMatch[2]?.trim();
      const responseMessage = await this.handleRatingCommand(
        event,
        rating,
        comment,
      );

      await this.sendSlackMessage(
        responseMessage,
        event.channel,
        event.thread_ts || event.ts,
      );
    } catch (error) {
      this.logger.error('Error processing rating:', error);
      await this.sendSlackMessage(
        'Error processing rating. Please try again.',
        event.channel,
        event.thread_ts || event.ts,
      );
    }
  }
}
