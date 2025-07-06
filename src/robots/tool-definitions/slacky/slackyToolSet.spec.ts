import { slackyToolSet } from '.';
import { marvToolSet } from '../marv';
import type { IMarvApiUniversalResponse } from '../marv';

// Mock the fsApiClient
jest.mock('../marv/fsApiClient', () => {
  const mockInstance = {
    setApiKey: jest.fn(),
    formAndRelatedEntityOverview: jest.fn(),
  };
  return {
    FsApiClient: jest.fn().mockImplementation(() => mockInstance),
    fsApiClient: mockInstance,
  };
});

// Get the mocked module to access the mock instance
const { fsApiClient: mockFsApiClient } = jest.mocked(
  require('../marv/fsApiClient'),
) as any;

const mockExecuteToolCall = marvToolSet.executeToolCall as jest.MockedFunction<
  typeof marvToolSet.executeToolCall
>;

describe('SlackyToolSet', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      FORMSTACK_API_KEY: 'test-formstack-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SlackyToolSet Structure', () => {
    it('should have correct structure', () => {
      expect(slackyToolSet).toHaveProperty('toolDefinitions');
      expect(slackyToolSet).toHaveProperty('executeToolCall');
      expect(Array.isArray(slackyToolSet.toolDefinitions)).toBe(true);
      expect(typeof slackyToolSet.executeToolCall).toBe('function');
    });

    it('should have exactly 3 tool definitions', () => {
      expect(slackyToolSet.toolDefinitions).toHaveLength(3);
    });

    it('should have expected tool names', () => {
      const toolNames = slackyToolSet.toolDefinitions.map((tool) => tool.name);
      expect(toolNames).toEqual([
        'sumo_logic_query',
        'sso_autofill_assistance',
        'form_and_related_entity_overview',
      ]);
    });

    it('should have valid tool definitions structure', () => {
      slackyToolSet.toolDefinitions.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('input_schema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.input_schema).toBe('object');
        expect(tool.input_schema.type).toBe('object');
        expect(tool.input_schema).toHaveProperty('properties');
        expect(tool.input_schema).toHaveProperty('required');
        expect(Array.isArray(tool.input_schema.required)).toBe(true);
      });
    });
  });

  describe('Individual Tool Definitions', () => {
    describe('sumo_logic_query', () => {
      const sumoLogicTool = slackyToolSet.toolDefinitions.find(
        (tool) => tool.name === 'sumo_logic_query',
      )!;

      it('should have correct structure', () => {
        expect(sumoLogicTool.name).toBe('sumo_logic_query');
        expect(sumoLogicTool.description).toContain('Sumo Logic queries');
        expect(sumoLogicTool.input_schema.required).toEqual([
          'fromDate',
          'toDate',
        ]);
      });

      it('should have all expected properties', () => {
        const props = sumoLogicTool.input_schema.properties as Record<
          string,
          any
        >;
        expect(props).toHaveProperty('fromDate');
        expect(props).toHaveProperty('toDate');
        expect(props).toHaveProperty('formId');
        expect(props).toHaveProperty('submissionId');

        // All properties should be strings
        Object.values(props).forEach((prop) => {
          expect(prop.type).toBe('string');
          expect(prop.description).toBeDefined();
        });
      });
    });

    describe('sso_autofill_assistance', () => {
      const ssoTool = slackyToolSet.toolDefinitions.find(
        (tool) => tool.name === 'sso_autofill_assistance',
      )!;

      it('should have correct structure', () => {
        expect(ssoTool.name).toBe('sso_autofill_assistance');
        expect(ssoTool.description).toContain('SSO auto-fill');
        expect(ssoTool.input_schema.required).toEqual(['formId', 'accountId']);
      });

      it('should have all expected properties', () => {
        const props = ssoTool.input_schema.properties as Record<string, any>;
        expect(props).toHaveProperty('formId');
        expect(props).toHaveProperty('accountId');

        // All properties should be strings
        Object.values(props).forEach((prop) => {
          expect(prop.type).toBe('string');
          expect(prop.description).toBeDefined();
        });
      });
    });

    describe('form_and_related_entity_overview', () => {
      const formOverviewTool = slackyToolSet.toolDefinitions.find(
        (tool) => tool.name === 'form_and_related_entity_overview',
      )!;

      it('should have correct structure', () => {
        expect(formOverviewTool.name).toBe('form_and_related_entity_overview');
        expect(formOverviewTool.description).toContain(
          'comprehensive overview',
        );
        expect(formOverviewTool.input_schema.required).toEqual(['formId']);
      });

      it('should have all expected properties', () => {
        const props = formOverviewTool.input_schema.properties as Record<
          string,
          any
        >;
        expect(props).toHaveProperty('formId');
        expect(props).toHaveProperty('apiKey');

        // All properties should be strings
        Object.values(props).forEach((prop) => {
          expect(prop.type).toBe('string');
          expect(prop.description).toBeDefined();
        });
      });
    });
  });

  describe('executeToolCall', () => {
    it('should route to correct handler for sumo_logic_query', () => {
      const result = slackyToolSet.executeToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        formId: '12345',
        submissionId: '67890',
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Sumo Logic Query Analysis');
      expect(result).toContain('1640995200000');
      expect(result).toContain('1641081600000');
      expect(result).toContain('12345');
      expect(result).toContain('67890');
    });

    it('should route to correct handler for sso_autofill_assistance', () => {
      const result = slackyToolSet.executeToolCall('sso_autofill_assistance', {
        formId: '12345',
        accountId: '98765',
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('SSO Auto-fill Configuration Analysis');
      expect(result).toContain('12345');
      expect(result).toContain('98765');
    });

    it('should route to correct handler for form_and_related_entity_overview', () => {
      const result = slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
          apiKey: 'test-key',
        },
      );

      expect(result).toBeInstanceOf(Promise);
    });

    it('should return error message for unknown tool', () => {
      const result = slackyToolSet.executeToolCall('unknown_tool', {});

      expect(typeof result).toBe('string');
      expect(result).toContain('Unknown tool: unknown_tool');
      expect(result).toContain('Available tools:');
    });
  });

  describe('handleSsoAutofillAssistance', () => {
    it('should generate correct SSO troubleshooting response', () => {
      const result = slackyToolSet.executeToolCall('sso_autofill_assistance', {
        formId: '12345',
        accountId: '98765',
      });

      expect(result).toContain('🔐 SSO Auto-fill Configuration Analysis');
      expect(result).toContain('📋 Form ID: 12345');
      expect(result).toContain('🏢 Account ID: 98765');
      expect(result).toContain('🔧 SSO Auto-fill Troubleshooting:');
      expect(result).toContain('Common Issues to Check:');
      expect(result).toContain('Configuration Verification:');
      expect(result).toContain('Debugging Steps:');
      expect(result).toContain('What I can help with:');
    });

    it('should handle string conversion for form and account IDs', () => {
      const result = slackyToolSet.executeToolCall('sso_autofill_assistance', {
        formId: 12345,
        accountId: 98765,
      });

      expect(result).toContain('📋 Form ID: 12345');
      expect(result).toContain('🏢 Account ID: 98765');
    });
  });

  describe('handleSumoLogicQuery', () => {
    it('should generate response with all parameters', () => {
      const result = slackyToolSet.executeToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        formId: '12345',
        submissionId: '67890',
      });

      expect(result).toContain('🔍 Sumo Logic Query Analysis');
      expect(result).toContain('📅 Date Range: 1640995200000 to 1641081600000');
      expect(result).toContain('📋 Form ID: 12345');
      expect(result).toContain('📄 Submission ID: 67890');
      expect(result).toContain(
        'Submission lifecycle tracking for submission 67890',
      );
    });

    it('should generate response with only formId (no submissionId)', () => {
      const result = slackyToolSet.executeToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        formId: '12345',
      });

      expect(result).toContain('📋 Form ID: 12345');
      expect(result).not.toContain('📄 Submission ID:');
      expect(result).toContain('All submissions for form 12345');
      expect(result).toContain('Form performance metrics');
    });

    it('should generate response with only required parameters', () => {
      const result = slackyToolSet.executeToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
      });

      expect(result).toContain('📅 Date Range: 1640995200000 to 1641081600000');
      expect(result).not.toContain('📋 Form ID:');
      expect(result).not.toContain('📄 Submission ID:');
      expect(result).toContain('General submission activity');
      expect(result).toContain('System-wide performance metrics');
    });

    it('should handle edge case with submissionId but no formId', () => {
      const result = slackyToolSet.executeToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        submissionId: '67890',
      });

      expect(result).toContain('📄 Submission ID: 67890');
      expect(result).not.toContain('📋 Form ID:');
      expect(result).toContain(
        'Submission lifecycle tracking for submission 67890',
      );
    });
  });

  describe('handleFormAndRelatedEntityOverview', () => {
    it('should set API key when provided', async () => {
      const mockOverview = {
        formId: '12345',
        url: 'https://example.com/form',
        version: 1,
        timezone: 'UTC',
        isActive: true,
        encrypted: false,
        submissions: 10,
        submissionsToday: 2,
        lastSubmissionId: '999',
        fieldCount: 5,
        isOneQuestionAtATime: false,
        hasApprovers: false,
        isWorkflowForm: false,
        submitActions: [],
        notificationEmails: [],
        confirmationEmails: [],
      };

      mockFsApiClient.formAndRelatedEntityOverview.mockResolvedValue({
        isSuccess: true,
        response: mockOverview,
      } as IMarvApiUniversalResponse<any>);

      const result = await slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
          apiKey: 'test-api-key',
        },
      );

      // API key is now read from environment, not set manually
      expect(mockFsApiClient.formAndRelatedEntityOverview).toHaveBeenCalledWith(
        '12345',
      );
      expect(result).toContain('📋 Form Overview: 12345');
    });

    it('should not set API key when not provided', async () => {
      const mockOverview = {
        formId: '12345',
        url: 'https://example.com/form',
        version: 1,
        timezone: 'UTC',
        isActive: true,
        encrypted: false,
        submissions: 10,
        submissionsToday: 2,
        lastSubmissionId: '999',
        fieldCount: 5,
        isOneQuestionAtATime: false,
        hasApprovers: false,
        isWorkflowForm: false,
        submitActions: [],
        notificationEmails: [],
        confirmationEmails: [],
      };

      mockFsApiClient.formAndRelatedEntityOverview.mockResolvedValue({
        isSuccess: true,
        response: mockOverview,
      } as IMarvApiUniversalResponse<any>);

      await slackyToolSet.executeToolCall('form_and_related_entity_overview', {
        formId: '12345',
      });

      // API key is now read from environment, not set manually
    });

    it('should generate comprehensive form overview', async () => {
      const mockOverview = {
        formId: '12345',
        url: 'https://example.com/form',
        version: 2,
        timezone: 'America/New_York',
        isActive: true,
        encrypted: true,
        submissions: 150,
        submissionsToday: 5,
        lastSubmissionId: '999',
        fieldCount: 10,
        isOneQuestionAtATime: true,
        hasApprovers: true,
        isWorkflowForm: true,
        isWorkflowPublished: true,
        submitActions: [
          { id: '1', name: 'Webhook 1' },
          { id: '2', name: 'Webhook 2' },
        ],
        notificationEmails: [{ id: '10', name: 'Admin Notification' }],
        confirmationEmails: [{ id: '20', name: 'User Confirmation' }],
      };

      mockFsApiClient.formAndRelatedEntityOverview.mockResolvedValue({
        isSuccess: true,
        response: mockOverview,
      } as IMarvApiUniversalResponse<any>);

      const result = await slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(result).toContain('📋 Form Overview: 12345');
      expect(result).toContain('https://example.com/form');
      expect(result).toContain('Version: 2');
      expect(result).toContain('America/New_York');
      expect(result).toContain('✅ Active');
      expect(result).toContain('🔒 Enabled');
      expect(result).toContain('Total Submissions: 150');
      expect(result).toContain('Submissions Today: 5');
      expect(result).toContain('Last Submission ID: 999');
      expect(result).toContain('Field Count: 10');
      expect(result).toContain('One Question at a Time: ✅ Yes');
      expect(result).toContain('Has Approvers: ✅ Yes');
      expect(result).toContain('Workflow Form: ✅ Yes');
      expect(result).toContain('Workflow Published: ✅ Yes');
      expect(result).toContain('**Submit Actions (Webhooks):** 2');
      expect(result).toContain('Webhook 1 (ID: 1)');
      expect(result).toContain('Webhook 2 (ID: 2)');
      expect(result).toContain('**Notification Emails:** 1');
      expect(result).toContain('Admin Notification (ID: 10)');
      expect(result).toContain('**Confirmation Emails:** 1');
      expect(result).toContain('User Confirmation (ID: 20)');
    });

    it('should handle inactive form with no encryption', async () => {
      const mockOverview = {
        formId: '12345',
        url: 'https://example.com/form',
        version: 1,
        timezone: 'UTC',
        isActive: false,
        encrypted: false,
        submissions: 0,
        submissionsToday: 0,
        lastSubmissionId: null,
        fieldCount: 3,
        isOneQuestionAtATime: false,
        hasApprovers: false,
        isWorkflowForm: false,
        submitActions: [],
        notificationEmails: [],
        confirmationEmails: [],
      };

      mockFsApiClient.formAndRelatedEntityOverview.mockResolvedValue({
        isSuccess: true,
        response: mockOverview,
      } as IMarvApiUniversalResponse<any>);

      const result = await slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(result).toContain('❌ Inactive');
      expect(result).toContain('🔓 Disabled');
      expect(result).toContain('Total Submissions: 0');
      expect(result).toContain('Last Submission ID: None');
      expect(result).toContain('One Question at a Time: ❌ No');
      expect(result).toContain('Has Approvers: ❌ No');
      expect(result).toContain('Workflow Form: ❌ No');
      expect(result).not.toContain('Workflow Published:');
      expect(result).toContain('**Submit Actions (Webhooks):** 0');
      expect(result).toContain('• No webhooks configured');
      expect(result).toContain('**Notification Emails:** 0');
      expect(result).toContain('• No notification emails configured');
      expect(result).toContain('**Confirmation Emails:** 0');
      expect(result).toContain('• No confirmation emails configured');
    });

    it('should handle form overview API failure', async () => {
      mockFsApiClient.formAndRelatedEntityOverview.mockResolvedValue({
        isSuccess: false,
        response: null,
        errorItems: ['API Error', 'Network timeout'],
      } as IMarvApiUniversalResponse<any>);

      const result = await slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(result).toContain(
        '❌ Failed to retrieve form overview for form 12345',
      );
      expect(result).toContain('API Error, Network timeout');
    });

    it('should handle form overview API failure with no error details', async () => {
      mockFsApiClient.formAndRelatedEntityOverview.mockResolvedValue({
        isSuccess: false,
        response: null,
      } as IMarvApiUniversalResponse<any>);

      const result = await slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(result).toContain(
        '❌ Failed to retrieve form overview for form 12345',
      );
      expect(result).toContain('Unknown error');
    });

    it('should handle unexpected errors', async () => {
      mockFsApiClient.formAndRelatedEntityOverview.mockRejectedValue(
        new Error('Network connection failed'),
      );

      const result = await slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(result).toContain(
        '❌ Error retrieving form overview: Network connection failed',
      );
    });

    it('should handle unexpected non-Error exceptions', async () => {
      mockFsApiClient.formAndRelatedEntityOverview.mockRejectedValue(
        'String error',
      );

      const result = await slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(result).toContain(
        '❌ Error retrieving form overview: Unknown error',
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing parameters gracefully', () => {
      const result = slackyToolSet.executeToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        formId: null,
        submissionId: undefined,
      });

      expect(result).toContain('📅 Date Range: 1640995200000 to 1641081600000');
      expect(result).not.toContain('📋 Form ID:');
      expect(result).not.toContain('📄 Submission ID:');
    });

    it('should handle empty string parameters', () => {
      const result = slackyToolSet.executeToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        formId: '',
        submissionId: '',
      });

      expect(result).not.toContain('📋 Form ID:');
      expect(result).not.toContain('📄 Submission ID:');
    });

    it('should handle malformed tool arguments', () => {
      const result = slackyToolSet.executeToolCall('sso_autofill_assistance', {
        formId: null,
        accountId: undefined,
      });

      expect(result).toContain('📋 Form ID: null');
      expect(result).toContain('🏢 Account ID: undefined');
    });
  });

  describe('Tool Integration', () => {
    it('should properly integrate with fsApiClient', async () => {
      const mockOverview = {
        formId: '12345',
        url: 'https://example.com/form',
        version: 1,
        timezone: 'UTC',
        isActive: true,
        encrypted: false,
        submissions: 10,
        submissionsToday: 2,
        lastSubmissionId: '999',
        fieldCount: 5,
        isOneQuestionAtATime: false,
        hasApprovers: false,
        isWorkflowForm: false,
        submitActions: [],
        notificationEmails: [],
        confirmationEmails: [],
      };

      mockFsApiClient.formAndRelatedEntityOverview.mockResolvedValue({
        isSuccess: true,
        response: mockOverview,
      } as IMarvApiUniversalResponse<any>);

      const result = await slackyToolSet.executeToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(
        mockFsApiClient.formAndRelatedEntityOverview,
      ).toHaveBeenCalledTimes(1);
      expect(mockFsApiClient.formAndRelatedEntityOverview).toHaveBeenCalledWith(
        '12345',
      );
      expect(typeof result).toBe('string');
      expect(result).toContain('📋 Form Overview: 12345');
    });
  });
});
