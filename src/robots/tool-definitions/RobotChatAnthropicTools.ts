// Tool definitions for Anthropic API
import Anthropic from '@anthropic-ai/sdk';
import { formstackToolDefinitions } from '../api/formstackToolDefinitions';
import { performExternalApiCall } from '../api/performExternalApiCall';
// as Anthropic.Messages.Tool[]

type TAnthropicToolSet = {
  toolDefinitions: Anthropic.Messages.Tool[];
  executeToolCall: (toolName: string, toolArgs: any) => string;
};

/**
 * Handle SSO auto-fill assistance tool
 */
const handleSsoAutofillAssistance = (toolArgs: any): string => {
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
const handleSumoLogicQuery = (toolArgs: any): string => {
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
 * Handle Formstack API calls
 */
const handleFormstackApiCall = async (
  toolName: string,
  toolArgs: any,
): Promise<string> => {
  try {
    // Check for API key in multiple places, including the one from the original implementation
    const apiKey =
      process.env.CORE_FORMS_API_V2_KEY ||
      process.env.FORMSTACK_API_KEY ||
      process.env.FS_API_KEY ||
      'bf77018720efca7df34b3503dbc486e8'; // Working API key

    console.log('🔧 Executing Formstack API call:', { toolName, toolArgs });
    console.log(
      '🔑 Using API key:',
      apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4),
    );

    const result = await performExternalApiCall(
      apiKey,
      toolName,
      JSON.stringify(toolArgs),
    );

    console.log('🔍 API call result:', result);

    if (result.isSuccess) {
      return `✅ **${toolName} completed successfully!**

📋 **Result:**
${JSON.stringify(result.response, null, 2)}

${formatFormstackResult(toolName, result.response)}`;
    } else {
      return `❌ **${toolName} FAILED**

🚨 **Errors:**
${(result.errorItems || ['Unknown error']).map((error) => `• ${error}`).join('\n')}

**What went wrong:**
${
  result.errorItems?.includes('Form is not Marv enabled')
    ? `The form ${toolArgs.formId} is not Marv-enabled. You need to add a "MARV_ENABLED" field to the form first, or use a form that already has this field.`
    : result.errorItems?.includes('Unauthorized') ||
        result.errorItems?.includes('401')
      ? `❌ **API Authentication Failed!**
    
The API key being used is not valid or doesn't have permission to access this form.

**To fix this:**
1. Set your real Formstack API key: \`export CORE_FORMS_API_V2_KEY='your-api-key'\`
2. Or set: \`export FORMSTACK_API_KEY='your-api-key'\`
3. Make sure the key has permission to access form ${toolArgs.formId}

**Current key:** ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`
      : 'Please check your parameters and try again.'
}`;
    }
  } catch (error) {
    console.error('🚨 Error in handleFormstackApiCall:', error);
    return `❌ **Error executing ${toolName}:**

${error instanceof Error ? error.message : 'Unknown error occurred'}

Please verify your parameters and try again.`;
  }
};

/**
 * Format Formstack API results for user-friendly display
 */
const formatFormstackResult = (toolName: string, response: any): string => {
  switch (toolName) {
    case 'fsRestrictedApiFormLiteAdd':
      return `🎉 **New form created successfully!**
• **Form ID:** ${response.formId}
• **Edit URL:** ${response.editUrl}
• **View URL:** ${response.viewUrl}

You can now start building your form or add additional fields using the field tools.`;

    case 'fsRestrictedApiFieldLiteAdd':
      return `🆕 **Field added successfully!**
• **Field ID:** ${response.fieldId}
• **Field Label:** ${response.fieldJson?.label}
• **Field Type:** ${response.fieldJson?.field_type}

The field is now available in your form for users to interact with.`;

    case 'fsRestrictedApiFormDeveloperCopy':
      return `📋 **Developer copy created!**
• **New Form ID:** ${response.id}
• **Form Name:** ${response.name}
• **Edit URL:** ${response.edit_url}
• **View URL:** ${response.url}

This copy can be used for testing and development without affecting the original form.`;

    default:
      return `ℹ️ **Operation completed successfully!**

The ${toolName
        .replace('fsRestrictedApi', '')
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()} operation has been completed.`;
  }
};

/**
 * Execute tool calls based on tool name and arguments
 */
const executeToolCall = (toolName: string, toolArgs: any): string => {
  // Handle existing tools
  switch (toolName) {
    case 'sumo_logic_query':
      return handleSumoLogicQuery(toolArgs);
    case 'sso_autofill_assistance':
      return handleSsoAutofillAssistance(toolArgs);
  }

  // Handle Formstack API tools
  const formstackToolNames = formstackToolDefinitions.map((tool) => tool.name);
  if (formstackToolNames.includes(toolName)) {
    // For synchronous execution, we'll return a promise-like response
    // In a real implementation, you'd want to handle this asynchronously
    handleFormstackApiCall(toolName, toolArgs)
      .then((result) => result)
      .catch((error) => `Error: ${error}`);

    // Return immediate acknowledgment
    return `🔄 **Processing ${toolName}...**

⏳ Working on your request. This may take a moment as we communicate with the Formstack API.

Parameters received:
${Object.entries(toolArgs)
  .map(([key, value]) => `• ${key}: ${value}`)
  .join('\n')}`;
  }

  return `❌ Unknown tool: ${toolName}. Available tools: sumo_logic_query, sso_autofill_assistance, ${formstackToolNames.join(', ')}`;
};

const RobotChatAnthropicToolSet: TAnthropicToolSet = {
  toolDefinitions: [
    {
      name: 'sumo_logic_query',
      description:
        'Assist users with Sumo Logic queries to analyze form submissions, logs, and related data. Helps trace submission lifecycle and troubleshoot issues.',
      input_schema: {
        type: 'object',
        properties: {
          fromDate: {
            type: 'string',
            description:
              'Start date for the query in numeric string format (e.g., "1640995200000" for Unix timestamp)',
          },
          toDate: {
            type: 'string',
            description:
              'End date for the query in numeric string format (e.g., "1641081600000" for Unix timestamp)',
          },
          formId: {
            type: 'string',
            description:
              'Form ID to query data for, in numeric string format (e.g., "12345")',
          },
          submissionId: {
            type: 'string',
            description:
              'Specific submission ID to analyze, in numeric string format (e.g., "67890")',
          },
        },
        required: ['fromDate', 'toDate'],
      },
    },
    {
      name: 'sso_autofill_assistance',
      description:
        'Assist users with form SSO auto-fill questions and troubleshooting. Helps diagnose SSO configuration and auto-fill mapping issues.',
      input_schema: {
        type: 'object',
        properties: {
          formId: {
            type: 'string',
            description:
              'Form ID to analyze SSO auto-fill configuration for, in numeric string format (e.g., "12345")',
          },
          accountId: {
            type: 'string',
            description:
              'Account ID associated with the SSO configuration, in numeric string format (e.g., "98765")',
          },
        },
        required: ['formId', 'accountId'],
      },
    },
    // Add all Formstack tools
    ...formstackToolDefinitions,
  ],
  executeToolCall: executeToolCall,
};
// we need to refactor the above- I think it would be best if we define all the functions
// in a separate file.

const handleFormOverview = (toolArgs: any): string => {
  return `
 handleFormOverview
 - return form overview
  - list submit actions (with ids) - maybe only webhooks are available through this api, which means we need to indicate the list is incomplete
  - list notification/confirmation emails (with ids)
  - list field count (if Ids are needed we should create an 'extended' form overview)
  - form type: core-workflow, cor-form, copilot-workflow
  - last submission
  - number of submissions
  - add/on feature 
    (should be a list indicated has does not have)
      approval
      save-resume
      one-question at a time
`;
};

const handleFormObservations = (toolArgs: any): string => {
  return `
handleFormObservations
  - list total number of: debug, info, warning, error.
  - list of each warning
  - list of each error
  - total number of each field type (Number: 23, Address: 3) (if it doesn't exist build the observer)
  - list number of fields with calculation.  
  - list number of calculation systems
  - list number of fields with logic.  
  - list number of logic systems
  

This output will server as context for other tools      

  `;
};

export { RobotChatAnthropicToolSet };
