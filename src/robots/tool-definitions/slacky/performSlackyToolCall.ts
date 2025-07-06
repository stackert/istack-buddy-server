import { marvToolSet, FsRestrictedApiRoutesEnum } from '../marv';
import type {
  ISumoLogicQueryArgs,
  ISsoAutofillAssistanceArgs,
  IFormAndRelatedEntityOverviewArgs,
} from './types';

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
 * Handle form and related entity overview tool
 */
const handleFormAndRelatedEntityOverview = async (
  toolArgs: IFormAndRelatedEntityOverviewArgs,
): Promise<string> => {
  const { formId } = toolArgs;

  try {
    // API key is now read from environment variables in FsApiClient
    const result = await marvToolSet.executeToolCall(
      FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
      { formId },
    );

    if (!result.isSuccess || !result.response) {
      return `❌ Failed to retrieve form overview for form ${formId}
      
Error: ${result.errorItems?.join(', ') || 'Unknown error'}`;
    }

    const overview = result.response;

    // Format related entities
    const formatEntityList = (
      entities: Array<{ id: string; name: string }>,
      type: string,
    ) => {
      if (entities.length === 0) {
        return `   • No ${type} configured`;
      }
      return entities
        .map((entity) => `   • ${entity.name} (ID: ${entity.id})`)
        .join('\n');
    };

    return `📋 Form Overview: ${overview.formId}

🔗 **Form Details:**
   • URL: ${overview.url}
   • Version: ${overview.version}
   • Timezone: ${overview.timezone}
   • Status: ${overview.isActive ? '✅ Active' : '❌ Inactive'}
   • Encryption: ${overview.encrypted ? '🔒 Enabled' : '🔓 Disabled'}

📊 **Submission Statistics:**
   • Total Submissions: ${overview.submissions}
   • Submissions Today: ${overview.submissionsToday}
   • Last Submission ID: ${overview.lastSubmissionId || 'None'}

⚙️ **Form Configuration:**
   • Field Count: ${overview.fieldCount}
   • One Question at a Time: ${overview.isOneQuestionAtATime ? '✅ Yes' : '❌ No'}
   • Has Approvers: ${overview.hasApprovers ? '✅ Yes' : '❌ No'}
   • Workflow Form: ${overview.isWorkflowForm ? '✅ Yes' : '❌ No'}${overview.isWorkflowPublished !== undefined ? `\n   • Workflow Published: ${overview.isWorkflowPublished ? '✅ Yes' : '❌ No'}` : ''}

🔗 **Submit Actions (Webhooks):** ${overview.submitActions.length}
${formatEntityList(overview.submitActions, 'webhooks')}

📧 **Notification Emails:** ${overview.notificationEmails.length}
${formatEntityList(overview.notificationEmails, 'notification emails')}

✅ **Confirmation Emails:** ${overview.confirmationEmails.length}
${formatEntityList(overview.confirmationEmails, 'confirmation emails')}

💡 This overview provides a comprehensive view of the form's configuration and related entities. Let me know if you need more details about any specific aspect!`;
  } catch (error) {
    return `❌ Error retrieving form overview: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Execute tool calls based on tool name and arguments
 */
const performSlackyToolCall = (
  toolName: string,
  toolArgs: any,
): string | Promise<string> => {
  switch (toolName) {
    case 'sumo_logic_query':
      return handleSumoLogicQuery(toolArgs);
    case 'sso_autofill_assistance':
      return handleSsoAutofillAssistance(toolArgs);
    case 'form_and_related_entity_overview':
      return handleFormAndRelatedEntityOverview(toolArgs);
    default:
      return `❌ Unknown tool: ${toolName}. Available tools: sumo_logic_query, sso_autofill_assistance, form_and_related_entity_overview`;
  }
};

export { performSlackyToolCall };
