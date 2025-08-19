import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { UserProfileService } from '../user-profile/user-profile.service';
import { KnowledgeBaseService } from './knowledge-base.service';

// Interface for storing Slack conversation mapping and callback
interface TSlackInterfaceRecord {
  internalConversationId: string;
  slackConversationId: string; // Slack thread timestamp
  sendConversationResponseToSlack: (content: {
    type: 'text';
    payload: string;
  }) => Promise<void>;
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
  private getShortCodesFromEvent(text: string): string[] {
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

      const shortCodes = this.getShortCodesFromEvent(event.text || '');

      shortCodes.forEach((shortCode: string) => {
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

      // Add message to conversation and trigger robot response
      await this.chatManagerService.addMessageFromSlack(
        conversationRecord.internalConversationId,
        { type: 'text', payload: event.text },
        conversationRecord.sendConversationResponseToSlack,
      );
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

      // Check for short codes in thread messages
      const shortCodes = this.getShortCodesFromEvent(event.text || '');

      shortCodes.forEach((shortCode: string) => {
        this.logger.log(`Received short code in thread: ${shortCode}`);
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

      await this.chatManagerService.addMessageFromSlack(
        conversationRecord.internalConversationId,
        { type: 'text', payload: event.text },
        conversationRecord.sendConversationResponseToSlack,
      );
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
      const sendConversationResponseToSlack = async (content: {
        type: 'text';
        payload: string;
      }) => {
        // Only send to Slack if we have actual content
        if (content.payload && content.payload.trim()) {
          // Send message to Slack
          await this.sendSlackMessage(
            content.payload,
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

      // Create temporary user and session using the AuthorizationPermissionsService
      const sessionResult =
        this.authorizationPermissionsService.createTempUserAndSession(
          conversationRecord.internalConversationId,
          formId,
        );

      // Set the formId in the conversation metadata
      this.chatManagerService.setConversationFormId(
        conversationRecord.internalConversationId,
        formId,
      );

      // Generate the session URL using the sessionId as sessionToken and formId
      const baseUrl = this.getBaseUrl();
      const sessionUrl = `${baseUrl}/public/form-marv/${sessionResult.sessionId}/${formId}?jwtToken=${sessionResult.jwtToken}`;

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
