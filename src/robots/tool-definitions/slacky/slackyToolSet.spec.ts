import { slackyToolSet } from './index';
import { SlackyToolsEnum } from './types';

describe('slackyToolSet', () => {
  describe('Structure', () => {
    it('should have correct structure', () => {
      expect(typeof slackyToolSet).toBe('object');
      expect(Array.isArray(slackyToolSet.toolDefinitions)).toBe(true);
      expect(typeof slackyToolSet.executeToolCall).toBe('function');
    });

    it('should have exactly 2 tool definitions', () => {
      expect(slackyToolSet.toolDefinitions).toHaveLength(2);
    });

    it('should have expected tool names', () => {
      const toolNames = slackyToolSet.toolDefinitions.map((tool) => tool.name);
      expect(toolNames).toEqual([
        SlackyToolsEnum.SumoLogicQuery,
        SlackyToolsEnum.SsoAutofillAssistance,
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
    describe(SlackyToolsEnum.SumoLogicQuery, () => {
      const sumoLogicTool = slackyToolSet.toolDefinitions.find(
        (tool) => tool.name === SlackyToolsEnum.SumoLogicQuery,
      )!;

      it('should have correct structure', () => {
        expect(sumoLogicTool.name).toBe(SlackyToolsEnum.SumoLogicQuery);
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

    describe(SlackyToolsEnum.SsoAutofillAssistance, () => {
      const ssoTool = slackyToolSet.toolDefinitions.find(
        (tool) => tool.name === SlackyToolsEnum.SsoAutofillAssistance,
      )!;

      it('should have correct structure', () => {
        expect(ssoTool.name).toBe(SlackyToolsEnum.SsoAutofillAssistance);
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
  });

  describe('executeToolCall', () => {
    it('should route to correct handler for sumo_logic_query', () => {
      const result = slackyToolSet.executeToolCall(
        SlackyToolsEnum.SumoLogicQuery,
        {
          fromDate: '1640995200000',
          toDate: '1641081600000',
          formId: '12345',
          submissionId: '67890',
        },
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('Sumo Logic Query Analysis');
      expect(result).toContain('1640995200000');
      expect(result).toContain('1641081600000');
      expect(result).toContain('12345');
      expect(result).toContain('67890');
    });

    it('should route to correct handler for sso_autofill_assistance', () => {
      const result = slackyToolSet.executeToolCall(
        SlackyToolsEnum.SsoAutofillAssistance,
        {
          formId: '12345',
          accountId: '98765',
        },
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('SSO Auto-fill Configuration Analysis');
      expect(result).toContain('12345');
      expect(result).toContain('98765');
    });

    it('should return undefined for unknown tool', () => {
      const result = slackyToolSet.executeToolCall('unknown_tool', {});

      expect(result).toBeUndefined();
    });
  });

  describe('handleSsoAutofillAssistance', () => {
    it('should generate correct SSO troubleshooting response', () => {
      const result = slackyToolSet.executeToolCall(
        SlackyToolsEnum.SsoAutofillAssistance,
        {
          formId: '12345',
          accountId: '98765',
        },
      );

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
      const result = slackyToolSet.executeToolCall(
        SlackyToolsEnum.SsoAutofillAssistance,
        {
          formId: 12345,
          accountId: 98765,
        },
      );

      expect(result).toContain('📋 Form ID: 12345');
      expect(result).toContain('🏢 Account ID: 98765');
    });
  });

  describe('handleSumoLogicQuery', () => {
    it('should generate response with all parameters', () => {
      const result = slackyToolSet.executeToolCall(
        SlackyToolsEnum.SumoLogicQuery,
        {
          fromDate: '1640995200000',
          toDate: '1641081600000',
          formId: '12345',
          submissionId: '67890',
        },
      );

      expect(result).toContain('🔍 Sumo Logic Query Analysis');
      expect(result).toContain('📅 Date Range: 1640995200000 to 1641081600000');
      expect(result).toContain('📋 Form ID: 12345');
      expect(result).toContain('📄 Submission ID: 67890');
      expect(result).toContain(
        'Submission lifecycle tracking for submission 67890',
      );
    });

    it('should generate response with only formId (no submissionId)', () => {
      const result = slackyToolSet.executeToolCall(
        SlackyToolsEnum.SumoLogicQuery,
        {
          fromDate: '1640995200000',
          toDate: '1641081600000',
          formId: '12345',
        },
      );

      expect(result).toContain('📋 Form ID: 12345');
      expect(result).not.toContain('📄 Submission ID:');
      expect(result).toContain('All submissions for form 12345');
      expect(result).toContain('Form performance metrics');
    });

    it('should generate response with only required parameters', () => {
      const result = slackyToolSet.executeToolCall(
        SlackyToolsEnum.SumoLogicQuery,
        {
          fromDate: '1640995200000',
          toDate: '1641081600000',
        },
      );

      expect(result).toContain('📅 Date Range: 1640995200000 to 1641081600000');
      expect(result).not.toContain('📋 Form ID:');
      expect(result).not.toContain('📄 Submission ID:');
      expect(result).toContain('General submission activity');
      expect(result).toContain('System-wide performance metrics');
    });

    it('should handle edge case with submissionId but no formId', () => {
      const result = slackyToolSet.executeToolCall(
        SlackyToolsEnum.SumoLogicQuery,
        {
          fromDate: '1640995200000',
          toDate: '1641081600000',
          submissionId: '67890',
        },
      );

      expect(result).toContain('📄 Submission ID: 67890');
      expect(result).not.toContain('📋 Form ID:');
      expect(result).toContain(
        'Submission lifecycle tracking for submission 67890',
      );
    });
  });
});
