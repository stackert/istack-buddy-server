import { slackyToolDefinitions } from './slackyToolDefinitions';
import { SlackyToolsEnum } from './types';

describe('slackyToolDefinitions', () => {
  it('should have exactly 4 tool definitions', () => {
    expect(slackyToolDefinitions).toHaveLength(4);
  });

  it('should have expected tool names', () => {
    const toolNames = slackyToolDefinitions.map((tool) => tool.name);
    expect(toolNames).toEqual([
      SlackyToolsEnum.SumoLogicQuery,
      SlackyToolsEnum.SsoAutofillAssistance,
      SlackyToolsEnum.CollectUserFeedback,
      SlackyToolsEnum.CollectUserRating,
    ]);
  });

  describe('sumo_logic_query tool', () => {
    const sumoLogicTool = slackyToolDefinitions.find(
      (tool) => tool.name === SlackyToolsEnum.SumoLogicQuery,
    );

    it('should have correct structure', () => {
      expect(sumoLogicTool).toBeDefined();
      expect(sumoLogicTool?.description).toContain('Sumo Logic queries');
      expect(sumoLogicTool?.input_schema.type).toBe('object');
    });

    it('should have correct required fields', () => {
      expect(sumoLogicTool?.input_schema.required).toEqual([
        'fromDate',
        'toDate',
      ]);
    });

    it('should have all expected properties', () => {
      const properties = sumoLogicTool?.input_schema.properties;
      expect(properties).toHaveProperty('fromDate');
      expect(properties).toHaveProperty('toDate');
      expect(properties).toHaveProperty('formId');
      expect(properties).toHaveProperty('submissionId');
    });
  });

  describe('sso_autofill_assistance tool', () => {
    const ssoTool = slackyToolDefinitions.find(
      (tool) => tool.name === SlackyToolsEnum.SsoAutofillAssistance,
    );

    it('should have correct structure', () => {
      expect(ssoTool).toBeDefined();
      expect(ssoTool?.description).toContain('SSO auto-fill');
      expect(ssoTool?.input_schema.type).toBe('object');
    });

    it('should have correct required fields', () => {
      expect(ssoTool?.input_schema.required).toEqual(['formId', 'accountId']);
    });
  });

  describe('collect_user_feedback tool', () => {
    const feedbackTool = slackyToolDefinitions.find(
      (tool) => tool.name === SlackyToolsEnum.CollectUserFeedback,
    );

    it('should have correct structure', () => {
      expect(feedbackTool).toBeDefined();
      expect(feedbackTool?.description).toContain('feedback');
      expect(feedbackTool?.input_schema.type).toBe('object');
    });

    it('should have correct required fields', () => {
      expect(feedbackTool?.input_schema.required).toEqual([
        'feedback',
        'category',
      ]);
    });
  });

  describe('collect_user_rating tool', () => {
    const ratingTool = slackyToolDefinitions.find(
      (tool) => tool.name === SlackyToolsEnum.CollectUserRating,
    );

    it('should have correct structure', () => {
      expect(ratingTool).toBeDefined();
      expect(ratingTool?.description).toContain('rating');
      expect(ratingTool?.input_schema.type).toBe('object');
    });

    it('should have correct required fields', () => {
      expect(ratingTool?.input_schema.required).toEqual(['rating', 'context']);
    });
  });
});
