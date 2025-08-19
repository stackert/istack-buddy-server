import * as fs from 'fs';
import * as path from 'path';

/**
 * Extract all short codes from event text
 * @param text The event text to parse
 * @returns Array of short codes found in the text
 */
function getShortCodesFromEventText(text: string): string[] {
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

/**
 * Create a simplified event object from Slack event
 * @param event The Slack event
 * @returns Simplified event object
 */
function makeSimplifiedEvent(event: any): {
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
 * Handle feedback command - pure function for processing feedback
 * @param event The Slack event
 * @param feedbackContent The feedback content
 * @returns Response message
 */
function handleFeedbackCommand(event: any, feedbackContent: string): string {
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

    return `Thank you for your feedback! We appreciate your input to help improve our service.`;
  } catch (error) {
    return `Thank you for your feedback! We appreciate your input to help improve our service.`;
  }
}

/**
 * Handle rating command - pure function for processing ratings
 * @param event The Slack event
 * @param rating The rating value
 * @param comment Optional comment
 * @returns Response message
 */
function handleRatingCommand(
  event: any,
  rating: number,
  comment?: string,
): string {
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

    return `Thank you for your rating of ${rating >= 0 ? '+' : ''}${rating}/5! We appreciate your feedback to help us improve our service.`;
  } catch (error) {
    return `Thank you for your rating! We appreciate your feedback to help us improve our service.`;
  }
}

export {
  getShortCodesFromEventText,
  makeSimplifiedEvent,
  handleFeedbackCommand,
  handleRatingCommand,
};
