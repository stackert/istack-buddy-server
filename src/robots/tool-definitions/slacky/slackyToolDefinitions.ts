import Anthropic from '@anthropic-ai/sdk';
import { SlackyToolsEnum } from './types';

const slackyToolDefinitions: Anthropic.Messages.Tool[] = [
  {
    name: SlackyToolsEnum.SumoLogicQuery,
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
    name: SlackyToolsEnum.SsoAutofillAssistance,
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
];

export { slackyToolDefinitions };
