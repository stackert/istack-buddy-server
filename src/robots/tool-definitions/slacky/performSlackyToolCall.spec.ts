import { performSlackyToolCall } from './performSlackyToolCall';
import { marvToolSet } from '../marv';
import { SlackyToolsEnum } from './types';

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
      const result = performSlackyToolCall(SlackyToolsEnum.SumoLogicQuery, {
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
      const result = performSlackyToolCall(SlackyToolsEnum.SumoLogicQuery, {
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
      const result = performSlackyToolCall(
        SlackyToolsEnum.SsoAutofillAssistance,
        {
          formId: '12345',
          accountId: '98765',
        },
      );

      expect(result).toContain('🔐 SSO Auto-fill Configuration Analysis');
      expect(result).toContain('Form ID: 12345');
      expect(result).toContain('Account ID: 98765');
      expect(result).toContain('SSO Auto-fill Troubleshooting');
    });
  });

  describe('unknown tools', () => {
    it('should return undefined for unknown tool names', () => {
      const result = performSlackyToolCall('unknown_tool', {});

      expect(result).toBeUndefined();
    });
  });
});
