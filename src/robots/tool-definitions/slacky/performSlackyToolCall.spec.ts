import { performSlackyToolCall } from './performSlackyToolCall';
import { marvToolSet } from '../marv';

// Mock the marvToolSet
jest.mock('../marv', () => ({
  marvToolSet: {
    executeToolCall: jest.fn(),
  },
  FsRestrictedApiRoutesEnum: {
    FormAndRelatedEntityOverview: 'fsRestrictedApiFormAndRelatedEntityOverview',
  },
}));

const mockMarvToolSet = marvToolSet as jest.Mocked<typeof marvToolSet>;

describe('performSlackyToolCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sumo_logic_query', () => {
    it('should handle query with all parameters', () => {
      const result = performSlackyToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        formId: '12345',
        submissionId: '67890',
      });

      expect(result).toContain('🔍 Sumo Logic Query Analysis');
      expect(result).toContain('Form ID: 12345');
      expect(result).toContain('Submission ID: 67890');
    });

    it('should handle query with only required parameters', () => {
      const result = performSlackyToolCall('sumo_logic_query', {
        fromDate: '1640995200000',
        toDate: '1641081600000',
      });

      expect(result).toContain('🔍 Sumo Logic Query Analysis');
      expect(result).not.toContain('Form ID:');
      expect(result).not.toContain('Submission ID:');
    });
  });

  describe('sso_autofill_assistance', () => {
    it('should generate SSO troubleshooting response', () => {
      const result = performSlackyToolCall('sso_autofill_assistance', {
        formId: '12345',
        accountId: '98765',
      });

      expect(result).toContain('🔐 SSO Auto-fill Configuration Analysis');
      expect(result).toContain('Form ID: 12345');
      expect(result).toContain('Account ID: 98765');
      expect(result).toContain('SSO Auto-fill Troubleshooting');
    });
  });

  describe('form_and_related_entity_overview', () => {
    it('should handle successful API response', async () => {
      const mockResponse = {
        isSuccess: true,
        response: {
          formId: '12345',
          url: 'https://example.com/form',
          version: 2,
          timezone: 'America/New_York',
          isActive: true,
          encrypted: true,
          submissions: 100,
          submissionsToday: 5,
          lastSubmissionId: 'sub123',
          fieldCount: 10,
          isOneQuestionAtATime: false,
          hasApprovers: true,
          isWorkflowForm: false,
          submitActions: [{ id: '1', name: 'Webhook 1' }],
          notificationEmails: [{ id: '2', name: 'Admin Email' }],
          confirmationEmails: [],
        },
      };

      mockMarvToolSet.executeToolCall.mockResolvedValue(mockResponse);

      const result = await performSlackyToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(result).toContain('📋 Form Overview: 12345');
      expect(result).toContain('✅ Active');
      expect(result).toContain('🔒 Enabled');
      expect(result).toContain('Webhook 1');
    });

    it('should handle API failure', async () => {
      const mockResponse = {
        isSuccess: false,
        response: null,
        errorItems: ['API Error'],
      };

      mockMarvToolSet.executeToolCall.mockResolvedValue(mockResponse);

      const result = await performSlackyToolCall(
        'form_and_related_entity_overview',
        {
          formId: '12345',
        },
      );

      expect(result).toContain('❌ Failed to retrieve form overview');
      expect(result).toContain('API Error');
    });
  });

  describe('unknown tools', () => {
    it('should handle unknown tool names', () => {
      const result = performSlackyToolCall('unknown_tool', {});

      expect(result).toContain('❌ Unknown tool: unknown_tool');
      expect(result).toContain('Available tools');
    });
  });
});
