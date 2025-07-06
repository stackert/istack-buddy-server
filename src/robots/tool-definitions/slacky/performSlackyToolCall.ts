import { marvToolSet, FsRestrictedApiRoutesEnum } from '../marv';
import type { ISumoLogicQueryArgs, ISsoAutofillAssistanceArgs } from './types';
import { SlackyToolsEnum } from './types';

/**
 * Handle SSO auto-fill assistance tool
 */
const handleSsoAutofillAssistance = (
  toolArgs: ISsoAutofillAssistanceArgs,
): string => {
  const { formId, accountId } = toolArgs;

  return `🔐 SSO Auto-fill Configuration Analysis

📋 Form ID: ${formId}
🏢 Account ID: ${accountId}

🔧 SSO Auto-fill Troubleshooting:

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

💡 **What I can help with:**
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
    formId ? `📋 Form ID: ${formId}` : '',
    submissionId ? `📄 Submission ID: ${submissionId}` : '',
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

  return `🔍 Sumo Logic Query Analysis

📅 Date Range: ${fromDate} to ${toDate}
${idSection}

📊 Query Results:
Based on the provided parameters, here's what I would help you analyze:

${analysisSection}

💡 Next Steps:
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
  }
  // No default - let other tool catalogs handle unknown tools
};

export { performSlackyToolCall };
