import { KnobbySumoToolsEnum, TOpenAIKnobbySumoToolSet } from './types';

// Configuration
const INFO_SERVICES_BASE_URL = process.env.INFORMATION_SERVICES_URL;

const getAuthToken = () => {
  return (
    process.env.INFORMATION_SERVICES_TOKEN || 'istack-buddy-dev-token-2024'
  );
};

const makeInfoServicesRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'POST',
  body?: any,
): Promise<any> => {
  try {
    const token = getAuthToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const fullUrl = `${INFO_SERVICES_BASE_URL}${endpoint}`;
    console.log(`KnobbySumo: Making ${method} request to ${fullUrl}`);

    const response = await fetch(fullUrl, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Information Services API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      `KnobbySumo API Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    throw new Error(
      `Information Services request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

// Tool execution handler
const performKnobbySumoToolCall = async (
  toolName: string,
  toolArgs: any,
): Promise<string> => {
  try {
    let result: any;

    switch (toolName as KnobbySumoToolsEnum) {
      case KnobbySumoToolsEnum.SubmitQuery:
        {
          result = await makeInfoServicesRequest(
            '/context-sumo-report/query/submit',
            'POST',
            toolArgs,
          );
        }
        break;

      case KnobbySumoToolsEnum.GetJobStatus:
        {
          const { jobId } = toolArgs;
          result = await makeInfoServicesRequest(
            `/context-sumo-report/query/${jobId}/status`,
            'GET',
          );
        }
        break;

      case KnobbySumoToolsEnum.GetJobResults:
        {
          const { jobId } = toolArgs;
          result = await makeInfoServicesRequest(
            `/context-sumo-report/query/${jobId}/results`,
            'GET',
          );
        }
        break;

      default:
        throw new Error(`Unknown KnobbySumo tool: ${toolName}`);
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return `Error executing ${toolName}: ${errorMessage}`;
  }
};

// Basic tool definitions (just the essential ones for now)
const knobbySumoToolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: KnobbySumoToolsEnum.SubmitQuery,
      description: 'Submit a Sumo Logic query job for async execution',
      parameters: {
        type: 'object',
        properties: {
          queryName: {
            type: 'string',
            enum: [
              'submitActionReport',
              'submissionCreatedForForm',
              'authProviderMetrics',
            ],
            description: 'Type of Sumo Logic query to execute',
          },
          subject: {
            type: 'object',
            description: 'Query parameters and filters',
            properties: {
              formId: { type: 'string', description: 'Form ID filter' },
              submitActionType: {
                type: 'string',
                description: 'Submit action type filter',
              },
              startDate: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD)',
              },
              endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
              accountId: { type: 'string', description: 'Account ID filter' },
              submissionId: {
                type: 'string',
                description: 'Submission ID filter',
              },
            },
          },
          isValidationOnly: {
            type: 'boolean',
            description: 'Only validate request without executing',
          },
        },
        required: ['queryName', 'subject'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: KnobbySumoToolsEnum.GetJobStatus,
      description: 'Get status of a submitted Sumo Logic job',
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'Job ID to check status for',
          },
        },
        required: ['jobId'],
      },
    },
  },
];

// Export the complete tool set
export const knobbySumoToolSet: TOpenAIKnobbySumoToolSet = {
  toolDefinitions: knobbySumoToolDefinitions,
  executeToolCall: performKnobbySumoToolCall,
};
