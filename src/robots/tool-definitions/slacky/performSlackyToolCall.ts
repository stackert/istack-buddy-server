import type {
  ISumoLogicQueryArgs,
  ISsoAutofillAssistanceArgs,
  ICollectUserFeedbackArgs,
  ICollectUserRatingArgs,
} from './types';
import { SlackyToolsEnum } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { CustomLoggerService } from '../../../common/logger/custom-logger.service';

/**
 * Handle collect user feedback tool
 */
const handleCollectUserFeedback = (
  toolArgs: ICollectUserFeedbackArgs,
): string => {
  const { feedback, category } = toolArgs;

  // Log the feedback
  logFeedback({
    timestamp: new Date().toISOString(),
    type: 'feedback',
    feedback,
    category,
    user_id: 'slack_user', // Will be enhanced with actual user context
    channel_id: 'slack_channel', // Will be enhanced with actual channel context
    conversation_context: 'slacky_interaction',
  });

  const categoryLabels = {
    conversation: 'Conversation Quality',
    service: 'Service Experience',
    feature_request: 'Feature Request',
    bug_report: 'Bug Report',
    other: 'General Feedback',
  };

  return `**Feedback Collected Successfully**

**Category:** ${categoryLabels[category]}
**Your Feedback:** "${feedback}"

Thank you for taking the time to share your thoughts! Your feedback helps me improve and provide better assistance.

${
  category === 'bug_report'
    ? "I've logged this as a bug report and will make sure the development team sees it."
    : category === 'feature_request'
      ? "Great suggestion! I've logged this feature request for the team to consider."
      : 'Your feedback has been logged and will help improve the iStackBuddy experience.'
}

Is there anything else you'd like to share or any other way I can assist you?`;
};

/**
 * Handle collect user rating tool
 */
const handleCollectUserRating = (toolArgs: ICollectUserRatingArgs): string => {
  const { rating, context, comment } = toolArgs;

  // Validate rating range
  if (rating < -5 || rating > 5) {
    return `**Invalid Rating**

Ratings must be between -5 and +5. Please provide a rating in this range.

**Rating Scale:**
• -5: World War III bad
• -2: Misleading or just wrong  
• -1: Information had inaccuracies
• 0: Not good/not bad
• +1: A little helpful
• +2: Helpful, will use again
• +5: Nominate iStackBuddy for world peace prize`;
  }

  // Log the rating
  logFeedback({
    timestamp: new Date().toISOString(),
    type: 'rating',
    rating,
    context,
    comment,
    user_id: 'slack_user', // Will be enhanced with actual user context
    channel_id: 'slack_channel', // Will be enhanced with actual channel context
    conversation_context: 'slacky_interaction',
  });

  // Get rating description
  const getRatingDescription = (rating: number): string => {
    if (rating <= -5) return 'World War III bad';
    if (rating === -4) return 'Very poor';
    if (rating === -3) return 'Poor';
    if (rating === -2) return 'Misleading or just wrong';
    if (rating === -1) return 'Information had inaccuracies';
    if (rating === 0) return 'Not good/not bad';
    if (rating === 1) return 'A little helpful';
    if (rating === 2) return 'Helpful, will use again';
    if (rating === 3) return 'Very helpful';
    if (rating === 4) return 'Excellent';
    if (rating >= 5) return 'Nominate iStackBuddy for world peace prize';
    return 'Neutral';
  };

  const ratingDesc = getRatingDescription(rating);
  const ratingPrefix =
    rating >= 3
      ? 'Excellent'
      : rating >= 1
        ? 'Good'
        : rating === 0
          ? 'Neutral'
          : rating >= -2
            ? 'Poor'
            : 'Very Poor';

  return `**Rating Received: ${rating >= 0 ? '+' : ''}${rating}/5**

**Context:** ${context}
**Rating:** ${ratingDesc}
${comment ? `**Comment:** "${comment}"` : ''}

${
  rating >= 3
    ? "Thank you so much! I'm thrilled that I could provide excellent assistance. Your positive feedback motivates me to keep improving!"
    : rating >= 1
      ? "Thank you for the positive feedback! I appreciate knowing that I was helpful, and I'll continue working to provide even better assistance."
      : rating === 0
        ? "Thank you for the honest feedback. I'll use this to understand where I can improve to be more helpful in future interactions."
        : "Thank you for the honest feedback. I apologize that this interaction didn't meet your expectations. I'll work on improving to provide better assistance next time."
}

Your rating helps me learn and improve! Is there anything specific I can do better or any other way I can assist you?`;
};

/**
 * Log feedback/rating data to file
 */
const logFeedback = (data: any): void => {
  const logger = new CustomLoggerService();
  try {
    // Ensure feedback directory exists
    const feedbackDir = path.join(
      process.cwd(),
      'docs-living',
      'debug-logging',
      'feedback',
    );
    if (!fs.existsSync(feedbackDir)) {
      fs.mkdirSync(feedbackDir, { recursive: true });
    }

    // Create log filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `feedback-${timestamp}.log`;
    const filepath = path.join(feedbackDir, filename);

    // Write log entry
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error('Failed to log feedback', error);
  }
};

/**
 * Handle SSO auto-fill assistance tool
 */
const handleSsoAutofillAssistance = (
  toolArgs: ISsoAutofillAssistanceArgs,
): string => {
  const { formId, accountId } = toolArgs;

  return `SSO Auto-fill Configuration Analysis

Form ID: ${formId}
Account ID: ${accountId}

SSO Auto-fill Troubleshooting:

**Common Issues to Check:**
• SSO provider configuration and field mappings
• Form field IDs matching SSO attribute names
• Account-level SSO settings and permissions
• Form-specific SSO protection settings

**Configuration Verification:**
• Verify SSO provider is properly configured for account ${accountId}
• Check that form ${formId} has SSO protection enabled
• Confirm field mapping between SSO attributes and form fields
• Validate user permissions and group memberships

**Debugging Steps:**
• Test SSO login flow independently
• Check browser console for JavaScript errors
• Verify SAML/OIDC response contains expected attributes
• Review form field names and auto-fill mappings

**What I can help with:**
• Analyze specific error messages
• Guide through configuration verification
• Help troubleshoot field mapping issues
• Provide best practices for SSO auto-fill setup`;
};

/**
 * Handle Sumo Logic query tool
 */
const handleSumoLogicQuery = (toolArgs: ISumoLogicQueryArgs): string => {
  const { fromDate, toDate, formId, submissionId } = toolArgs;

  // Build ID section conditionally
  const idSection = [
    formId ? `Form ID: ${formId}` : '',
    submissionId ? `Submission ID: ${submissionId}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Build analysis section based on what parameters we have
  const analysisSection = submissionId
    ? `• Submission lifecycle tracking for submission ${submissionId}
• Integration run logs and status
• Email send logs related to this submission
• Error logs and failure points`
    : formId
      ? `• All submissions for form ${formId} in the specified date range
• Form performance metrics and submission patterns
• Integration success/failure rates
• Common error patterns`
      : `• General submission activity in the date range
• System-wide performance metrics
• Error trend analysis`;

  return `Sumo Logic Query Analysis

Date Range: ${fromDate} to ${toDate}
${idSection}

Query Results:
Based on the provided parameters, here's what I would help you analyze:

${analysisSection}

Next Steps:
• I can help you craft specific Sumo Logic queries
• Provide query syntax for your specific use case
• Interpret results and identify patterns`;
};

/**
 * Execute tool calls based on tool name and arguments
 */
const performSlackyToolCall = (
  toolName: string,
  toolArgs: any,
): string | Promise<string> => {
  switch (toolName as SlackyToolsEnum) {
    case SlackyToolsEnum.SumoLogicQuery:
      return handleSumoLogicQuery(toolArgs);
    case SlackyToolsEnum.SsoAutofillAssistance:
      return handleSsoAutofillAssistance(toolArgs);
    case SlackyToolsEnum.CollectUserFeedback:
      return handleCollectUserFeedback(toolArgs);
    case SlackyToolsEnum.CollectUserRating:
      return handleCollectUserRating(toolArgs);
  }
  // No default - let other tool catalogs handle unknown tools
};

export { performSlackyToolCall };
