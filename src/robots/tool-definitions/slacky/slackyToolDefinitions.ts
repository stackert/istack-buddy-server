import Anthropic from '@anthropic-ai/sdk';

const slackyToolDefinitions: Anthropic.Messages.Tool[] = [
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
  {
    name: 'form_and_related_entity_overview',
    description:
      'Get comprehensive overview of a form including configuration, statistics, and all related entities (webhooks, notifications, confirmations). Provides detailed information about form setup and current status.',
    input_schema: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description:
            'Form ID to get overview for, in numeric string format (e.g., "12345")',
        },
        apiKey: {
          type: 'string',
          description:
            'Optional Formstack API key if different from default. Only provide if user specifically mentions an API key.',
        },
      },
      required: ['formId'],
    },
  },
];

export { slackyToolDefinitions };
