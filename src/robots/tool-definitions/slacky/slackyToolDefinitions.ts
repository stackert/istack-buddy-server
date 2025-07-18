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
  {
    name: SlackyToolsEnum.CollectUserFeedback,
    description:
      'Collect text feedback from users about iStackBuddy interactions or general service. Use when users want to provide feedback or when you want to proactively collect feedback after helping them.',
    input_schema: {
      type: 'object',
      properties: {
        feedback: {
          type: 'string',
          description: 'The user feedback text content',
        },
        category: {
          type: 'string',
          description: 'Feedback category',
          enum: [
            'conversation',
            'service',
            'feature_request',
            'bug_report',
            'other',
          ],
        },
      },
      required: ['feedback', 'category'],
    },
  },
  {
    name: SlackyToolsEnum.CollectUserRating,
    description:
      'Collect numerical rating from users about iStackBuddy interactions. Use when users want to rate their experience or when you want to gauge satisfaction.',
    input_schema: {
      type: 'object',
      properties: {
        rating: {
          type: 'integer',
          description:
            'Rating from -5 to +5 where -5=terrible, 0=neutral, +5=excellent',
          minimum: -5,
          maximum: 5,
        },
        context: {
          type: 'string',
          description:
            'What the rating is about: conversation, response_quality, helpfulness, overall_service',
        },
        comment: {
          type: 'string',
          description: 'Optional comment explaining the rating',
        },
      },
      required: ['rating', 'context'],
    },
  },
];

export { slackyToolDefinitions };
