// SET ENVIRONMENT VARIABLES IMMEDIATELY - BEFORE ANYTHING ELSE
process.env.ISTACK_INFO_SERVICE_BASE_URL = 'http://localhost:3001';
process.env.ISTACK_INFO_SERVICE_API_KEY = '_THE_FAKE_INFO_SERVICE_KEY_';
process.env.ANTHROPIC_API_KEY = '_FAKE_ANTHROPIC_API_KEY_FOR_JEST';
process.env.OPENAI_API_KEY = '_FAKE_OPENAI_KEY_';
process.env.ISTACK_BUDDY_INTERNAL_JWT_SECRET = 'istack-buddy-secret-key-2024';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Load reflect-metadata for class-validator decorators
require('reflect-metadata');

// Global Jest setup for performance optimizations

// Set longer timeout for slow tests
jest.setTimeout(10000);

// Console setup - let individual tests mock console if needed
// Don't globally mock console to avoid interfering with tests that expect console.log calls

// Global mocks for common modules that slow down tests (AFTER environment loading)
// Mock fs module with promises API
const mockFs = {
  readFileSync: jest.fn((filePath) => {
    // Provide default mock responses for common config files
    if (filePath.includes('session-management.json')) {
      return JSON.stringify({
        sessionTimeoutSeconds: 28800,
        sessionCleanupIntervalMinutes: 30,
      });
    }
    if (filePath.includes('database.json')) {
      return JSON.stringify({
        development: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      });
    }
    if (filePath.includes('user-permissions.json')) {
      return JSON.stringify({
        user_permissions: {
          'user-1': {
            permissions: [
              'user:profile:me:view',
              'auth:user',
              'auth:user:{self}',
            ],
            jwtToken:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJlbWFpbCI6ImFkbWluQGlzdGFjay5jb20iLCJ1c2VybmFtZSI6ImFkbWluIiwiYWNjb3VudFR5cGUiOiJBRE1JTiIsImlhdCI6MTc1MzAxMTQ0NCwiZXhwIjoxNzUzMDQwMjQ0fQ.kdr-ymMRdEQIniGwR915TTpsqD_wSdX2mutNYk87fyY',
          },
          'user-2': {
            permissions: [],
            jwtToken:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTIiLCJlbWFpbCI6InN0dWRlbnRAaXN0YWNrLmNvbSIsInVzZXJuYW1lIjoic3R1ZGVudCIsImFjY291bnRUeXBlIjoiU1RVREVOVCIsImlhdCI6MTc1MzAxMTQ0NCwiZXhwIjoxNzUzMDQwMjQ0fQ._3FpdkUV3GQn1qrEclxRDxy4oY0zYXHoNPnggk58Oss',
          },
        },
      });
    }
    if (filePath.includes('user-profiles.json')) {
      return JSON.stringify({
        users: {
          'user-1': {
            id: 'user-1',
            email: 'all-permissions@example.com',
            username: 'admin',
            account_type_informal: 'ADMIN',
            first_name: 'Admin',
            last_name: 'User',
          },
          'user-2': {
            id: 'user-2',
            email: 'no-permissions@example.com',
            username: 'student',
            account_type_informal: 'STUDENT',
            first_name: 'Student',
            last_name: 'User',
          },
        },
      });
    }
    // Mock responses for public content files
    if (filePath.includes('hello-world.html')) {
      return '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n    <p>Welcome to the public interface.</p>\n</body>\n</html>';
    }
    if (filePath.includes('hello-from-marv.html')) {
      return '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Hello from Marv</title>\n</head>\n<body>\n    <h1>Hello from Marv!</h1>\n    <p>This is the form-marv interface.</p>\n</body>\n</html>';
    }
    if (filePath.includes('INTENT_PARSE.md')) {
      return '# Intent Parsing System Prompt\n\nYou are an expert intent parsing system for iStack Buddy, a conversational AI platform. Your job is to analyze user messages and determine the appropriate intent, extract relevant entities, and provide routing recommendations.\n\n## Core Responsibilities\n\n1. **Intent Classification**: Determine the primary intent from user messages\n2. **Entity Extraction**: Extract subjects, dates, and other relevant entities\n3. **Conversation Context**: Understand if a message continues a previous conversation\n4. **Routing Recommendations**: Suggest appropriate executors and robots\n\n## Available Intents\n\n- **generateSumoReport**: Generate reports from Sumo Logic data\n- **searchKnowledgeBase**: Search knowledge base and documentation\n- **getContextDynamic**: Retrieve dynamic context (forms, accounts, auth)\n- **makeObservations**: Make observations about forms or auth providers\n- **assistUser**: General assistance and conversation\n\n## Available Executors\n\n- **SumoReportSingleJobExecutor**: Single Sumo report generation (generateSumoReport)\n- **SumoReportMultiJobExecutor**: Multiple Sumo report generation (generateSumoReport)\n- **KnowledgeBaseJobExecutor**: Knowledge base search execution (searchKnowledgeBase)\n- **ContextDynamicJobExecutor**: Dynamic context retrieval (getContextDynamic)\n- **ObservationJobExecutor**: Observation analysis execution (makeObservations)\n\n## Available Robots\n\n- **SlackyOpenAiAgent**: General purpose OpenAI-powered agent\n- **AnthropicMarv**: Anthropic Claude-powered agent\n- **KnobbyOpenAiSearch**: Search-focused OpenAI agent\n\n## Response Format\n\nReturn ONLY a valid JSON object with this exact structure:\n\n```json\n{\n  "intent": "string (exact intent name)",\n  "intentData": {\n    "originalUserPrompt": "string",\n    "subIntents": ["string array"],\n    "subjects": {\n      "formId": ["string array"],\n      "submissionId": ["string array"],\n      "submitActionId": ["string array"],\n      "submitActionType": ["string array"],\n      "accountId": ["string array"],\n      "authProviderId": ["string array"],\n      "case": ["string array"],\n      "jira": ["string array"]\n    },\n    "dateRange": {\n      "startDate": "ISO8601 string",\n      "endDate": "ISO8601 string"\n    },\n    "isConversationContinuation": "boolean"\n  },\n  "devDebugRecommendedExecutor": "string (suggested executor class name)",\n  "devDebugRecommendedRobot": "string (fallback robot name)"\n}\n```\n';
    }
    if (filePath.includes('HARVEST_DATES_SUMO.md')) {
      return '# Harvest Dates for Sumo Logic Queries\n\n## Date Range Patterns\n\n- "last week" → past 7 days\n- "past week" → past 7 days\n- "yesterday" → previous day\n- "today" → current day\n- "last month" → past 30 days\n- "past month" → past 30 days\n- "this week" → current week (Monday to Sunday)\n- "this month" → current month\n\n## Time Zone Handling\n\nAll dates should be converted to Eastern Time (ET) for consistency with Sumo Logic data.\n\n## Date Format\n\nUse ISO 8601 format: YYYY-MM-DDTHH:mm:ss-04:00 (Eastern Daylight Time)\n';
    }
    if (filePath.includes('HARVEST_SUBJECTS.md')) {
      return '# Harvest Subjects for Intent Parsing\n\n## Subject Types\n\n### Form IDs\n- Extract numeric form IDs from messages\n- Look for patterns like "form 12345", "form ID 12345", "form:12345"\n\n### Submission IDs\n- Extract submission IDs from messages\n- Look for patterns like "submission 67890", "submission ID 67890", "submission:67890"\n\n### Submit Action IDs\n- Extract submit action IDs from messages\n- Look for patterns like "submit action 11111", "action ID 11111", "action:11111"\n\n### Submit Action Types\n- Extract submit action types like "Salesforce", "Webhook", "Email", etc.\n- Look for quoted strings or capitalized words after "submit action type"\n\n### Account IDs\n- Extract account IDs from messages\n- Look for patterns like "account 99999", "account ID 99999", "account:99999"\n\n### Auth Provider IDs\n- Extract auth provider IDs from messages\n- Look for patterns like "auth provider 88888", "auth ID 88888", "auth:88888"\n\n### Case Numbers\n- Extract case numbers from messages\n- Look for patterns like "case 12345", "ticket 12345", "support case 12345"\n\n### Jira Tickets\n- Extract Jira ticket numbers\n- Look for patterns like "PROJ-123", "TASK-456", "BUG-789"\n';
    }
    // For other files, throw an error (which individual tests can override)
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  }),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
  },
};

// Mock the fs module and its promises export
jest.mock('fs', () => mockFs);
jest.mock('fs/promises', () => mockFs.promises);

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
}));

// Mock pg module globally - but preserve DatabaseError
jest.mock('pg', () => {
  const originalPg = jest.requireActual('pg');
  return {
    ...originalPg,
    Client: jest.fn(() => ({
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    })),
    Pool: jest.fn(() => ({
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    })),
  };
});

// Performance optimization: Clear all mocks before each test
// But don't restore mocks since individual tests may need to override global mocks
beforeEach(() => {
  jest.clearAllMocks();
});
console.log('JEST ENV LOADED:', process.env.ISTACK_INFO_SERVICE_API_KEY);
